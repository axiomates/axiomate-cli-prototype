/**
 * AI 服务
 * 实现上下文感知 + 工具调用循环
 * 使用本地目录分析自动选择工具（不使用两阶段 AI 调用）
 * 使用 Session 管理对话历史和 token 追踪
 */

import type {
	IAIService,
	IAIClient,
	AIServiceConfig,
	ChatMessage,
	MatchContext,
	OpenAITool,
	StreamCallbacks,
	StreamOptions,
} from "./types.js";
import type { IToolRegistry } from "../tools/types.js";
import type { IToolMatcher } from "./types.js";
import { toOpenAITools } from "./adapters/openai.js";
import { ToolCallHandler } from "./tool-call-handler.js";
import { ToolMatcher, detectProjectType } from "../tools/matcher.js";
import {
	Session,
	type SessionStatus,
	type TrimResult,
	type CompactCheckResult,
} from "./session.js";
import { buildSystemPrompt, SYSTEM_PROMPT } from "../../constants/prompts.js";

/**
 * 默认上下文窗口大小
 */
const DEFAULT_CONTEXT_WINDOW = 32768;

/**
 * 发送消息的结果
 */
export type SendMessageResult = {
	/** 响应内容 */
	content: string;
	/** Session 状态 */
	sessionStatus: SessionStatus;
	/** 是否进行了历史裁剪 */
	historyTrimmed: boolean;
	/** 裁剪详情（如果有裁剪） */
	trimResult?: TrimResult;
};

/**
 * AI 服务实现
 */
export class AIService implements IAIService {
	private client: IAIClient;
	private registry: IToolRegistry;
	private matcher: IToolMatcher;
	private toolCallHandler: ToolCallHandler;
	private session: Session;

	private maxToolCallRounds: number;
	private contextAwareEnabled: boolean;
	private contextInjected: boolean = false;

	constructor(config: AIServiceConfig, registry: IToolRegistry) {
		this.client = config.client;
		this.registry = registry;
		this.matcher = new ToolMatcher(registry);
		this.toolCallHandler = new ToolCallHandler(registry);

		this.maxToolCallRounds = config.maxToolCallRounds ?? 40;
		this.contextAwareEnabled = config.contextAwareEnabled ?? true;

		// 创建 Session
		this.session = new Session({
			contextWindow: config.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
		});

		// 设置 System Prompt
		this.session.setSystemPrompt(SYSTEM_PROMPT);
	}

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void {
		this.session.setSystemPrompt(prompt);
	}

	/**
	 * 获取对话历史
	 */
	getHistory(): ChatMessage[] {
		return this.session.getHistory();
	}

	/**
	 * 清空对话历史（新 session 自动重新设置 system prompt）
	 */
	clearHistory(): void {
		this.session.clear();
		// 重置上下文注入标志，下次消息会重新注入
		this.contextInjected = false;
		// 重新设置 System Prompt，确保新 session 也有
		this.session.setSystemPrompt(SYSTEM_PROMPT);
	}

	/**
	 * 获取上下文窗口大小
	 */
	getContextWindow(): number {
		return this.session.getConfig().contextWindow;
	}

	/**
	 * 获取 Session 状态
	 */
	getSessionStatus(): SessionStatus {
		return this.session.getStatus();
	}

	/**
	 * 获取可用于新消息的 token 数
	 */
	getAvailableTokens(): number {
		return this.session.getAvailableTokens();
	}

	/**
	 * 检查是否需要 compact
	 */
	shouldCompact(estimatedNewTokens: number = 0): CompactCheckResult {
		return this.session.shouldCompact(estimatedNewTokens);
	}

	/**
	 * 使用总结内容重置会话
	 */
	compactWith(summary: string): void {
		this.session.compactWith(summary);
	}

	/**
	 * 获取当前 Session 实例（用于保存）
	 */
	getSession(): Session {
		return this.session;
	}

