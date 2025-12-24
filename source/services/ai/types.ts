/**
 * AI 服务类型定义
 */

import type { DiscoveredTool, ToolAction } from "../tools/types.js";

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * 聊天消息角色
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * 工具调用信息
 */
export type ToolCall = {
	id: string;
	type: "function";
	function: {
		name: string; // 格式: toolId_actionName (如 "git_status")
		arguments: string; // JSON 字符串
	};
};

/**
 * 聊天消息
 */
export type ChatMessage = {
	role: MessageRole;
	content: string;
	// 工具调用结果的关联 ID
	tool_call_id?: string;
	// AI 返回的工具调用请求
	tool_calls?: ToolCall[];
};

// ============================================================================
// AI Response Types
// ============================================================================

/**
 * AI 响应完成原因
 * - stop: 正常结束
 * - eos: 遇到结束标记 (SiliconFlow)
 * - tool_calls: 需要执行工具调用
 * - length: 达到最大长度限制
 * - error: 发生错误
 */
export type FinishReason = "stop" | "eos" | "tool_calls" | "length" | "error";

/**
 * AI 响应
 */
export type AIResponse = {
	message: ChatMessage;
	finish_reason: FinishReason;
	// 使用统计（可选）
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

/**
 * 流式响应块
 */
export type AIStreamChunk = {
	delta: Partial<ChatMessage>;
	finish_reason?: FinishReason;
};

// ============================================================================
// Tool Format Types (用于 AI API)
// ============================================================================

/**
 * JSON Schema 类型
 */
export type JSONSchemaType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "object"
	| "array"
	| "null";

/**
 * JSON Schema 定义
 */
export type JSONSchema = {
	type: JSONSchemaType;
	description?: string;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	enum?: (string | number | boolean)[];
	default?: unknown;
};

/**
 * OpenAI 工具格式
 */
export type OpenAITool = {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, JSONSchema>;
			required: string[];
		};
	};
};

/**
 * Anthropic 工具格式
 */
export type AnthropicTool = {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, JSONSchema>;
		required: string[];
	};
};

// ============================================================================
// AI Client Interface
// ============================================================================

/**
 * AI 客户端配置
 */
export type AIClientConfig = {
	apiKey: string;
	model: string;
	baseUrl?: string;
	// 超时时间（毫秒）
	timeout?: number;
	// 最大重试次数
	maxRetries?: number;
};

/**
 * AI 客户端接口
 */
export type IAIClient = {
	/**
	 * 发送聊天请求
	 * @param messages 消息历史
	 * @param tools 可用工具（可选）
	 * @returns AI 响应
	 */
	chat(messages: ChatMessage[], tools?: OpenAITool[]): Promise<AIResponse>;

	/**
	 * 流式聊天请求
	 * @param messages 消息历史
	 * @param tools 可用工具（可选）
	 * @returns 流式响应迭代器
	 */
	streamChat?(
		messages: ChatMessage[],
		tools?: OpenAITool[],
	): AsyncIterable<AIStreamChunk>;

	/**
	 * 获取当前配置
	 */
	getConfig(): AIClientConfig;
};

// ============================================================================
// Tool Matcher Types
// ============================================================================

/**
 * 上下文信息（用于工具匹配）
 */
export type MatchContext = {
	// 当前工作目录
	cwd?: string;
	// 当前打开的文件
	currentFiles?: string[];
	// 项目类型检测结果
	projectType?: ProjectType;
	// 用户显式选择的文件
	selectedFiles?: string[];
};

/**
 * Project types detected from project markers
 */
export type ProjectType =
	| "node" // package.json
	| "python" // requirements.txt, pyproject.toml
	| "java" // pom.xml, build.gradle
	| "cpp" // CMakeLists.txt, *.cpp, *.h
	| "dotnet" // *.csproj, *.sln
	| "rust" // Cargo.toml
	| "go" // go.mod
	| "unknown";

/**
 * 匹配结果
 */
export type MatchResult = {
	tool: DiscoveredTool;
	action: ToolAction;
	// 匹配分数 (0-1)
	score: number;
	// 匹配原因
	reason: string;
};

/**
 * 工具匹配器接口
 */
export type IToolMatcher = {
	/**
	 * 根据查询匹配工具
	 * @param query 查询字符串
	 * @param context 上下文信息
	 * @returns 匹配的工具列表（按分数排序）
	 */
	match(query: string, context?: MatchContext): MatchResult[];

	/**
	 * 根据能力匹配工具
	 * @param capability 能力名称
	 */
	matchByCapability(capability: string): DiscoveredTool[];

	/**
	 * 根据项目上下文自动选择工具
	 * @param context 上下文信息
	 */
	autoSelect(context: MatchContext): DiscoveredTool[];
};

