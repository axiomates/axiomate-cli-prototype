import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_FILENAME = ".axiomate.json";

/**
 * API 协议类型
 */
export type ApiProtocol = "openai" | "anthropic";

/**
 * 模型配置（存储在配置文件中）
 */
export type ModelConfig = {
	/** API 模型名（如 "Qwen/Qwen3-8B"） */
	model: string;
	/** 显示名称 */
	name: string;
	/** API 协议类型 */
	protocol: ApiProtocol;
	/** 简短描述 */
	description?: string;
	/** 是否支持 function calling / tools */
	supportsTools: boolean;
	/** 模型是否具有 thinking/reasoning 能力（默认 false） */
	supportsThinking?: boolean;
	/**
	 * API 的 thinking 参数格式配置
	 * - undefined: API 不支持 thinking 参数，不发送任何参数
	 * - object: 定义 API 的参数格式
	 */
	thinkingParams?: {
		/** 启用 thinking 时附加到请求 body 的参数（仅 supportsThinking: true 时需要） */
		enabled?: Record<string, unknown>;
		/** 禁用 thinking 时附加到请求 body 的参数 */
		disabled: Record<string, unknown>;
	};
	/** 上下文窗口大小（token 数） */
	contextWindow: number;
	/** API Base URL */
	baseUrl: string;
	/** API Key（可选，本地 API 如 Ollama 可不填） */
	apiKey?: string;
};

/**
 * 运行时配置结构
 */
export type Config = {
	/** 所有模型配置，key 为 model 字段的值 */
	models: Record<string, ModelConfig>;
	/** 当前选中的模型 ID（model 字段的值） */
	currentModel: string;
	/** 自动补全使用的模型 ID（可选） */
	suggestionModel: string;
	/** 是否启用 AI 自动补全（可选，默认 true，只有用户手动设置时才写入文件） */
	suggestionEnabled?: boolean;
	/** 是否启用 AI 思考模式（可选，默认 false，只有用户手动设置时才写入文件） */
	thinkingEnabled?: boolean;
	/** 是否启用 Plan 模式（可选，默认 false，只有用户手动设置时才写入文件） */
	planModeEnabled?: boolean;
};

/**
 * 配置文件结构（所有字段可选）
 */
export type ConfigFile = Partial<Config>;

// 默认配置（不包含 suggestionEnabled，它是可选的，默认视为 true）
const DEFAULT_CONFIG: Config = {
	models: {},
	currentModel: "",
	suggestionModel: "",
};

// 运行时配置（单例）
let runtimeConfig: Config | null = null;

/**
 * 获取当前配置（如果未初始化则自动初始化）
 * 返回深拷贝，防止外部直接修改内部状态
 */
export function getConfig(): Config {
	if (runtimeConfig === null) {
		initConfig();
	}
	return structuredClone(runtimeConfig!);
}

/**
 * 更新配置并保存到文件
 */
export function updateConfig(updates: Partial<Config>): Config {
	const currentConfig = getConfig();
	const newConfig: Config = {
		...currentConfig,
		...updates,
	};
	runtimeConfig = newConfig;
	saveConfigFile(newConfig);
	return newConfig;
}

/**
 * 初始化配置（合并文件配置和默认配置）
 */
export function initConfig(): Config {
	const fileConfig = loadConfigFile();
	runtimeConfig = {
		...DEFAULT_CONFIG,
		...fileConfig,
		models: fileConfig.models ?? {},
	};
	return runtimeConfig;
}

/**
 * 保存配置到文件
 */
function saveConfigFile(config: ConfigFile): ConfigFile {
	ensureConfigFileExists();
	const configPath = getConfigPath();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
	return config;
}

/**
 * 读取配置文件
 */
function loadConfigFile(): ConfigFile {
	const configPath = getConfigPath();

	if (!fs.existsSync(configPath)) {
		return saveConfigFile({});
	}

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);

		if (
			typeof config !== "object" ||
			config === null ||
			Array.isArray(config)
		) {
			throw new Error("Config must be an object");
		}

		return config as ConfigFile;
	} catch {
		return saveConfigFile({});
	}
}

/**
 * 确保配置文件存在
 */
function ensureConfigFileExists(): void {
	const configPath = getConfigPath();
	if (!fs.existsSync(configPath)) {
		fs.writeFileSync(configPath, JSON.stringify({}, null, 4), "utf-8");
	}
}

/**
 * 获取用户主目录下的配置文件路径
 */
export function getConfigPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, CONFIG_FILENAME);
}

/**
 * 检查是否为首次使用
 *
 * 返回 true 如果：
 * - 配置文件不存在
 * - 配置文件不是有效的 JSON 对象
 * - 缺少任意必要字段：currentModel、models、suggestionModel
 * - models 为空对象
 *
 * 缺少任意配置都视为首次启动，会覆盖原有配置
 */