	/**
	 * 从已加载的 Session 恢复状态
	 * @param session 已加载的 Session 实例
	 */
	restoreSession(session: Session): void {
		this.session = session;
		// 重置上下文注入标志，因为加载的 session 可能有不同的 system prompt
		this.contextInjected = false;
	}

	/**
	 * 发送消息并获取响应
	 * 注意：不再自动裁剪历史，改为在 app.tsx 中检查 shouldCompact 并触发 compact
	 */
	async sendMessage(
		userMessage: string,
		context?: MatchContext,
	): Promise<string> {
		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 确保上下文已注入到 System Prompt
		this.ensureContextInSystemPrompt(enhancedContext);

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 使用本地上下文匹配选择工具
		const result = await this.contextAwareChat(userMessage, enhancedContext);

		return result.content;
	}

	/**
	 * 发送消息并获取详细结果（包含 Session 状态）
	 */
	async sendMessageWithStatus(
		userMessage: string,
		context?: MatchContext,
	): Promise<SendMessageResult> {
		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 确保上下文已注入到 System Prompt
		this.ensureContextInSystemPrompt(enhancedContext);

		// 检查是否需要先裁剪历史
		const estimatedTokens = userMessage.length / 4; // 粗略估算
		let trimResult: TrimResult | undefined;

		if (!this.session.canAccommodate(estimatedTokens)) {
			trimResult = this.session.ensureSpace(estimatedTokens);
		}

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 使用本地上下文匹配选择工具
		const result = await this.contextAwareChat(userMessage, enhancedContext);

		return {
			content: result.content,
			sessionStatus: this.session.getStatus(),
			historyTrimmed: trimResult?.trimmed ?? false,
			trimResult,
		};
	}

	/**
	 * 流式发送消息（实时返回生成内容）
	 * @param userMessage 用户消息
	 * @param context 上下文信息
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal）
	 */
	async streamMessage(
		userMessage: string,
		context?: MatchContext,
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
	): Promise<string> {
		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// 确保上下文已注入到 System Prompt
		this.ensureContextInSystemPrompt(enhancedContext);

		// 创建检查点（在添加用户消息前）
		const checkpoint = this.session.checkpoint();

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 获取相关工具
		const tools = this.getContextTools(enhancedContext);

		// 通知流式开始
		callbacks?.onStart?.();

		try {
			// 使用流式 API
			// 注意：streamChatWithTools 内部已经调用了 onEnd，这里不需要重复调用
			const result = await this.streamChatWithTools(tools, callbacks, options);

			return result;
		} catch (error) {
			// 如果是中止错误，回滚 session 状态
			if (error instanceof Error && error.name === "AbortError") {
				this.session.rollback(checkpoint);
			}
			throw error;
		}
	}

	/**
	 * 确保上下文已注入到 System Prompt（仅首次调用时生效）
	 */
	private ensureContextInSystemPrompt(context: MatchContext): void {
		if (this.contextInjected) return;

		// 构建带上下文的 System Prompt
		const prompt = buildSystemPrompt(context.cwd, context.projectType);
		this.session.setSystemPrompt(prompt);
		this.contextInjected = true;
	}

	/**
	 * 获取上下文相关工具
	 */
	private getContextTools(context: MatchContext): OpenAITool[] {
		if (!this.contextAwareEnabled) {
			return [];
		}

		// 1. 根据项目类型和文件自动选择工具
		const autoSelectedTools = this.matcher.autoSelect(context);

		// 2. 根据用户消息关键词匹配工具（使用 cwd 作为 query 的一部分不太合适，暂时跳过）
		// 可以从 session 获取最后一条用户消息
		const history = this.session.getHistory();
		const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
		const queryMatches = lastUserMsg
			? this.matcher.match(lastUserMsg.content, context)
			: [];

		// 3. 合并工具，去重
		const toolIds = new Set<string>();
		for (const tool of autoSelectedTools) {
			toolIds.add(tool.id);
		}
		for (const match of queryMatches.slice(0, 10)) {
			toolIds.add(match.tool.id);
		}

		// 4. 转换为 OpenAI 工具格式
		const filteredTools = Array.from(toolIds)
			.map((id) => this.registry.getTool(id))
			.filter(
				(t): t is NonNullable<typeof t> => t !== undefined && t.installed,
			);

		return toOpenAITools(filteredTools);
	}

