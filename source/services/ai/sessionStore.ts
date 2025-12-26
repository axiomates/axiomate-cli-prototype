/**
 * Session Store - 管理多个 Session 的持久化和切换
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { getSessionsPath } from "../../utils/appdata.js";
import { getCurrentModelId } from "../../utils/config.js";
import { logger } from "../../utils/logger.js";
import {
	Session,
	createSession,
	type SessionConfig,
	type SessionMessage,
	type SessionInternalState,
} from "./session.js";

/**
 * Session 元信息（存储在 index 文件中）
 */
export type SessionInfo = {
	/** 唯一 ID (UUID) */
	id: string;
	/** 显示名称 */
	name: string;
	/** 创建时间戳 */
	createdAt: number;
	/** 最后更新时间戳 */
	updatedAt: number;
	/** Token 使用量 */
	tokenUsage: number;
	/** 消息数量 */
	messageCount: number;
	/** 使用的模型 ID */
	modelId: string;
	/** 是否为当前活跃 session */
	isActive: boolean;
};

/**
 * 序列化的 Session 数据
 */
export type SerializedSession = {
	/** Session 元信息 */
	info: SessionInfo;
	/** Session 消息 */
	messages: SessionMessage[];
	/** 系统提示（如果自定义） */
	systemPrompt?: SessionMessage | null;
	/** Token 状态 */
	tokenState: {
		actualPromptTokens: number;
		actualCompletionTokens: number;
	};
};

/**
 * Session 索引文件结构
 */
export type SessionIndex = {
	/** 版本号（用于迁移） */
	version: 1;
	/** 当前活跃 session ID */
	activeSessionId: string | null;
	/** 所有 session 列表 */
	sessions: SessionInfo[];
};

// 单例实例
let sessionStoreInstance: SessionStore | null = null;

/**
 * Session Store 类
 * 管理多个 session 的生命周期和持久化
 */
export class SessionStore {
	private sessionsDir: string;
	private indexPath: string;
	private sessions: Map<string, SessionInfo> = new Map();
	private activeSessionId: string | null = null;
	private contextWindow: number;
	private initialized: boolean = false;

	constructor(contextWindow: number) {
		this.sessionsDir = getSessionsPath();
		this.indexPath = path.join(this.sessionsDir, "index.json");
		this.contextWindow = contextWindow;
	}

	/**
	 * 初始化 SessionStore
	 * 加载索引文件，恢复活跃 session
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// 确保目录存在
		this.ensureDirectoryExists();

		// 加载索引
		if (fs.existsSync(this.indexPath)) {
			try {
				const content = fs.readFileSync(this.indexPath, "utf-8");
				const index = JSON.parse(content) as SessionIndex;

				// 加载所有 session info
				for (const info of index.sessions) {
					this.sessions.set(info.id, info);
				}

				this.activeSessionId = index.activeSessionId;

				// 验证活跃 session 存在
				if (
					this.activeSessionId &&
					!this.sessions.has(this.activeSessionId)
				) {
					this.activeSessionId = null;
				}
			} catch (error) {
				logger.error("Failed to load session index, rebuilding", {
					error,
				});
				await this.rebuildIndexFromFiles();
			}
		}

		// 如果没有 session，创建初始 session
		if (this.sessions.size === 0) {
			const initialSession = this.createSession();
			this.activeSessionId = initialSession.id;
			this.saveIndex();
		} else if (!this.activeSessionId && this.sessions.size > 0) {
			// 如果没有活跃 session，选择最近的
			const sorted = this.listSessions();
			if (sorted.length > 0) {
				this.activeSessionId = sorted[0]!.id;
				this.saveIndex();
			}
		}

		this.initialized = true;
	}

	/**
	 * 确保 sessions 目录存在
	 */
	private ensureDirectoryExists(): void {
		if (!fs.existsSync(this.sessionsDir)) {
			fs.mkdirSync(this.sessionsDir, { recursive: true });
		}
	}

