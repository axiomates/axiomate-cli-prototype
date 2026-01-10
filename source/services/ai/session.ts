/**
 * Session 管理
 * 追踪对话会话的 token 使用情况，管理上下文空间
 */

import type {
	ChatMessage,
	SessionStatus,
	CompactCheckResult,
} from "./types.js";
import { estimateTokens } from "./tokenEstimator.js";

// 重新导出类型以便其他模块使用
export type { SessionStatus, CompactCheckResult } from "./types.js";

/**
 * Token 使用统计（来自 API 响应）
 */
export type TokenUsage = {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
};

/**
 * 消息条目（带 token 信息）
 */
export type SessionMessage = {
	/** 消息内容 */
	message: ChatMessage;
	/** 该消息的 token 数（估算或实际） */
	tokens: number;
	/** 是否为实际值（来自 API） */
	isActual: boolean;
	/** 时间戳 */
	timestamp: number;
};

/**
 * Session 配置
 */
export type SessionConfig = {
	/** 上下文窗口大小 */
	contextWindow: number;
	/** 预留给响应的 token 比例 (0-1)，默认 0.25 */
	reserveRatio?: number;
	/** 接近上限的阈值 (0-1)，默认 0.8 */
	nearLimitThreshold?: number;
	/** 已满的阈值 (0-1)，默认 0.95 */
	fullThreshold?: number;
};

/**
 * Session 检查点（用于回滚）
 */
export type SessionCheckpoint = {
	/** 消息数组的长度（用于截断恢复） */
	messageCount: number;
	/** 实际 prompt tokens */
	actualPromptTokens: number;
	/** 实际 completion tokens */
	actualCompletionTokens: number;
};

/**
 * Session 内部状态（用于序列化）
 */
export type SessionInternalState = {
	messages: SessionMessage[];
	systemPrompt: SessionMessage | null;
	actualPromptTokens: number;
	actualCompletionTokens: number;
};

/**
 * Session 类
 * 管理单个对话会话的 token 追踪和历史管理
 */
export class Session {
	private messages: SessionMessage[] = [];
	private systemPrompt: SessionMessage | null = null;
	private config: Required<SessionConfig>;

	// 累计的实际 token 使用（来自 API）
	private actualPromptTokens: number = 0;
	private actualCompletionTokens: number = 0;

	// 工具定义的 token 估算
	private toolsTokenEstimate: number = 0;

	constructor(config: SessionConfig) {
		this.config = {
			contextWindow: config.contextWindow,
			// reserveRatio 设为 0，因为 compact 阈值（85%）已经提供了缓冲空间
			// 不需要在 getAvailableTokens 中额外预留
			reserveRatio: config.reserveRatio ?? 0,
			nearLimitThreshold: config.nearLimitThreshold ?? 0.8,
			fullThreshold: config.fullThreshold ?? 0.95,
		};
	}

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void {
		if (!prompt) {
			this.systemPrompt = null;
			return;
		}

		this.systemPrompt = {
			message: { role: "system", content: prompt },
			tokens: estimateTokens(prompt),
			isActual: false,
			timestamp: Date.now(),
		};
	}

	/**
	 * 设置工具定义的 token 估算
	 * 在每次 API 调用前调用此方法
	 */
	setToolsTokenEstimate(tokens: number): void {
		this.toolsTokenEstimate = tokens;
	}

	/**
	 * 获取工具定义的 token 估算
	 */
	getToolsTokenEstimate(): number {
		return this.toolsTokenEstimate;
	}

	/**
	 * 添加用户消息
	 * @param content 发送给 AI 的完整内容（可能包含文件内容）
	 * @param displayContent 可选，显示给用户的原始内容（不含文件内容）
	 */
	addUserMessage(content: string, displayContent?: string): void {
		this.messages.push({
			message: { role: "user", content, displayContent },
			tokens: estimateTokens(content),
			isActual: false,
			timestamp: Date.now(),
		});
	}

