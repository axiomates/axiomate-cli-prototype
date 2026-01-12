/**
 * AI 服务模块导出
 */

// 类型导出
export type {
	// 消息类型
	MessageRole,
	ChatMessage,
	ToolCall,
	AIResponse,
	AIStreamChunk,
	FinishReason,

	// 工具格式
	JSONSchema,
	JSONSchemaType,
	OpenAITool,
	AnthropicTool,

	// 客户端接口
	AIClientConfig,
	IAIClient,

	// 匹配器
	MatchContext,
	ProjectType,
	MatchResult,
	IToolMatcher,

	// 调用处理
	ToolExecutionResult,
	IToolCallHandler,

	// AI 服务
	IntentAnalysis,
	AIServiceConfig,
	IAIService,
	SessionStatus,
	CompactCheckResult,
} from "./types.js";

// Session 管理
export {
	Session,
	createSession,
	type SessionConfig,
	type TokenUsage,
} from "./session.js";

// 适配器导出
export {
	toOpenAITools,
	toolToOpenAI,
	paramsToJsonSchema,
	parseOpenAIToolCalls,
	buildOpenAIToolResultMessage,
	toOpenAIMessages,
	toAnthropicTools,
	toolToAnthropic,
	parseAnthropicToolUse,
	buildAnthropicToolResultMessage,
	toAnthropicMessages,
	extractSystemMessage,
} from "./adapters/index.js";

// 客户端导出
export { OpenAIClient } from "./clients/openai.js";
export { AnthropicClient } from "./clients/anthropic.js";

// 工具调用处理器
export { ToolCallHandler, createToolCallHandler } from "./tool-call-handler.js";

// AI 服务
export {
	AIService,
	createAIService,
	type SendMessageResult,
} from "./service.js";

// 配置管理
export {
	getCurrentModel,
	getApiConfig,
	getModelApiConfig,
	isApiConfigValid,
	getCurrentModelId,
	DEFAULT_MODEL_ID,
} from "./config.js";

// 模型配置（从 constants 导出）
export {
	getAllModels,
	getModelById,
	getDefaultModel,
	type ModelConfig,
	type ApiProtocol,
} from "../../constants/models.js";

// 工厂函数：创建完整的 AI 服务实例
import type { IToolRegistry } from "../tools/types.js";
import type { IAIClient, IAIService } from "./types.js";
import { OpenAIClient } from "./clients/openai.js";
import { AnthropicClient } from "./clients/anthropic.js";
import { AIService } from "./service.js";
import {
	getCurrentModel,
	getModelApiConfig,
	isApiConfigValid,
} from "./config.js";
import type { ModelConfig } from "../../constants/models.js";

/**
 * 根据模型配置创建 AI 客户端
 * @returns AI 客户端实例，如果模型没有配置则返回 null
 */
export function createAIClient(model: ModelConfig): IAIClient | null {
	const apiConfig = getModelApiConfig(model);

	// Model not configured
	if (!apiConfig) {
		return null;
	}

	const clientConfig = {
		apiKey: apiConfig.apiKey,
		model: apiConfig.apiModel,
		baseUrl: apiConfig.baseUrl,
	};

	switch (apiConfig.protocol) {
		case "anthropic":
			return new AnthropicClient(clientConfig);
		case "openai":
		default:
			return new OpenAIClient(clientConfig);
	}
}

/**
 * 创建 AI 服务实例（使用当前配置）
 *
 * @param registry 工具注册表
 * @param cwd 当前工作目录（用于项目类型检测）
 * @returns AI 服务实例，如果配置无效则返回 null
 */
export function createAIServiceFromConfig(
	registry: IToolRegistry,
	cwd?: string,
): IAIService | null {
	if (!isApiConfigValid()) {
		return null;
	}

	const model = getCurrentModel();
	// 没有配置模型（首次启动前或配置损坏）
	if (!model) {
		return null;
	}

	const client = createAIClient(model);

	// Model not configured (shouldn't happen if isApiConfigValid() passed)
	if (!client) {
		return null;
	}

	return new AIService(
		{
			client,
			// 根据模型能力调整配置
			contextAwareEnabled: model.supportsTools,
			maxToolCallRounds: 40,
			// 使用模型的上下文窗口大小
			contextWindow: model.contextWindow,
			// 传递当前工作目录
			cwd: cwd || process.cwd(),
		},
		registry,
	);
}

/**
 * 获取当前模型信息（用于 App 状态）
 */
export function getCurrentModelInfo(): {
	model: ModelConfig | null;
	isConfigured: boolean;
} {
	const model = getCurrentModel();
	const isConfigured = isApiConfigValid();

	return {
		model,
		isConfigured,
	};
}
