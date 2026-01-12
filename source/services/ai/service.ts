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
	ToolMaskState,
	IToolMatcher,
	ProjectType,
} from "./types.js";
import type { IToolRegistry, DiscoveredTool } from "../tools/types.js";
import { toOpenAITools } from "./adapters/openai.js";
import { ToolCallHandler } from "./tool-call-handler.js";
import { ToolMatcher, detectProjectType } from "../tools/matcher.js";
import {
	Session,
	type SessionStatus,
	type CompactCheckResult,
} from "./session.js";
import {
	buildSystemPrompt,
	buildModeReminder,
} from "../../constants/prompts.js";
import { estimateTokens } from "./tokenEstimator.js";
import { stableStringify } from "../../utils/json.js";
import { buildToolMask } from "./toolMask.js";
import {
	currentModelSupportsToolChoice,
	currentModelSupportsPrefill,
} from "../../utils/config.js";

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

	// 两阶段冻结的工具集
	private platformTools: DiscoveredTool[]; // 版本A
	private projectTools: DiscoveredTool[]; // 版本B
	private projectType: ProjectType | undefined; // 固定的项目类型

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

		// 初始化时检测并固定项目类型
		if (config.cwd) {
			this.projectType = detectProjectType(config.cwd);
		}

		// 冻结两个版本的工具集
		this.registry.freezePlatformTools();
		this.registry.freezeProjectTools(this.projectType);

		// 获取两个版本的工具
		this.platformTools = this.registry.getPlatformTools();
		this.projectTools = this.registry.getProjectTools();
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
		// 获取带有固定项目类型的上下文
		const enhancedContext = this.getContextWithProjectType(context);

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
		// 获取带有固定项目类型的上下文
		const enhancedContext = this.getContextWithProjectType(context);

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
	 * @param userMessage 用户消息（发送给 AI 的完整内容，可能包含文件内容）
	 * @param context 上下文信息
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal 和 planMode）
	 * @param onAskUser 可选的 ask_user 回调，用于暂停执行等待用户输入
	 * @param displayContent 可选，用户原始输入内容（不含文件内容，用于 UI 显示和会话恢复）
	 */
	async streamMessage(
		userMessage: string,
		context?: MatchContext,
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
		onAskUser?: AskUserCallback,
		displayContent?: string,
	): Promise<string> {
		// 获取带有固定项目类型的上下文
		const enhancedContext = this.getContextWithProjectType(context);

		// Extract planMode from options (default false)
		const initialPlanMode = options?.planMode ?? false;

		// 确保上下文已注入到 System Prompt
		this.ensureContextInSystemPrompt(enhancedContext);

		// 创建检查点（在添加用户消息前）
		const checkpoint = this.session.checkpoint();

		// 在用户消息前注入 mode reminder（用于 KV cache 优化）
		const modeReminder = buildModeReminder(initialPlanMode);
		const messageWithReminder = modeReminder + userMessage;

		// 添加用户消息到 Session（传递 displayContent 用于会话恢复时显示）
		this.session.addUserMessage(messageWithReminder, displayContent);

		// 工具相关计算（仅在模型支持工具时执行）
		let toolMask: ToolMaskState | undefined;
		let tools: OpenAITool[] = [];

		if (this.contextAwareEnabled) {
			// 判断工具来源：tool_choice/prefill 使用 platform，动态使用 project
			const supportsToolChoice = currentModelSupportsToolChoice();
			const supportsPrefill = currentModelSupportsPrefill();
			const toolSource =
				supportsToolChoice || supportsPrefill ? "platform" : "project";
			const availableTools =
				toolSource === "platform" ? this.platformTools : this.projectTools;

			// 构建工具遮蔽状态
			toolMask = buildToolMask(
				userMessage,
				this.projectType,
				initialPlanMode,
				toolSource,
				availableTools,
			);

			// 获取相关工具（根据 toolMask 决定是冻结列表还是动态过滤）
			tools = this.getContextTools(enhancedContext, toolMask);
		}

		// 将 toolMask 添加到 options 中
		const optionsWithMask: StreamOptions = {
			...options,
			toolMask,
		};

		// 通知流式开始
		callbacks?.onStart?.();

		try {
			// 使用流式 API
			const result = await this.streamChatWithTools(
				tools,
				enhancedContext,
				callbacks,
				optionsWithMask,
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
	 * Note: System prompt no longer includes planMode - it's now stable for KV cache optimization
	 * Mode information is communicated via <system-reminder> in user messages
	 */
	private ensureContextInSystemPrompt(context: MatchContext): void {
		if (this.contextInjected) return;

		// 构建带上下文的 System Prompt（不包含 planMode，保持稳定）
		// 根据模型能力决定是否包含工具相关说明
		const prompt = buildSystemPrompt(
			context.cwd,
			context.projectType,
			this.contextAwareEnabled,
		);
		this.session.setSystemPrompt(prompt);
		this.contextInjected = true;
	}

	/**
	 * 获取上下文相关工具
	 * 根据模型能力使用不同的工具集：
	 * - tool_choice/prefill 模式：使用版本A（平台工具集）
	 * - 动态模式：使用版本B（项目工具集） + 动态过滤
	 * @param context 上下文信息
	 * @param toolMask 工具遮蔽状态（可选）
	 */
	private getContextTools(
		context: MatchContext,
		toolMask?: ToolMaskState,
	): OpenAITool[] {
		// 如果模型不支持 tools，始终返回空列表
		if (!this.contextAwareEnabled) {
			return [];
		}

		const supportsToolChoice = currentModelSupportsToolChoice();
		const supportsPrefill = currentModelSupportsPrefill();

		if (supportsToolChoice || supportsPrefill) {
			// 方法1 & 2：使用版本A（平台工具集）
			// tool_choice 或 prefill 模式，发送完整的核心工具列表
			return toOpenAITools(this.platformTools);
		} else {
			// 方法3：使用版本B（项目工具集） + 动态过滤
			// 动态模式必须提供 toolMask 和 useDynamicFiltering
			if (!toolMask?.useDynamicFiltering) {
				// 如果没有 toolMask 或不是 dynamic 模式，返回空列表
				// 这种情况理论上不应该发生，但为了安全起见
				return [];
			}

			// 根据 allowedTools 过滤工具列表
			const allowedIds = toolMask.allowedTools;
			const filteredTools = this.projectTools.filter((t) =>
				allowedIds.has(t.id),
			);
			return toOpenAITools(filteredTools);
		}
	}

	/**
	 * 流式对话（支持工具调用）
	 * @param tools 工具列表（冻结后不再变化）
	 * @param context 上下文信息
	 * @param callbacks 流式回调
	 * @param options 流式选项（包含 AbortSignal）
	 * @param onAskUser 可选的 ask_user 回调
	 */
	private async streamChatWithTools(
		tools: OpenAITool[],
		context: MatchContext,
		callbacks?: StreamCallbacks,
		options?: StreamOptions,
		onAskUser?: AskUserCallback,
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
		// 跟踪总内容（跨工具调用轮次）
		let totalContent = "";
		// 跟踪当前轮的 usage 信息（在流结束时从 chunk 中获取）
		let lastChunkUsage:
			| {
					prompt_tokens: number;
					completion_tokens: number;
					total_tokens: number;
			  }
			| undefined;

		// 设置工具定义的 token 估算（用于更准确的 token 统计）
		const updateToolsTokenEstimate = (toolList: OpenAITool[]) => {
			if (toolList.length > 0) {
				const toolsJson = stableStringify(toolList);
				this.session.setToolsTokenEstimate(estimateTokens(toolsJson));
			} else {
				this.session.setToolsTokenEstimate(0);
			}
		};
		updateToolsTokenEstimate(tools);

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
				// 捕获 usage 信息（在流结束时的 chunk 中返回）
				if (chunk.usage) {
					lastChunkUsage = chunk.usage;
				}

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
					this.session.addAssistantMessage(assistantMessage, lastChunkUsage);
					messages.push(assistantMessage);

					// 累积本轮内容到总内容
					if (fullContent) {
						totalContent += fullContent + "\n";
					}

					// 重置 usage，为下一轮工具调用准备
					lastChunkUsage = undefined;

					// 执行工具调用（传递 onAskUser 回调和 toolMask）
					const toolResults = await this.toolCallHandler.handleToolCalls(
						chunk.delta.tool_calls,
						onAskUser,
						options?.toolMask,
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
					const finalContent = totalContent + fullContent;
					this.session.addAssistantMessage(
						{
							role: "assistant",
							content: fullContent,
							reasoning_content: reasoningContent || undefined,
						},
						lastChunkUsage,
					);
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
				this.session.addAssistantMessage(
					{
						role: "assistant",
						content: fullContent,
						reasoning_content: reasoningContent || undefined,
					},
					lastChunkUsage,
				);
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
		const maxToolCallsMsg = "Maximum tool call rounds limit reached.";
		const finalContent = totalContent + fullContent;
		callbacks?.onEnd?.({
			reasoning: reasoningContent,
			content: finalContent || maxToolCallsMsg,
		});
		return finalContent || maxToolCallsMsg;
	}

	/**
	 * 获取带有固定项目类型的上下文
	 */
	private getContextWithProjectType(context?: MatchContext): MatchContext {
		return {
			...context,
			projectType: this.projectType || context?.projectType,
		};
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
			content: "Maximum tool call rounds limit reached.",
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