	/**
	 * 添加助手消息（带可选的 usage 信息）
	 */
	addAssistantMessage(message: ChatMessage, usage?: TokenUsage): void {
		// 如果有 usage 信息，更新实际 token 计数
		if (usage) {
			this.actualPromptTokens = usage.prompt_tokens;
			this.actualCompletionTokens += usage.completion_tokens;

			// 用实际值校正估算值
			this.calibrateEstimates(usage);
		}

		this.messages.push({
			message,
			tokens: usage?.completion_tokens ?? estimateTokens(message.content),
			isActual: !!usage,
			timestamp: Date.now(),
		});
	}

	/**
	 * 添加工具消息
	 */
	addToolMessage(message: ChatMessage): void {
		this.messages.push({
			message,
			tokens: estimateTokens(message.content),
			isActual: false,
			timestamp: Date.now(),
		});
	}

	/**
	 * 根据 API 返回的 usage 校正估算值
	 * 比较估算值和实际值，记录偏差以供调试
	 */
	private calibrateEstimates(usage: TokenUsage): void {
		const estimatedTotal = this.getEstimatedTotalTokens();
		const actualTotal = usage.prompt_tokens;

		// 避免除零
		if (actualTotal === 0) {
			return;
		}

		// const deviation = Math.abs(estimatedTotal - actualTotal) / actualTotal;
		// if (deviation > 0.2) {
			// 计算不含工具的消息估算（用于更精细的调试）
			// const estimatedMessages = estimatedTotal - this.toolsTokenEstimate;
		// }
	}

	/**
	 * 获取估算的总 token 数（包含工具定义）
	 */
	private getEstimatedTotalTokens(): number {
		// 包含工具定义的 token
		let total = this.toolsTokenEstimate;

		if (this.systemPrompt) {
			total += this.systemPrompt.tokens;
		}

		for (const msg of this.messages) {
			total += msg.tokens;
		}

		return total;
	}

	/**
	 * 获取已使用的 token 数
	 * 优先使用 API 返回的实际值
	 */
	getUsedTokens(): number {
		const estimatedTotal = this.getEstimatedTotalTokens();

		// 如果有实际值，使用实际值
		if (this.actualPromptTokens > 0) {
			return this.actualPromptTokens + this.actualCompletionTokens;
		}

		// 否则使用估算值
		return estimatedTotal;
	}

	/**
	 * 获取可用于新消息的 token 数
	 */
	getAvailableTokens(): number {
		const reserved = Math.floor(
			this.config.contextWindow * this.config.reserveRatio,
		);
		const used = this.getUsedTokens();
		return Math.max(0, this.config.contextWindow - used - reserved);
	}

	/**
	 * 获取 Session 状态
	 */
	getStatus(): SessionStatus {
		const usedTokens = this.getUsedTokens();
		const availableTokens = this.getAvailableTokens();
		const usagePercent = (usedTokens / this.config.contextWindow) * 100;

		return {
			usedTokens,
			availableTokens,
			usagePercent,
			isNearLimit: usagePercent >= this.config.nearLimitThreshold * 100,
			isFull: usagePercent >= this.config.fullThreshold * 100,
			messageCount: this.messages.length,
		};
	}

	/**
	 * 获取用于发送的消息列表
	 */
	getMessages(): ChatMessage[] {
		const result: ChatMessage[] = [];

		if (this.systemPrompt) {
			result.push(this.systemPrompt.message);
		}

		for (const msg of this.messages) {
			result.push(msg.message);
		}

		return result;
	}

	/**
	 * 获取历史消息（不含系统提示）
	 */
	getHistory(): ChatMessage[] {
		return this.messages.map((m) => m.message);
	}

	/**
	 * 清空会话（同时清空系统提示词，延迟到首次消息时设置）
	 */
	clear(): void {
		this.messages = [];
		this.actualPromptTokens = 0;
		this.actualCompletionTokens = 0;
		this.systemPrompt = null;
	}