	/**
	 * 流式对话（支持工具调用）
	 * @param tools 工具列表
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal）
	 */
	private async streamChatWithTools(
		tools: OpenAITool[],
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
	): Promise<string> {
		// 检查客户端是否支持流式
		if (!this.client.streamChat) {
			// 回退到非流式
			const result =
				tools.length > 0
					? await this.chatWithTools(tools)
					: await this.directChat();
			return result.content;
		}

		const messages = this.session.getMessages();
		let rounds = 0;
		// 分离累积：思考内容和正式内容
		let reasoningContent = "";
		let fullContent = "";

		while (rounds < this.maxToolCallRounds) {
			// 检查是否已被中止
			if (options?.signal?.aborted) {
				throw new DOMException("Request was aborted", "AbortError");
			}

			// 每轮重置正式内容（思考内容保留跨轮累积）
			fullContent = "";
			let brokeForToolCall = false;

			// 流式请求
			for await (const chunk of this.client.streamChat(
				messages,
				tools.length > 0 ? tools : undefined,
				options,
			)) {
				// 累积思考内容
				if (chunk.delta.reasoning_content) {
					reasoningContent += chunk.delta.reasoning_content;
				}
				// 累积正式内容
				if (chunk.delta.content) {
					fullContent += chunk.delta.content;
				}
				// 任何内容更新都触发回调
				if (chunk.delta.reasoning_content || chunk.delta.content) {
					callbacks?.onChunk?.({
						reasoning: reasoningContent,
						content: fullContent,
					});
				}

				// 检查是否需要执行工具
				if (
					chunk.finish_reason === "tool_calls" &&
					chunk.delta.tool_calls &&
					chunk.delta.tool_calls.length > 0
				) {
					// 添加 assistant 消息到 Session（只保存正式内容，思考内容不入 session）
					const assistantMessage: ChatMessage = {
						role: "assistant",
						content: fullContent,
						tool_calls: chunk.delta.tool_calls,
					};
					this.session.addAssistantMessage(assistantMessage);
					messages.push(assistantMessage);

					// 执行工具调用
					const toolResults = await this.toolCallHandler.handleToolCalls(
						chunk.delta.tool_calls,
					);

					// 添加工具结果到 Session 和消息
					for (const result of toolResults) {
						this.session.addToolMessage(result);
						messages.push(result);
					}

					rounds++;
					brokeForToolCall = true;
					break;
				}

				// 正常结束
				if (
					chunk.finish_reason === "stop" ||
					chunk.finish_reason === "eos" ||
					chunk.finish_reason === "length"
				) {
					this.session.addAssistantMessage({
						role: "assistant",
						content: fullContent,
					});
					callbacks?.onEnd?.({
						reasoning: reasoningContent,
						content: fullContent,
					});
					return fullContent;
				}
			}

			// 如果是因为工具调用而 break，继续下一轮循环让 AI 看到工具结果
			if (brokeForToolCall) {
				continue;
			}

			// 如果 for 循环正常结束（不是因为工具调用），说明流已经结束
			if (fullContent || reasoningContent) {
				this.session.addAssistantMessage({
					role: "assistant",
					content: fullContent,
				});
				callbacks?.onEnd?.({
					reasoning: reasoningContent,
					content: fullContent,
				});
				return fullContent;
			}

			// 流正常结束但没有内容，返回空
			callbacks?.onEnd?.({ reasoning: "", content: "" });
			return "";
		}

		// 达到最大轮数
		callbacks?.onEnd?.({
			reasoning: reasoningContent,
			content: fullContent || "已达到最大工具调用轮数限制。",
		});
		return fullContent || "已达到最大工具调用轮数限制。";
	}