// ============================================================================
// Tool Call Handler Types
// ============================================================================

/**
 * 工具执行结果
 */
export type ToolExecutionResult = {
	success: boolean;
	output: string;
	error?: string;
	// 执行时间（毫秒）
	duration?: number;
};

/**
 * 工具调用处理器接口
 */
export type IToolCallHandler = {
	/**
	 * 处理 AI 返回的工具调用
	 * @param toolCalls 工具调用列表
	 * @returns 工具结果消息列表
	 */
	handleToolCalls(toolCalls: ToolCall[]): Promise<ChatMessage[]>;

	/**
	 * 解析工具调用名称
	 * @param name 工具调用名称 (格式: toolId_actionName)
	 * @returns 工具 ID 和动作名称
	 */
	parseToolCallName(name: string): { toolId: string; actionName: string };
};

// ============================================================================
// AI Service Types (两阶段调用)
// ============================================================================

/**
 * 第一阶段：分析用户意图，确定需要的工具
 */
export type IntentAnalysis = {
	// 需要的工具类型/能力
	requiredCapabilities: string[];
	// 是否需要工具
	needsTools: boolean;
	// 意图描述
	intent: string;
};

/**
 * AI 服务配置
 */
export type AIServiceConfig = {
	// AI 客户端
	client: IAIClient;
	// 最大工具调用轮数
	maxToolCallRounds?: number;
	// 是否启用上下文感知（本地目录分析）
	contextAwareEnabled?: boolean;
	// 上下文窗口大小（token 数）
	contextWindow?: number;
};

/**
 * Session 状态（从 session.ts 重新导出以便外部使用）
 */
export type SessionStatus = {
	/** 已使用的 token 数 */
	usedTokens: number;
	/** 可用的 token 数（用于新消息 + 响应） */
	availableTokens: number;
	/** 使用百分比 (0-100) */
	usagePercent: number;
	/** 是否接近上限 (>80%) */
	isNearLimit: boolean;
	/** 是否已满 (>95%) */
	isFull: boolean;
	/** 消息数量 */
	messageCount: number;
};

/**
 * Compact 检查结果
 */
export type CompactCheckResult = {
	/** 是否需要 compact（同时满足阈值和消息数条件） */
	shouldCompact: boolean;
	/** 当前使用百分比 */
	usagePercent: number;
	/** 预计添加新消息后的使用百分比 */
	projectedPercent: number;
	/** 消息数量（包括 summary） */
	messageCount: number;
	/** 真实消息数量（排除 compact summary） */
	realMessageCount: number;
};

/**
 * 流式消息回调
 */
export type StreamCallbacks = {
	/** 流式内容更新 (content 是累积的完整内容) */
	onChunk?: (content: string) => void;
	/** 流式开始 */
	onStart?: () => void;
	/** 流式结束 */
	onEnd?: (finalContent: string) => void;
};

/**
 * AI 服务接口
 */
export type IAIService = {
	/**
	 * 发送消息并获取响应（自动处理工具调用循环）
	 * @param userMessage 用户消息
	 * @param context 上下文信息
	 * @returns 最终响应
	 */
	sendMessage(userMessage: string, context?: MatchContext): Promise<string>;

	/**
	 * 流式发送消息（实时返回生成内容）
	 * @param userMessage 用户消息
	 * @param context 上下文信息
	 * @param callbacks 流式回调
	 * @returns 最终完整响应
	 */
	streamMessage(
		userMessage: string,
		context?: MatchContext,
		callbacks?: StreamCallbacks,
	): Promise<string>;

	/**
	 * 获取当前对话历史
	 */
	getHistory(): ChatMessage[];

	/**
	 * 清空对话历史
	 */
	clearHistory(): void;

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void;

	/**
	 * 获取上下文窗口大小
	 */
	getContextWindow(): number;

	/**
	 * 获取 Session 状态
	 */
	getSessionStatus(): SessionStatus;

	/**
	 * 获取可用于新消息的 token 数
	 */
	getAvailableTokens(): number;

	/**
	 * 检查是否需要 compact
	 * @param estimatedNewTokens 预计新消息的 token 数
	 */
	shouldCompact(estimatedNewTokens?: number): CompactCheckResult;

	/**
	 * 使用总结内容重置会话
	 * @param summary AI 生成的对话总结
	 */
	compactWith(summary: string): void;
};