	/**
	 * 检查是否需要 compact
	 * 基于当前使用情况和预计的新消息大小判断
	 *
	 * @param estimatedNewTokens 预计新消息的 token 数
	 * @param compactThreshold compact 触发阈值 (0-1)，默认 0.85
	 * @returns CompactCheckResult
	 */
	shouldCompact(
		estimatedNewTokens: number = 0,
		compactThreshold: number = 0.85,
	): CompactCheckResult {
		const usedTokens = this.getUsedTokens();
		const contextWindow = this.config.contextWindow;
		const usagePercent = (usedTokens / contextWindow) * 100;

		// 预计添加新消息后的使用量
		const projectedTokens = usedTokens + estimatedNewTokens;
		const projectedPercent = (projectedTokens / contextWindow) * 100;

		// 统计真正的对话消息数（排除 compact summary）
		// compact summary 以 "[Previous conversation summary]" 开头
		const realMessageCount = this.messages.filter(
			(m) => !m.message.content.startsWith("[Previous conversation summary]"),
		).length;

		// 需要 compact 的条件：
		// 1. 预计使用量超过阈值
		// 2. 必须有真实的对话历史（至少 2 条真实消息，即 1 轮完整对话）
		//    这样可以防止：
		//    - 首次发送大文件时误触发（此时没有历史可总结）
		//    - compact 后立即再次触发（此时只有 summary）
		const shouldCompact =
			projectedPercent >= compactThreshold * 100 && realMessageCount >= 2;

		// 上下文已满：预计使用量超过 100%
		const isContextFull = projectedPercent >= 100;

		return {
			shouldCompact,
			usagePercent,
			projectedPercent,
			messageCount: this.messages.length,
			realMessageCount,
			isContextFull,
		};
	}

	/**
	 * 使用总结内容重置会话
	 * 清空所有历史消息，将总结作为新的上下文基础
	 *
	 * @param summary AI 生成的对话总结
	 */
	compactWith(summary: string): void {
		// 清空所有消息
		this.messages = [];
		this.actualPromptTokens = 0;
		this.actualCompletionTokens = 0;

		// 将总结作为系统消息的一部分，或作为第一条 assistant 消息
		// 这里选择作为 assistant 消息，表示"之前的对话总结"
		this.messages.push({
			message: {
				role: "assistant",
				content: `[Previous conversation summary]\n${summary}`,
			},
			tokens: estimateTokens(summary) + 30, // 额外计算前缀的 token
			isActual: false,
			timestamp: Date.now(),
		});
	}

	/**
	 * 获取配置
	 */
	getConfig(): Required<SessionConfig> {
		return { ...this.config };
	}

	/**
	 * 更新上下文窗口大小（模型切换时）
	 */
	updateContextWindow(contextWindow: number): void {
		this.config.contextWindow = contextWindow;
	}

	/**
	 * 创建检查点（在发送请求前调用）
	 * 用于在请求被中止时回滚到此状态
	 */
	checkpoint(): SessionCheckpoint {
		return {
			messageCount: this.messages.length,
			actualPromptTokens: this.actualPromptTokens,
			actualCompletionTokens: this.actualCompletionTokens,
		};
	}

	/**
	 * 回滚到检查点（在请求被中止时调用）
	 * 移除检查点之后添加的所有消息
	 */
	rollback(checkpoint: SessionCheckpoint): void {
		// 截断消息数组到检查点时的长度
		if (this.messages.length > checkpoint.messageCount) {
			this.messages.length = checkpoint.messageCount;
		}
		// 恢复 token 计数
		this.actualPromptTokens = checkpoint.actualPromptTokens;
		this.actualCompletionTokens = checkpoint.actualCompletionTokens;
	}

