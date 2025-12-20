import { getLogsPath } from "./appdata.js";
import { getFlags } from "./flags.js";
import { LogWriter, type LogLevel } from "./logWriter.js";

export type { LogLevel };

/**
 * 日志级别优先级
 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

// 单例 LogWriter
let writerInstance: LogWriter | null = null;

/**
 * 获取 LogWriter 实例
 */
function getWriter(): LogWriter {
	if (writerInstance === null) {
		writerInstance = new LogWriter(getLogsPath(), {
			baseName: "app",
			maxFileSize: 10 * 1024 * 1024, // 10MB
			maxDays: 7,
		});
	}
	return writerInstance;
}

/**
 * 获取当前日志级别
 */
function getCurrentLevel(): LogLevel {
	const flags = getFlags();
	return flags.verbose ? "trace" : "warn";
}

/**
 * 检查是否应该记录该级别的日志
 */
function shouldLog(level: LogLevel): boolean {
	const currentLevel = getCurrentLevel();
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

/**
 * 记录日志
 */
function log(level: LogLevel, msg: string, obj?: object): void {
	if (!shouldLog(level)) return;

	try {
		getWriter().write(level, msg, obj);
	} catch {
		// 静默失败
	}
}

/**
 * 便捷日志方法
 */
export const logger = {
	trace: (msg: string, obj?: object) => log("trace", msg, obj),
	debug: (msg: string, obj?: object) => log("debug", msg, obj),
	info: (msg: string, obj?: object) => log("info", msg, obj),
	warn: (msg: string, obj?: object) => log("warn", msg, obj),
	error: (msg: string, obj?: object) => log("error", msg, obj),
	fatal: (msg: string, obj?: object) => log("fatal", msg, obj),
};