export function isFirstTimeUser(): boolean {
	const configPath = getConfigPath();

	if (!fs.existsSync(configPath)) {
		return true;
	}

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return true;
		}

		// 检查 models 是否存在且有配置
		const models = parsed.models;
		if (
			!models ||
			typeof models !== "object" ||
			Object.keys(models).length === 0
		) {
			return true;
		}

		// 检查 currentModel 是否存在且非空，且在 models 中有配置
		if (
			!parsed.currentModel ||
			typeof parsed.currentModel !== "string" ||
			parsed.currentModel.trim() === ""
		) {
			return true;
		}
		if (!(parsed.currentModel in models)) {
			return true;
		}

		// 检查 suggestionModel 是否存在且非空，且在 models 中有配置
		if (
			!parsed.suggestionModel ||
			typeof parsed.suggestionModel !== "string" ||
			parsed.suggestionModel.trim() === ""
		) {
			return true;
		}
		if (!(parsed.suggestionModel in models)) {
			return true;
		}

		return false;
	} catch {
		return true;
	}
}

/**
 * 获取当前模型 ID
 */
export function getCurrentModelId(): string {
	const config = getConfig();
	return config.currentModel || "";
}

/**
 * 设置当前模型 ID
 */
export function setCurrentModelId(modelId: string): void {
	updateConfig({ currentModel: modelId });
}

/**
 * 获取所有模型配置列表
 */
export function getAllModels(): ModelConfig[] {
	const config = getConfig();
	return Object.values(config.models);
}

/**
 * 根据 model ID 获取模型配置
 */
export function getModelById(modelId: string): ModelConfig | undefined {
	const config = getConfig();
	return config.models[modelId];
}

/**
 * 获取模型的 API 配置
 */
export function getModelApiConfig(modelId: string): {
	baseUrl: string;
	apiKey?: string;
	model: string;
	protocol: ApiProtocol;
} | null {
	const modelConfig = getModelById(modelId);
	if (!modelConfig?.baseUrl) {
		return null;
	}

	return {
		baseUrl: modelConfig.baseUrl,
		apiKey: modelConfig.apiKey,
		model: modelConfig.model,
		protocol: modelConfig.protocol,
	};
}

/**
 * 检查 API 配置是否有效（当前模型有配置）
 */
export function isApiConfigValid(): boolean {
	const modelId = getCurrentModelId();
	if (!modelId) return false;
	const apiConfig = getModelApiConfig(modelId);
	return apiConfig !== null;
}

/**
 * 获取自动补全模型 ID
 */
export function getSuggestionModelId(): string {
	const config = getConfig();
	return config.suggestionModel || "";
}

/**
 * 设置自动补全模型 ID
 */
export function setSuggestionModelId(modelId: string): void {
	updateConfig({ suggestionModel: modelId });
}

/**
 * 检查是否启用 AI 自动补全
 * 默认为 true（如果配置文件中未指定）
 */
export function isSuggestionEnabled(): boolean {
	const config = getConfig();
	return config.suggestionEnabled !== false;
}

/**
 * 设置是否启用 AI 自动补全
 */
export function setSuggestionEnabled(enabled: boolean): void {
	updateConfig({ suggestionEnabled: enabled });
}

/**
 * 检查是否启用 AI 思考模式
 * 默认为 false（如果配置文件中未指定）
 */
export function isThinkingEnabled(): boolean {
	const config = getConfig();
	return config.thinkingEnabled === true;
}

/**
 * 检查当前模型是否支持思考模式（用于 UI 显示）
 */
export function currentModelSupportsThinking(): boolean {
	const modelId = getCurrentModelId();
	if (!modelId) return false;
	const model = getModelById(modelId);
	return model?.supportsThinking === true;
}

/**
 * 获取当前模型的 thinking 参数配置
 * 根据用户开关状态和模型能力返回相应的参数，用于附加到请求 body
 * @returns 参数对象，或 null（不需要附加任何参数）
 */
export function getThinkingParams(): Record<string, unknown> | null {
	const modelId = getCurrentModelId();
	if (!modelId) return null;
	const model = getModelById(modelId);

	// API 不支持 thinking 参数
	if (!model?.thinkingParams) return null;

	// 决定是否启用 thinking：用户开关 AND 模型支持
	const shouldEnable = isThinkingEnabled() && model.supportsThinking;

	if (shouldEnable) {
		// enabled 可选，如果未配置则返回 null（不发送参数）
		return model.thinkingParams.enabled ?? null;
	} else {
		return model.thinkingParams.disabled;
	}
}

/**
 * 设置是否启用 AI 思考模式
 */
export function setThinkingEnabled(enabled: boolean): void {
	updateConfig({ thinkingEnabled: enabled });
}

/**
 * 检查是否启用 Plan 模式
 * 默认为 false（如果配置文件中未指定）
 */
export function isPlanModeEnabled(): boolean {
	const config = getConfig();
	return config.planModeEnabled === true;
}

/**
 * 设置是否启用 Plan 模式
 */
export function setPlanModeEnabled(enabled: boolean): void {
	updateConfig({ planModeEnabled: enabled });
}