	/**
	 * 从文件重建索引（用于损坏恢复）
	 */
	private async rebuildIndexFromFiles(): Promise<void> {
		this.sessions.clear();

		const files = fs.readdirSync(this.sessionsDir);
		for (const file of files) {
			if (file.endsWith(".json") && file !== "index.json") {
				try {
					const filePath = path.join(this.sessionsDir, file);
					const content = fs.readFileSync(filePath, "utf-8");
					const session = JSON.parse(content) as SerializedSession;
					this.sessions.set(session.info.id, session.info);
				} catch {
					// 跳过损坏的文件
					logger.warn("Skipping corrupted session file", { file });
				}
			}
		}
	}

	/**
	 * 保存索引文件
	 */
	private saveIndex(): void {
		const index: SessionIndex = {
			version: 1,
			activeSessionId: this.activeSessionId,
			sessions: Array.from(this.sessions.values()),
		};

		try {
			const tempPath = this.indexPath + ".tmp";
			fs.writeFileSync(tempPath, JSON.stringify(index, null, 2));
			fs.renameSync(tempPath, this.indexPath);
		} catch (error) {
			logger.error("Failed to save session index", { error });
		}
	}

	/**
	 * 获取所有 session 列表（按更新时间降序）
	 */
	listSessions(): SessionInfo[] {
		return Array.from(this.sessions.values()).sort(
			(a, b) => b.updatedAt - a.updatedAt,
		);
	}

	/**
	 * 获取当前活跃 session 信息
	 */
	getActiveSession(): SessionInfo | null {
		if (!this.activeSessionId) return null;
		return this.sessions.get(this.activeSessionId) ?? null;
	}

	/**
	 * 获取指定 ID 的 session 信息
	 */
	getSessionById(id: string): SessionInfo | null {
		return this.sessions.get(id) ?? null;
	}

	/**
	 * 创建新 session
	 * @param name 可选的自定义名称，默认使用临时名称
	 */
	createSession(name?: string): SessionInfo {
		const id = randomUUID();
		const now = Date.now();

		// 使用临时名称，等用户发送第一条消息后再更新
		const sessionName = name ?? this.generateDefaultName();

		const info: SessionInfo = {
			id,
			name: sessionName,
			createdAt: now,
			updatedAt: now,
			tokenUsage: 0,
			messageCount: 0,
			modelId: getCurrentModelId(),
			isActive: false,
		};

		this.sessions.set(id, info);
		this.saveIndex();

		// 创建空的 session 文件
		this.saveSessionData(info, {
			messages: [],
			systemPrompt: null,
			actualPromptTokens: 0,
			actualCompletionTokens: 0,
		});

		return info;
	}

	/**
	 * 生成默认 session 名称（临时名称，会在用户发送首条消息后更新）
	 */
	private generateDefaultName(): string {
		// 使用简短的临时名称
		return "New Session";
	}

	/**
	 * 根据用户消息生成 session 标题
	 * @param userMessage 用户的首条消息
	 * @returns 截取后的标题（最多 50 个字符）
	 */
	static generateTitleFromMessage(userMessage: string): string {
		// 移除开头的空白字符
		let title = userMessage.trim();

		// 如果有换行，只取第一行
		const newlineIndex = title.indexOf("\n");
		if (newlineIndex !== -1) {
			title = title.substring(0, newlineIndex);
		}

		// 移除 @ 文件引用（如 @src/app.tsx）
		title = title.replace(/@[\w./\\-]+/g, "").trim();

		// 截取最多 50 个字符
		const maxLength = 50;
		if (title.length > maxLength) {
			title = title.substring(0, maxLength - 3) + "...";
		}

		// 如果处理后为空，使用默认标题
		if (!title) {
			title = "New Session";
		}

		return title;
	}

	/**
	 * 更新 session 名称
	 * @param id Session ID
	 * @param name 新名称
	 * @returns 是否成功更新
	 */
	updateSessionName(id: string, name: string): boolean {
		const info = this.sessions.get(id);
		if (!info) return false;

		info.name = name;
		info.updatedAt = Date.now();
		this.sessions.set(id, info);
		this.saveIndex();

		return true;
	}

