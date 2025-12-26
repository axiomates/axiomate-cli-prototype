import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const APPDATA_DIRNAME = ".axiomate";

// 子目录名称
const SUBDIRS = {
	logs: "logs",
	history: "history",
	sessions: "sessions",
} as const;

/**
 * 获取应用数据目录路径
 * 跨平台兼容：Windows 使用 C:\Users\%USERNAME%\.axiomate，Unix 使用 ~/.axiomate
 */
export function getAppDataPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, APPDATA_DIRNAME);
}

/**
 * 获取日志目录路径
 */
export function getLogsPath(): string {
	return path.join(getAppDataPath(), SUBDIRS.logs);
}

/**
 * 获取历史记录目录路径
 */
export function getHistoryPath(): string {
	return path.join(getAppDataPath(), SUBDIRS.history);
}

/**
 * 获取 session 存储目录路径
 */
export function getSessionsPath(): string {
	return path.join(getAppDataPath(), SUBDIRS.sessions);
}

/**
 * 初始化应用数据目录
 */
export function initAppData(): void {
	ensureAppDataDirExists();
}

/**
 * 确保应用数据目录及子目录存在
 */
function ensureAppDataDirExists(): void {
	const appDataPath = getAppDataPath();

	// 创建主目录
	if (!fs.existsSync(appDataPath)) {
		fs.mkdirSync(appDataPath, { recursive: true });
	}

	// 创建子目录
	for (const subdir of Object.values(SUBDIRS)) {
		const subdirPath = path.join(appDataPath, subdir);
		if (!fs.existsSync(subdirPath)) {
			fs.mkdirSync(subdirPath, { recursive: true });
		}
	}
}
