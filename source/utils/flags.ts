/**
 * CLI 命令行参数
 */
export type CliFlags = {
	help: boolean | undefined;
	verbose: boolean | undefined;
};

// 默认命令行参数
const DEFAULT_FLAGS: CliFlags = {
	help: undefined,
	verbose: undefined,
};

// 运行时命令行参数（单例）
let runtimeFlags: CliFlags = DEFAULT_FLAGS;

/**
 * 设置命令行参数
 */
export function setFlags(flags: CliFlags): void {
	runtimeFlags = flags;
}

/**
 * 获取命令行参数
 */
export function getFlags(): CliFlags {
	return runtimeFlags;
}
