import * as fs from "node:fs";
import * as path from "node:path";

const LOCAL_DIR_NAME = ".axiomate";
const LOCAL_SETTINGS_FILENAME = "localsettings.json";

/**
 * 权限配置
 */
export type Permissions = {
	allow: string[];
};

/**
 * 运行时本地设置（已合并默认值）
 */
export type LocalSettings = {
	permissions: Permissions;
};

/**
 * 本地设置文件的结构（所有字段可选）
 */
export type LocalSettingsFile = Partial<LocalSettings>;

// 默认本地设置
const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
	permissions: {
		allow: [],
	},
};

// 运行时本地设置（单例）
let runtimeLocalSettings: LocalSettings = { ...DEFAULT_LOCAL_SETTINGS };

// 用户启动目录（在 initLocalSettings 中初始化）
let workingDirectory: string;

/**
 * 获取当前本地设置
 */
export function getLocalSettings(): LocalSettings {
	return structuredClone(runtimeLocalSettings);
}

/**
 * 更新本地设置并保存到文件（懒创建）
 */
export function updateLocalSettings(
	updates: Partial<LocalSettings>,
): LocalSettings {
	const newSettings: LocalSettings = {
		permissions: {
			...runtimeLocalSettings.permissions,
			...updates.permissions,
		},
	};
	runtimeLocalSettings = newSettings;
	saveLocalSettingsFile(newSettings);
	return newSettings;
}

/**
 * 初始化本地设置
 */
export function initLocalSettings(): LocalSettings {
	// 记录启动目录
	workingDirectory = process.cwd();

	// 读取设置文件（不存在时返回默认配置）
	const fileSettings = loadLocalSettingsFile();

	runtimeLocalSettings = {
		permissions: {
			...DEFAULT_LOCAL_SETTINGS.permissions,
			...fileSettings.permissions,
		},
	};

	return runtimeLocalSettings;
}

/**
 * 保存本地设置到文件
 */
function saveLocalSettingsFile(settings: LocalSettingsFile): void {
	ensureLocalDir();
	const settingsPath = getLocalSettingsPath();
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), "utf-8");
}

/**
 * 读取本地设置文件
 */
function loadLocalSettingsFile(): LocalSettingsFile {
	try {
		const content = fs.readFileSync(getLocalSettingsPath(), "utf-8");
		const settings = JSON.parse(content);

		// 验证是否为普通对象
		if (
			typeof settings !== "object" ||
			settings === null ||
			Array.isArray(settings)
		) {
			return DEFAULT_LOCAL_SETTINGS;
		}

		return settings as LocalSettingsFile;
	} catch {
		// 文件不存在或解析失败，返回默认配置
		return DEFAULT_LOCAL_SETTINGS;
	}
}

/**
 * 确保本地设置目录存在（懒创建）
 */
function ensureLocalDir(): void {
	const localDirPath = getLocalDirPath();
	fs.mkdirSync(localDirPath, { recursive: true });
}

/**
 * 获取本地设置文件路径
 */
export function getLocalSettingsPath(): string {
	return path.join(getLocalDirPath(), LOCAL_SETTINGS_FILENAME);
}

/**
 * 获取本地 .axiomate 目录路径
 */
function getLocalDirPath(): string {
	return path.join(workingDirectory, LOCAL_DIR_NAME);
}
