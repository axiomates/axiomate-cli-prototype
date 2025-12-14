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
 * 本地设置文件的结构
 */
export type LocalSettingsFile = {
	permissions?: Partial<Permissions>;
};

/**
 * 运行时本地设置（已合并默认值）
 */
export type LocalSettings = {
	permissions: Permissions;
};

// 默认本地设置
const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
	permissions: {
		allow: [],
	},
};

// 用户启动目录
let workingDirectory: string = process.cwd();

// 运行时本地设置（单例）
let runtimeLocalSettings: LocalSettings = { ...DEFAULT_LOCAL_SETTINGS };

// 标记本地设置目录是否存在
let localDirExists: boolean = false;

/**
 * 获取用户启动目录
 */
export function getWorkingDirectory(): string {
	return workingDirectory;
}

/**
 * 获取本地 .axiomate 目录路径
 */
export function getLocalDirPath(): string {
	return path.join(workingDirectory, LOCAL_DIR_NAME);
}

/**
 * 获取本地设置文件路径
 */
export function getLocalSettingsPath(): string {
	return path.join(getLocalDirPath(), LOCAL_SETTINGS_FILENAME);
}

/**
 * 检查本地设置目录是否存在
 */
function checkLocalDirExists(): boolean {
	return fs.existsSync(getLocalDirPath());
}

/**
 * 读取本地设置文件
 */
function loadLocalSettingsFile(): LocalSettingsFile | null {
	const settingsPath = getLocalSettingsPath();

	try {
		if (fs.existsSync(settingsPath)) {
			const content = fs.readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(content) as LocalSettingsFile;

			// 验证是否为对象类型
			if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
				return null;
			}

			return settings;
		}
	} catch {
		// 文件读取失败或 JSON 格式不正确
	}

	return null;
}

/**
 * 确保本地设置目录存在（懒创建）
 */
function ensureLocalDir(): void {
	if (!localDirExists) {
		const localDirPath = getLocalDirPath();
		if (!fs.existsSync(localDirPath)) {
			fs.mkdirSync(localDirPath, { recursive: true });
		}
		localDirExists = true;
	}
}

/**
 * 保存本地设置到文件（懒创建）
 */
function saveLocalSettingsFile(settings: LocalSettingsFile): void {
	ensureLocalDir();
	const settingsPath = getLocalSettingsPath();
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), "utf-8");
}

/**
 * 初始化本地设置
 */
export function initLocalSettings(): LocalSettings {
	// 记录启动目录
	workingDirectory = process.cwd();

	// 检查本地目录是否已存在
	localDirExists = checkLocalDirExists();

	// 尝试读取已有的设置文件
	const fileSettings = loadLocalSettingsFile();

	if (fileSettings) {
		runtimeLocalSettings = {
			permissions: {
				...DEFAULT_LOCAL_SETTINGS.permissions,
				...fileSettings.permissions,
			},
		};
	} else {
		// 只在内存中初始化，不创建文件
		runtimeLocalSettings = {
			permissions: { ...DEFAULT_LOCAL_SETTINGS.permissions },
		};
	}

	return runtimeLocalSettings;
}

/**
 * 获取当前本地设置
 */
export function getLocalSettings(): LocalSettings {
	return runtimeLocalSettings;
}

/**
 * 更新本地设置并保存到文件（懒创建）
 */
export function updateLocalSettings(updates: Partial<LocalSettings>): LocalSettings {
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
 * 检查本地设置是否已持久化（.axiomate 目录是否存在）
 */
export function isLocalSettingsPersisted(): boolean {
	return checkLocalDirExists();
}