	/**
	 * 加载 session 数据并创建 Session 实例
	 */
	async loadSession(id: string): Promise<Session | null> {
		const info = this.sessions.get(id);
		if (!info) return null;

		const filePath = path.join(this.sessionsDir, `${id}.json`);
		if (!fs.existsSync(filePath)) {
			logger.warn("Session file not found", { id });
			return null;
		}

		try {
			const content = fs.readFileSync(filePath, "utf-8");
			const data = JSON.parse(content) as SerializedSession;

			// 创建 Session 实例并恢复状态
			const session = createSession({ contextWindow: this.contextWindow });

			const state: SessionInternalState = {
				messages: data.messages,
				systemPrompt: data.systemPrompt ?? null,
				actualPromptTokens: data.tokenState.actualPromptTokens,
				actualCompletionTokens: data.tokenState.actualCompletionTokens,
			};

			session.restoreFromState(state);

			return session;
		} catch (error) {
			logger.error("Failed to load session", { id, error });
			return null;
		}
	}

	/**
	 * 保存 session 数据
	 */
	saveSession(session: Session, infoOrId: SessionInfo | string): void {
		const info =
			typeof infoOrId === "string"
				? this.sessions.get(infoOrId)
				: infoOrId;
		if (!info) return;

		const state = session.getInternalState();
		const status = session.getStatus();

		// 更新 info
		info.updatedAt = Date.now();
		info.tokenUsage = status.usedTokens;
		info.messageCount = status.messageCount;
		this.sessions.set(info.id, info);

		// 保存数据
		this.saveSessionData(info, state);
		this.saveIndex();
	}

	/**
	 * 保存 session 数据到文件
	 */
	private saveSessionData(
		info: SessionInfo,
		state: SessionInternalState,
	): void {
		const data: SerializedSession = {
			info,
			messages: state.messages,
			systemPrompt: state.systemPrompt,
			tokenState: {
				actualPromptTokens: state.actualPromptTokens,
				actualCompletionTokens: state.actualCompletionTokens,
			},
		};

		const filePath = path.join(this.sessionsDir, `${info.id}.json`);
		try {
			const tempPath = filePath + ".tmp";
			fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
			fs.renameSync(tempPath, filePath);
		} catch (error) {
			logger.error("Failed to save session data", { id: info.id, error });
		}
	}

	/**
	 * 删除 session
	 * @returns 是否成功删除
	 */
	deleteSession(id: string): boolean {
		const info = this.sessions.get(id);
		if (!info) return false;

		// 不能删除活跃 session
		if (id === this.activeSessionId) {
			return false;
		}

		// 删除文件
		const filePath = path.join(this.sessionsDir, `${id}.json`);
		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (error) {
			logger.error("Failed to delete session file", { id, error });
		}

		// 从列表移除
		this.sessions.delete(id);
		this.saveIndex();

		return true;
	}

	/**
	 * 设置活跃 session ID
	 */
	setActiveSessionId(id: string): void {
		if (!this.sessions.has(id)) return;

		// 更新 isActive 状态
		for (const info of this.sessions.values()) {
			info.isActive = info.id === id;
		}

		this.activeSessionId = id;
		this.saveIndex();
	}

	/**
	 * 获取当前活跃 session ID
	 */
	getActiveSessionId(): string | null {
		return this.activeSessionId;
	}

	/**
	 * 更新上下文窗口大小
	 */
	updateContextWindow(contextWindow: number): void {
		this.contextWindow = contextWindow;
	}

	/**
	 * 获取上下文窗口大小
	 */
	getContextWindow(): number {
		return this.contextWindow;
	}
}

/**
 * 获取 SessionStore 单例
 * 注意：必须先调用 initSessionStore() 初始化
 */
export function getSessionStore(): SessionStore | null {
	return sessionStoreInstance;
}

/**
 * 初始化 SessionStore 单例
 */
export async function initSessionStore(
	contextWindow: number,
): Promise<SessionStore> {
	if (!sessionStoreInstance) {
		sessionStoreInstance = new SessionStore(contextWindow);
		await sessionStoreInstance.initialize();
	}
	return sessionStoreInstance;
}

/**
 * 重置 SessionStore 单例（用于测试）
 */
export function resetSessionStore(): void {
	sessionStoreInstance = null;
}
