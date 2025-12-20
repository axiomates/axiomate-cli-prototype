/**
 * AI 配置管理
 *
 * 简化版：使用统一的模型预设系统
 */

import {
	getModelById,
	getDefaultModel,
	type ModelPreset,
} from "../../constants/models.js";
import { getConfig, getCurrentModelId } from "../../utils/config.js";

/**
 * 获取当前模型预设
 * 如果配置中没有设置模型，返回默认模型
 */
export function getCurrentModel(): ModelPreset {
	const modelId = getCurrentModelId();
	if (modelId) {
		const model = getModelById(modelId);
		if (model) {
			return model;
		}
	}
	return getDefaultModel();
}

/**
 * 获取当前 API 配置
 * 从用户配置中读取 base URL 和 API key
 */
export function getApiConfig(): { baseUrl: string; apiKey: string } {
	const config = getConfig();
	return {
		baseUrl: config.AXIOMATE_BASE_URL,
		apiKey: config.AXIOMATE_API_KEY,
	};
}

/**
 * 获取模型的完整 API 配置
 * 根据协议类型自动添加正确的 API 路径后缀
 * 注意：model.id 就是 apiModel（如 "Qwen/Qwen3-8B"）
 */
export function getModelApiConfig(model: ModelPreset): {
	baseUrl: string;
	apiKey: string;
	apiModel: string;
	protocol: "openai" | "anthropic";
} {
	const { baseUrl, apiKey } = getApiConfig();

	// 根据协议添加正确的后缀
	// OpenAI: /chat/completions
	// Anthropic: /messages
	let fullBaseUrl = baseUrl;
	if (baseUrl && !baseUrl.endsWith("/")) {
		fullBaseUrl = baseUrl;
	}

	return {
		baseUrl: fullBaseUrl,
		apiKey,
		apiModel: model.id, // id 就是 apiModel
		protocol: model.protocol,
	};
}

/**
 * 检查 API 配置是否有效
 */
export function isApiConfigValid(): boolean {
	const { baseUrl, apiKey } = getApiConfig();
	return Boolean(baseUrl && apiKey);
}

// 重新导出常用函数，保持向后兼容
export { getCurrentModelId } from "../../utils/config.js";
export { DEFAULT_MODEL_ID } from "../../constants/models.js";
