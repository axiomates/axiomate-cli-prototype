import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CONFIG_FILENAME = ".axiomate.json";

/**
 * 运行时配置（已合并默认值）
 */
export type Config = {
	AXIOMATE_BASE_URL: string;
	AXIOMATE_API_KEY: string;
};

/**
 * 配置文件的结构（所有字段可选）
 */
export type ConfigFile = Partial<Config>;

// 默认配置
const DEFAULT_CONFIG: Config = {
	AXIOMATE_BASE_URL: "",
	AXIOMATE_API_KEY: "",
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
	};
	return runtimeConfig;
}

/**
 * 保存配置到文件，返回保存的配置
 */
function saveConfigFile(config: ConfigFile): ConfigFile {
	ensureConfigFileExists();
	const configPath = getConfigPath();
	fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
	return config;
}

/**
 * 读取配置文件，如果不存在或格式不正确则返回空配置
 */
function loadConfigFile(): ConfigFile {
	const configPath = getConfigPath();

	// 文件不存在，创建空配置文件并返回
	if (!fs.existsSync(configPath)) {
		return saveConfigFile({});
	}

	// 文件存在，尝试解析
	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);

		// 验证是否为普通对象
		if (
			typeof config !== "object" ||
			config === null ||
			Array.isArray(config)
		) {
			throw new Error("Config must be an object");
		}

		return config as ConfigFile;
	} catch {
		// JSON 解析失败，重置为空配置文件
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
 * 跨平台兼容：Windows 使用 C:\Users\%USERNAME%，Unix 使用 ~
 */
export function getConfigPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, CONFIG_FILENAME);
}

/**
 * 检查是否为首次使用（配置未完成）
 *
 * 满足以下任一条件即为首次使用：
 * - 配置文件不存在（此时 loadConfigFile 会返回空对象）
 * - 配置文件解析失败（此时 loadConfigFile 会重置为空对象）
 * - AXIOMATE_BASE_URL 不存在或为空字符串
 * - AXIOMATE_API_KEY 不存在或为空字符串
 */
export function isFirstTimeUser(): boolean {
	const config = getConfig();
	return (
		!config.AXIOMATE_BASE_URL ||
		config.AXIOMATE_BASE_URL.trim() === "" ||
		!config.AXIOMATE_API_KEY ||
		config.AXIOMATE_API_KEY.trim() === ""
	);
}