	/**
	 * 验证消息序列的有效性
	 * 检查 tool_calls 和 tool results 是否配对
	 * @returns 验证结果，包含是否有效和错误信息
	 */
	validateMessages(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		const pendingToolCalls = new Map<string, number>(); // tool_call_id -> message index

		for (let i = 0; i < this.messages.length; i++) {
			const msg = this.messages[i]!.message;

			// 记录 tool_calls
			if (msg.role === "assistant" && msg.tool_calls) {
				for (const tc of msg.tool_calls) {
					pendingToolCalls.set(tc.id, i);
				}
			}

			// 匹配 tool results
			if (msg.role === "tool" && msg.tool_call_id) {
				if (pendingToolCalls.has(msg.tool_call_id)) {
					pendingToolCalls.delete(msg.tool_call_id);
				} else {
					errors.push(
						`Orphan tool result at index ${i}: tool_call_id=${msg.tool_call_id} has no matching tool_call`,
					);
				}
			}
		}

		// 检查未匹配的 tool_calls
		for (const [toolCallId, msgIndex] of pendingToolCalls) {
			errors.push(
				`Orphan tool_call at index ${msgIndex}: tool_call_id=${toolCallId} has no matching result`,
			);
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * 获取内部状态（用于序列化）
	 */
	getInternalState(): SessionInternalState {
		return {
			messages: [...this.messages],
			systemPrompt: this.systemPrompt,
			actualPromptTokens: this.actualPromptTokens,
			actualCompletionTokens: this.actualCompletionTokens,
		};
	}

	/**
	 * 从序列化状态恢复
	 */
	restoreFromState(state: SessionInternalState): void {
		this.messages = [...state.messages];
		this.systemPrompt = state.systemPrompt;
		this.actualPromptTokens = state.actualPromptTokens;
		this.actualCompletionTokens = state.actualCompletionTokens;
	}

	/**
	 * 修复消息序列
	 * 移除未配对的 tool_calls 和 tool results
	 * @returns 移除的消息数量
	 */
	repairMessages(): number {
		const validation = this.validateMessages();
		if (validation.valid) {
			return 0;
		}

		// 找出所有有效的 tool_call_id 对
		const validToolCallIds = new Set<string>();
		const toolCallIdToIndex = new Map<string, number>();

		// 第一遍：收集所有 tool_calls
		for (let i = 0; i < this.messages.length; i++) {
			const msg = this.messages[i]!.message;
			if (msg.role === "assistant" && msg.tool_calls) {
				for (const tc of msg.tool_calls) {
					toolCallIdToIndex.set(tc.id, i);
				}
			}
		}

		// 第二遍：标记有匹配结果的 tool_call_id
		for (const msg of this.messages) {
			if (msg.message.role === "tool" && msg.message.tool_call_id) {
				if (toolCallIdToIndex.has(msg.message.tool_call_id)) {
					validToolCallIds.add(msg.message.tool_call_id);
				}
			}
		}

		// 过滤消息
		const originalLength = this.messages.length;
		this.messages = this.messages.filter((sessionMsg) => {
			const msg = sessionMsg.message;

			// 移除没有匹配结果的 tool_calls（清理 assistant 消息中的 tool_calls）
			if (msg.role === "assistant" && msg.tool_calls) {
				const validCalls = msg.tool_calls.filter((tc) =>
					validToolCallIds.has(tc.id),
				);
				if (validCalls.length === 0) {
					// 移除所有 tool_calls
					delete msg.tool_calls;
				} else if (validCalls.length < msg.tool_calls.length) {
					// 只保留有效的 tool_calls
					msg.tool_calls = validCalls;
				}
			}

			// 移除没有匹配 tool_call 的 tool results
			if (msg.role === "tool" && msg.tool_call_id) {
				if (!validToolCallIds.has(msg.tool_call_id)) {
					return false; // 移除这条消息
				}
			}

			return true;
		});

		// 重置 token 计数（因为消息已改变）
		if (this.messages.length !== originalLength) {
			this.actualPromptTokens = 0;
			this.actualCompletionTokens = 0;
		}

		return originalLength - this.messages.length;
	}
}

/**
 * 创建 Session 实例
 */
export function createSession(config: SessionConfig): Session {
	return new Session(config);
}
