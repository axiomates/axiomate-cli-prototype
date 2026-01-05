/**
 * AI 配置管理
 *
 * 简化版：使用统一的模型配置系统
 */

import {
	getModelById,
	getDefaultModel,
	type ModelConfig,
} from "../../constants/models.js";
import {
	getCurrentModelId,
	getModelApiConfig as getModelApiConfigFromConfig,
	isApiConfigValid as isApiConfigValidFromConfig,
} from "../../utils/config.js";

/**
 * 获取当前模型配置
 *
 * 优先从 currentModel 配置读取，否则尝试默认模型
 * 如果都没有配置，返回 null（表示需要先运行 Welcome 页面初始化）
 */
export function getCurrentModel(): ModelConfig | null {
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
 * 如果没有配置模型，返回空值
 */
export function getApiConfig(): { baseUrl: string; apiKey?: string } {
	const model = getCurrentModel();
	if (!model) {
		return { baseUrl: "" };
	}

	const apiConfig = getModelApiConfigFromConfig(model.model);
	if (apiConfig) {
		return {
			baseUrl: apiConfig.baseUrl,
			apiKey: apiConfig.apiKey,
		};
	}
	// 没有配置，返回空值
	return {
		baseUrl: "",
	};
}

/**
 * 获取模型的完整 API 配置
 * 注意：model.model 是 API 模型名（如 "Qwen/Qwen3-8B"）
 * 返回 null 表示该模型没有配置
 */
export function getModelApiConfig(model: ModelConfig): {
	baseUrl: string;
	apiKey?: string;
	apiModel: string;
	protocol: "openai" | "anthropic";
} | null {
	const apiConfig = getModelApiConfigFromConfig(model.model);
	if (!apiConfig) {
		return null;
	}

	return {
		baseUrl: apiConfig.baseUrl,
		apiKey: apiConfig.apiKey,
		apiModel: apiConfig.model,
		protocol: apiConfig.protocol,
	};
}

/**
 * 检查 API 配置是否有效
 */
export function isApiConfigValid(): boolean {
	return isApiConfigValidFromConfig();
}

// 重新导出常用函数，保持向后兼容
export { getCurrentModelId } from "../../utils/config.js";
export { DEFAULT_MODEL_ID } from "../../constants/models.js";
