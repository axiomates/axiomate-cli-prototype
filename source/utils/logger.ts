import * as path from "node:path";
import pino from "pino";
import { getLogsPath } from "./appdata.js";
import { getFlags } from "./flags.js";

/**
 * 日志级别
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

// 单例 logger
let loggerInstance: pino.Logger | null = null;

/**
 * 便捷日志方法
 */
export const logger = {
	trace: (msg: string, obj?: object) => getLogger().trace(obj, msg),
	debug: (msg: string, obj?: object) => getLogger().debug(obj, msg),
	info: (msg: string, obj?: object) => getLogger().info(obj, msg),
	warn: (msg: string, obj?: object) => getLogger().warn(obj, msg),
	error: (msg: string, obj?: object) => getLogger().error(obj, msg),
	fatal: (msg: string, obj?: object) => getLogger().fatal(obj, msg),
};

/**
 * 获取 logger 实例
 */
export function getLogger(): pino.Logger {
	if (loggerInstance === null) {
		loggerInstance = createLogger();
	}
	return loggerInstance;
}

/**
 * 创建 logger 实例
 * 使用 pino-roll 实现日志轮转
 */
function createLogger(): pino.Logger {
	const flags = getFlags();
	const level = flags.verbose ? "trace" : "warn";

	return pino({
		level,
		transport: {
			target: "pino-roll",
			options: {
				file: getLogFilePath(),
				frequency: "daily",
				mkdir: true,
				size: "10m",
				limit: { count: 7 },
			},
		},
	});
}

/**
 * 获取日志文件路径
 */
function getLogFilePath(): string {
	return path.join(getLogsPath(), "app");
}
