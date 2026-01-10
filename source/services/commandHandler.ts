/**
 * 命令处理器
 * 根据 SlashCommand 的 action 类型分发处理逻辑
 */

import type {
	SlashCommand,
	CommandAction,
} from "../components/AutocompleteInput/index.js";
import { SLASH_COMMANDS, clearCommandCache } from "../constants/commands.js";
import { getToolRegistry } from "./tools/registry.js";
import {
	getModelById,
	setCurrentModelId,
	setSuggestionModelId,
	setSuggestionEnabled,
	setThinkingEnabled,
	setPlanModeEnabled,
} from "../utils/config.js";
import { t, setLocale } from "../i18n/index.js";
import { getSessionStore } from "./ai/sessionStore.js";

/**
 * 内部命令处理器映射
 */
type InternalHandler = (
	path: string[],
	context: CommandContext,
) => CommandResult;

/**
 * 命令执行上下文（静态信息）
 */
export type CommandContext = {
	appName: string;
	version: string;
};

/**
 * 命令执行回调（App 提供的业务逻辑）
 */
export type CommandCallbacks = {
	/** 显示消息 */
	showMessage: (content: string) => void;
	/** 发送给 AI */
	sendToAI: (content: string) => void;
	/** 更新配置 */
	setConfig: (key: string, value: string) => void;
	/** 执行 compact（总结并压缩会话） */
	compact: () => Promise<void>;
	/** 停止当前处理并清空消息队列 */
	stop: () => void;
	/** 重建 AI 服务（模型切换后需要） */
	recreateAIService: () => void;
	/** 退出 */
	exit: () => void;
	/** 创建新 session */
	sessionNew: () => Promise<void>;
	/** 切换 session */
	sessionSwitch: (id: string) => Promise<void>;
	/** 删除 session */
	sessionDelete: (id: string) => void;
	/** 清除所有 session 并创建新的 */
	sessionClear: () => Promise<void>;
};

/**
 * 命令执行结果 - 新增 callback 类型
 */
type CommandResult =
	| { type: "message"; content: string }
	| { type: "prompt"; content: string }
	| { type: "config"; key: string; value: string }
	| { type: "action"; action: "exit" }
	| { type: "async"; handler: () => Promise<string> }
	| {
			type: "callback";
			callback:
				| "compact"
				| "stop"
				| "recreate_ai_service"
				| "session_new"
				| "sessionClear";
	  }
	| {
			type: "callback_with_message";
			callback: "recreate_ai_service";
			content: string;
	  }
	| {
			type: "callback_with_param";
			callback: "session_switch" | "session_delete";
			param: string;
	  }
	| { type: "error"; message: string };

/**
 * 内部命令处理器注册表
 */