	/**
	 * 增强上下文信息
	 */
	private enhanceContext(context?: MatchContext): MatchContext {
		const enhanced: MatchContext = { ...context };

		// 自动检测项目类型
		if (this.contextAwareEnabled && enhanced.cwd && !enhanced.projectType) {
			enhanced.projectType = detectProjectType(enhanced.cwd);
		}

		return enhanced;
	}

	/**
	 * 上下文感知的对话
	 * 使用本地目录分析自动选择工具，无需两阶段 AI 调用
	 */
	private async contextAwareChat(
		userMessage: string,
		context: MatchContext,
	): Promise<SendMessageResult> {
		// 获取相关工具
		let tools: OpenAITool[] = [];

		if (this.contextAwareEnabled) {
			// 1. 根据项目类型和文件自动选择工具
			const autoSelectedTools = this.matcher.autoSelect(context);

			// 2. 根据用户消息关键词匹配工具
			const queryMatches = this.matcher.match(userMessage, context);

			// 3. 合并工具，去重
			const toolIds = new Set<string>();
			for (const tool of autoSelectedTools) {
				toolIds.add(tool.id);
			}
			for (const match of queryMatches.slice(0, 10)) {
				toolIds.add(match.tool.id);
			}

			// 4. 转换为 OpenAI 工具格式
			const filteredTools = Array.from(toolIds)
				.map((id) => this.registry.getTool(id))
				.filter(
					(t): t is NonNullable<typeof t> => t !== undefined && t.installed,
				);

			tools = toOpenAITools(filteredTools);
		}

		// 如果有工具，带工具对话；否则直接对话
		if (tools.length > 0) {
			return this.chatWithTools(tools);
		}
		return this.directChat();
	}

	/**
	 * 直接对话（不带工具）
	 */
	private async directChat(): Promise<SendMessageResult> {
		const messages = this.session.getMessages();

		const response = await this.client.chat(messages);

		// 添加到 Session（带 usage 信息）
		this.session.addAssistantMessage(response.message, response.usage);

		return {
			content: response.message.content,
			sessionStatus: this.session.getStatus(),
			historyTrimmed: false,
		};
	}

	/**
	 * 带工具的对话
	 */
	private async chatWithTools(tools: OpenAITool[]): Promise<SendMessageResult> {
		const messages = this.session.getMessages();
		let rounds = 0;

		while (rounds < this.maxToolCallRounds) {
			const response = await this.client.chat(messages, tools);

			// 检查是否需要执行工具
			if (
				response.finish_reason === "tool_calls" &&
				response.message.tool_calls &&
				response.message.tool_calls.length > 0
			) {
				// 添加 assistant 消息到 Session
				this.session.addAssistantMessage(response.message, response.usage);
				messages.push(response.message);

				// 执行工具调用
				const toolResults = await this.toolCallHandler.handleToolCalls(
					response.message.tool_calls,
				);

				// 添加工具结果到 Session 和消息
				for (const result of toolResults) {
					this.session.addToolMessage(result);
					messages.push(result);
				}

				rounds++;
				continue;
			}

			// 没有工具调用，返回最终响应
			this.session.addAssistantMessage(response.message, response.usage);

			return {
				content: response.message.content,
				sessionStatus: this.session.getStatus(),
				historyTrimmed: false,
			};
		}

		// 达到最大轮数
		return {
			content: "已达到最大工具调用轮数限制。",
			sessionStatus: this.session.getStatus(),
			historyTrimmed: false,
		};
	}
}

/**
 * 创建 AI 服务
 */
export function createAIService(
	config: AIServiceConfig,
	registry: IToolRegistry,
): IAIService {
	return new AIService(config, registry);
}
