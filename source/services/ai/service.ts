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
	AskUserCallback,
} from "./types.js";
import type { IToolRegistry } from "../tools/types.js";
import type { IToolMatcher } from "./types.js";
import { toOpenAITools } from "./adapters/openai.js";
import { ToolCallHandler } from "./tool-call-handler.js";
import { ToolMatcher, detectProjectType } from "../tools/matcher.js";
import {
	Session,
	type SessionStatus,
	type CompactCheckResult,
} from "./session.js";
import { buildSystemPrompt } from "../../constants/prompts.js";
import { t } from "../../i18n/index.js";
import { isPlanModeEnabled } from "../../utils/config.js";

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

		// 创建 Session（system prompt 延迟到首次消息时设置）
		this.session = new Session({
			contextWindow: config.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
		});
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
	 * 清空对话历史（system prompt 延迟到首次消息时设置）
	 */
	clearHistory(): void {
		this.session.clear();
		// 重置上下文注入标志，下次消息会重新注入
		this.contextInjected = false;
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
		// 清空持久化的 system prompt，统一延迟到首次消息时设置
		this.session.setSystemPrompt("");
		this.contextInjected = false;
	}

	/**
	 * 保存不完整的 assistant 消息到 session（用于 stop 时保存部分回复）
	 * @param content 部分回复内容
	 */
	savePartialResponse(content: string): void {
		if (!content || content.trim() === "") {
			return; // 不保存空内容
		}
		// 添加不完整的 assistant 消息（添加标记说明是被中断的）
		this.session.addAssistantMessage({
			role: "assistant",
			content: content + "\n\n[Response interrupted]",
		});
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

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 使用本地上下文匹配选择工具
		const result = await this.contextAwareChat(userMessage, enhancedContext);

		return {
			content: result.content,
			sessionStatus: this.session.getStatus(),
		};
	}

	/**
	 * 流式发送消息（实时返回生成内容）
	 * @param userMessage 用户消息
	 * @param context 上下文信息
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal 和 planMode）
	 * @param onAskUser 可选的 ask_user 回调，用于暂停执行等待用户输入
	 */
	async streamMessage(
		userMessage: string,
		context?: MatchContext,
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
		onAskUser?: AskUserCallback,
	): Promise<string> {
		// 增强上下文
		const enhancedContext = this.enhanceContext(context);

		// Extract planMode from options (default false)
		const initialPlanMode = options?.planMode ?? false;

		// 确保上下文已注入到 System Prompt
		this.ensureContextInSystemPrompt(enhancedContext, initialPlanMode);

		// 创建检查点（在添加用户消息前）
		const checkpoint = this.session.checkpoint();

		// 添加用户消息到 Session
		this.session.addUserMessage(userMessage);

		// 获取相关工具 (plan mode only gets plan tool)
		const tools = this.getContextTools(enhancedContext, initialPlanMode);

		// 通知流式开始
		callbacks?.onStart?.();

		try {
			// 使用流式 API
			// 传入 context 以支持动态工具刷新（当 plan mode 切换时）
			const result = await this.streamChatWithTools(
				tools,
				enhancedContext,
				callbacks,
				options,
				onAskUser,
			);

			return result;
		} catch (error) {
			// 如果是中止错误（用户执行了 /stop），不回滚 session
			// 保留用户消息，让 onStopped 回调添加部分 AI 回复
			if (error instanceof Error && error.name === "AbortError") {
				// 不回滚，直接抛出错误让上层处理
				throw error;
			}
			// 其他错误回滚 session 状态
			this.session.rollback(checkpoint);
			throw error;
		}
	}

	/**
	 * 确保上下文已注入到 System Prompt（仅首次调用时生效）
	 * @param planMode Whether plan mode is enabled (from snapshot)
	 */
	private ensureContextInSystemPrompt(
		context: MatchContext,
		planMode: boolean = false,
	): void {
		if (this.contextInjected) return;

		// 构建带上下文的 System Prompt
		const prompt = buildSystemPrompt(
			context.cwd,
			context.projectType,
			planMode,
		);
		this.session.setSystemPrompt(prompt);
		this.contextInjected = true;
	}

	/**
	 * 获取上下文相关工具
	 * @param planMode Whether plan mode is enabled (from snapshot)
	 */
	private getContextTools(
		context: MatchContext,
		planMode: boolean = false,
	): OpenAITool[] {
		// Plan mode: only plan tool is available
		if (planMode) {
			const planTool = this.registry.getTool("plan");
			if (planTool && planTool.installed) {
				return toOpenAITools([planTool]);
			}
			return [];
		}

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
	 * 流式对话（支持工具调用和动态工具刷新）
	 * @param initialTools 初始工具列表
	 * @param context 上下文信息（用于动态刷新工具）
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal）
	 * @param onAskUser 可选的 ask_user 回调
	 */
	private async streamChatWithTools(
		initialTools: OpenAITool[],
		context: MatchContext,
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
		onAskUser?: AskUserCallback,
	): Promise<string> {
		// 当前使用的工具列表（可能会动态更新）
		let tools = initialTools;
		// 跟踪当前 plan mode 状态
		let currentPlanMode = options?.planMode ?? false;

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
		// 跟踪总内容（跨工具调用轮次）
		let totalContent = "";

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
					// 发送总内容（包含之前轮次的内容）
					callbacks?.onChunk?.({
						reasoning: reasoningContent,
						content: totalContent + fullContent,
					});
				}

				// 检查是否需要执行工具
				if (
					chunk.finish_reason === "tool_calls" &&
					chunk.delta.tool_calls &&
					chunk.delta.tool_calls.length > 0
				) {
					// 添加 assistant 消息到 Session（包含思考内容以支持 askuser 持久化）
					const assistantMessage: ChatMessage = {
						role: "assistant",
						content: fullContent,
						reasoning_content: reasoningContent || undefined,
						tool_calls: chunk.delta.tool_calls,
					};
					this.session.addAssistantMessage(assistantMessage);
					messages.push(assistantMessage);

					// 累积本轮内容到总内容
					if (fullContent) {
						totalContent += fullContent + "\n";
					}

					// 执行工具调用（传递 onAskUser 回调）
					const toolResults = await this.toolCallHandler.handleToolCalls(
						chunk.delta.tool_calls,
						onAskUser,
					);

					// 添加工具结果到 Session 和消息
					for (const result of toolResults) {
						this.session.addToolMessage(result);
						messages.push(result);
					}

					// 检查 plan mode 是否发生变化，如果变化则刷新工具列表和 system prompt
					const newPlanMode = isPlanModeEnabled();
					if (newPlanMode !== currentPlanMode) {
						currentPlanMode = newPlanMode;
						// 动态刷新工具列表
						tools = this.getContextTools(context, currentPlanMode);
						// 动态更新 system prompt（让 AI 看到新模式的指导）
						const newPrompt = buildSystemPrompt(
							context.cwd,
							context.projectType,
							currentPlanMode,
						);
						this.session.setSystemPrompt(newPrompt);
						// 同时更新 messages 数组的第一个元素（system prompt）
						// 因为 messages 是快照，需要手动同步
						if (messages.length > 0 && messages[0]?.role === "system") {
							messages[0] = { role: "system", content: newPrompt };
						}
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
					const finalContent = totalContent + fullContent;
					this.session.addAssistantMessage({
						role: "assistant",
						content: fullContent,
						reasoning_content: reasoningContent || undefined,
					});
					callbacks?.onEnd?.({
						reasoning: reasoningContent,
						content: finalContent,
					});
					return finalContent;
				}
			}

			// 如果是因为工具调用而 break，继续下一轮循环让 AI 看到工具结果
			if (brokeForToolCall) {
				// 不调用 onStart，因为我们在同一个消息中累积内容
				continue;
			}

			// 如果 for 循环正常结束（不是因为工具调用），说明流已经结束
			if (fullContent || reasoningContent || totalContent) {
				const finalContent = totalContent + fullContent;
				this.session.addAssistantMessage({
					role: "assistant",
					content: fullContent,
					reasoning_content: reasoningContent || undefined,
				});
				callbacks?.onEnd?.({
					reasoning: reasoningContent,
					content: finalContent,
				});
				return finalContent;
			}

			// 流正常结束但没有内容，返回空
			callbacks?.onEnd?.({ reasoning: "", content: totalContent || "" });
			return totalContent || "";
		}

		// 达到最大轮数
		const maxToolCallsMsg = t("errors.maxToolCallsReached");
		const finalContent = totalContent + fullContent;
		callbacks?.onEnd?.({
			reasoning: reasoningContent,
			content: finalContent || maxToolCallsMsg,
		});
		return finalContent || maxToolCallsMsg;
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
			};
		}

		// 达到最大轮数
		return {
			content: t("errors.maxToolCallsReached"),
			sessionStatus: this.session.getStatus(),
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