const internalHandlers: Record<string, InternalHandler> = {
	exit: () => ({
		type: "action",
		action: "exit",
	}),

	compact: () => ({
		type: "callback",
		callback: "compact",
	}),

	stop: () => ({
		type: "callback",
		callback: "stop",
	}),

	// Session 命令处理器
	session_list: () => ({
		type: "async",
		handler: async () => {
			const store = getSessionStore();
			if (!store) {
				return t("session.storeNotInitialized");
			}

			const sessions = store.listSessions();
			if (sessions.length === 0) {
				return t("session.listEmpty");
			}

			const activeId = store.getActiveSessionId();
			const lines: string[] = [`## ${t("session.listTitle")}\n`];

			for (const session of sessions) {
				const isActive = session.id === activeId;
				// 使用 ▸ 和 ○ 作为标记，视觉对齐
				const marker = isActive ? "▸" : "○";
				const activeLabel = isActive ? ` (${t("session.active")})` : "";
				const date = new Date(session.updatedAt).toLocaleString();
				lines.push(
					`${marker} **${session.name}**${activeLabel}`,
					`  ID: \`${session.id.substring(0, 8)}\` | ${session.messageCount} msgs | ${date}`,
					"",
				);
			}

			return lines.join("\n");
		},
	}),

	session_new: () => ({
		type: "callback",
		callback: "session_new",
	}),

	session_switch: (path: string[]) => {
		// path = ["session", "switch", "<session-name>"]
		const sessionName = path[path.length - 1];
		if (!sessionName) {
			return { type: "error" as const, message: t("session.invalidId") };
		}

		// 根据名称查找 session
		const store = getSessionStore();
		if (!store) {
			return {
				type: "error" as const,
				message: t("session.storeNotInitialized"),
			};
		}

		const sessions = store.listSessions();
		const session = sessions.find((s) => s.name === sessionName);
		if (!session) {
			return { type: "error" as const, message: t("session.notFound") };
		}

		return {
			type: "callback_with_param" as const,
			callback: "session_switch" as const,
			param: session.id,
		};
	},

	session_delete: (path: string[]) => {
		// path = ["session", "delete", "<session-name>"]
		const sessionName = path[path.length - 1];
		if (!sessionName) {
			return { type: "error" as const, message: t("session.invalidId") };
		}

		// 根据名称查找 session
		const store = getSessionStore();
		if (!store) {
			return {
				type: "error" as const,
				message: t("session.storeNotInitialized"),
			};
		}

		const sessions = store.listSessions();
		const session = sessions.find((s) => s.name === sessionName);
		if (!session) {
			return { type: "error" as const, message: t("session.notFound") };
		}

		// 检查是否是活跃 session
		if (session.id === store.getActiveSessionId()) {
			return {
				type: "error" as const,
				message: t("session.cannotDeleteActive"),
			};
		}

		return {
			type: "callback_with_param" as const,
			callback: "session_delete" as const,
			param: session.id,
		};
	},

	// 当没有其他 session 可切换时的处理器
	session_switch_empty: () => ({
		type: "message" as const,
		content: t("session.noOtherSessions"),
	}),

	// 当没有可删除的 session 时的处理器
	session_delete_empty: () => ({
		type: "message" as const,
		content: t("session.noSessionsToDelete"),
	}),

	// 清除所有 session 并创建新的
	session_clear: () => ({
		type: "callback" as const,
		callback: "sessionClear" as const,
	}),

	// 工具命令处理器
	tools_list: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			return registry.formatToolList(true);
		},
	}),

	tools_refresh: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			await registry.discover();
			const stats = registry.getStats();
			return t("commandHandler.toolsRefreshed", { count: stats.installed });
		},
	}),

	tools_stats: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			if (!registry.isDiscovered) {
				await registry.discover();
			}
			const stats = registry.getStats();
			const lines = [
				`## ${t("common.info")}`,
				`- ${t("common.installed")}: ${stats.installed}`,
				`- ${t("common.notInstalled")}: ${stats.notInstalled}`,
				``,
				`### ${t("toolCategories.other")}`,
			];
			for (const [category, count] of Object.entries(stats.byCategory)) {
				lines.push(`- ${category}: ${count}`);
			}
			return lines.join("\n");
		},
	}),

	// 模型选择处理器
	model_select: (path: string[]) => {
		// path = ["model", "gpt-4o"] -> modelId = "gpt-4o"
		const modelId = path[path.length - 1];
		if (!modelId) {
			return {
				type: "error" as const,
				message: t("commandHandler.unknownCommand"),
			};
		}

		const model = getModelById(modelId);
		if (!model) {
			return {
				type: "error" as const,
				message: t("commandHandler.unknownCommand"),
			};
		}

		// 保存到配置
		setCurrentModelId(modelId);

		// 清除命令缓存，更新显示
		clearCommandCache();

		// 构建成功消息
		const capabilities: string[] = [];
		if (model.supportsTools) capabilities.push("tools");

		const content =
			t("commandHandler.modelSwitched", {
				model: `**${model.name}** (${model.model})`,
			}) +
			`\n\n${t("commandHandler.modelCapabilities")}: ${capabilities.join(", ") || "none"}\n${t("commandHandler.modelProtocol")}: ${model.protocol}`;

		// 返回 callback_with_message，触发 AI 服务重建并显示消息
		return {
			type: "callback_with_message" as const,
			callback: "recreate_ai_service" as const,
			content,
		};
	},

	// 语言切换处理器
	language_en: () => {
		setLocale("en");
		return {
			type: "message" as const,
			content: t("commandHandler.languageSwitched", { language: "English" }),
		};
	},

	"language_zh-CN": () => {
		setLocale("zh-CN");
		return {
			type: "message" as const,
			content: t("commandHandler.languageSwitched", { language: "简体中文" }),
		};
	},

	language_ja: () => {
		setLocale("ja");
		return {
			type: "message" as const,
			content: t("commandHandler.languageSwitched", { language: "日本語" }),
		};
	},

	// AI 建议开关处理器
	suggestion_on: () => {
		setSuggestionEnabled(true);
		clearCommandCache();
		return {
			type: "message" as const,
			content: t("commandHandler.suggestionEnabled"),
		};
	},

	suggestion_off: () => {
		setSuggestionEnabled(false);
		clearCommandCache();
		return {
			type: "message" as const,
			content: t("commandHandler.suggestionDisabled"),
		};
	},

	// AI 建议模型选择处理器
	suggestion_model_select: (path: string[]) => {
		// path = ["suggestion", "model", "<model-id>"]
		const modelId = path[path.length - 1];
		if (!modelId) {
			return {
				type: "error" as const,
				message: t("commandHandler.unknownCommand"),
			};
		}

		const model = getModelById(modelId);
		if (!model) {
			return {
				type: "error" as const,
				message: t("commandHandler.unknownCommand"),
			};
		}

		// 保存到配置
		setSuggestionModelId(modelId);
		clearCommandCache();

		return {
			type: "message" as const,
			content: t("commandHandler.suggestionModelSwitched", {
				model: model.name,
			}),
		};
	},

	// AI 思考模式开关处理器
	thinking_on: () => {
		setThinkingEnabled(true);
		clearCommandCache();
		return {
			type: "message" as const,
			content: t("commandHandler.thinkingEnabled"),
		};
	},

	thinking_off: () => {
		setThinkingEnabled(false);
		clearCommandCache();
		return {
			type: "message" as const,
			content: t("commandHandler.thinkingDisabled"),
		};
	},

	// Plan mode handlers
	// 使用 callback_with_message + recreate_ai_service 确保下一条消息使用新的 system prompt
	plan_on: () => {
		setPlanModeEnabled(true);
		clearCommandCache();
		return {
			type: "callback_with_message" as const,
			callback: "recreate_ai_service" as const,
			content: t("commandHandler.planEnabled"),
		};
	},

	plan_off: () => {
		setPlanModeEnabled(false);
		clearCommandCache();
		return {
			type: "callback_with_message" as const,
			callback: "recreate_ai_service" as const,
			content: t("commandHandler.planDisabled"),
		};
	},
};

/**
 * 根据命令路径查找对应的 SlashCommand
 */
export function findCommandByPath(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): SlashCommand | null {
	if (path.length === 0) return null;

	const [first, ...rest] = path;
	const cmd = commands.find((c) => c.name === first);

	if (!cmd) return null;
	if (rest.length === 0) return cmd;
	if (!cmd.children) return null;

	return findCommandByPath(rest, cmd.children);
}

/**
 * 获取命令的 action，支持继承父级 action
 */
export function getCommandAction(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandAction | null {
	const cmd = findCommandByPath(path, commands);
	return cmd?.action ?? null;
}

/**
 * 执行命令（内部）
 */
function executeCommandInternal(
	path: string[],
	context: CommandContext,
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandResult {
	if (path.length === 0) {
		return { type: "error", message: "Empty command path" };
	}

	const action = getCommandAction(path, commands);

	if (!action) {
		// 没有 action 的命令（可能是分支节点）
		return {
			type: "error",
			message: `Command /${path.join(" ")} has no action`,
		};
	}

	switch (action.type) {
		case "internal": {
			const handler = action.handler ? internalHandlers[action.handler] : null;
			if (!handler) {
				return {
					type: "error",
					message: `Unknown internal handler: ${action.handler}`,
				};
			}
			return handler(path, context);
		}

		case "prompt": {
			return {
				type: "prompt",
				content: action.template,
			};
		}

		case "config": {
			// 对于 model 命令，value 是完整路径（如 "openai gpt-4o"）
			const value = path.slice(1).join(" ");
			return {
				type: "config",
				key: action.key,
				value,
			};
		}

		default:
			return { type: "error", message: "Unknown action type" };
	}
}

/**
 * 执行命令并调用对应的回调
 */
export async function handleCommand(
	path: string[],
	context: CommandContext,
	callbacks: CommandCallbacks,
	commands: SlashCommand[] = SLASH_COMMANDS,
): Promise<void> {
	const result = executeCommandInternal(path, context, commands);

	switch (result.type) {
		case "message":
			callbacks.showMessage(result.content);
			break;

		case "prompt":
			callbacks.sendToAI(result.content);
			break;

		case "config":
			callbacks.setConfig(result.key, result.value);
			break;

		case "action":
			if (result.action === "exit") {
				callbacks.exit();
			}
			break;

		case "async":
			try {
				const content = await result.handler();
				callbacks.showMessage(content);
			} catch (err) {
				callbacks.showMessage(
					`Error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			break;

		case "callback":
			if (result.callback === "compact") {
				await callbacks.compact();
			} else if (result.callback === "stop") {
				callbacks.stop();
			} else if (result.callback === "recreate_ai_service") {
				callbacks.recreateAIService();
			} else if (result.callback === "session_new") {
				// 先停止当前处理，再创建新 session
				callbacks.stop();
				await callbacks.sessionNew();
			} else if (result.callback === "sessionClear") {
				// 先停止当前处理，再清除所有 session 并创建新的
				callbacks.stop();
				await callbacks.sessionClear();
			}
			break;

		case "callback_with_message":
			if (result.callback === "recreate_ai_service") {
				callbacks.recreateAIService();
			}
			callbacks.showMessage(result.content);
			break;

		case "callback_with_param":
			if (result.callback === "session_switch") {
				callbacks.stop();
				await callbacks.sessionSwitch(result.param);
			} else if (result.callback === "session_delete") {
				callbacks.sessionDelete(result.param);
			}
			break;

		case "error":
			callbacks.showMessage(`Error: ${result.message}`);
			break;
	}
}
