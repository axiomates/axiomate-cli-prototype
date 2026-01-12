/**
 * 工具常量定义
 *
 * 统一管理核心工具和平台工具的定义，避免重复代码
 */

import { platform } from "node:os";

/**
 * Action 模式核心工具集（不含平台 shell）
 * 这些工具在 Action 模式下始终可用，都以 a-c- 开头
 */
export const ACTION_CORE_TOOLS = new Set([
	"a-c-askuser",
	"a-c-file",
	"a-c-web",
	"a-c-git",
	"a-c-enterplan",
]);

/**
 * Plan 模式工具集
 */
export const PLAN_TOOLS = new Set(["p-plan"]);

/**
 * 完整核心工具集（Action + Plan，不含平台 shell）
 * 用于集合B的计算
 */
export const CORE_TOOLS = new Set([...ACTION_CORE_TOOLS, ...PLAN_TOOLS]);

/**
 * Windows 平台 shell 工具
 */
export const WINDOWS_SHELL_TOOLS = new Set([
	"a-c-powershell",
	"a-c-pwsh",
	"a-c-cmd",
]);

/**
 * Unix/Linux/macOS 平台 shell 工具
 */
export const UNIX_SHELL_TOOLS = new Set(["a-c-bash"]);

/**
 * 获取当前平台的 shell 工具集
 */
export function getPlatformShellTools(): Set<string> {
	return platform() === "win32" ? WINDOWS_SHELL_TOOLS : UNIX_SHELL_TOOLS;
}

/**
 * 获取当前平台应排除的 shell 工具集
 */
export function getExcludedShellTools(): Set<string> {
	return platform() === "win32" ? UNIX_SHELL_TOOLS : WINDOWS_SHELL_TOOLS;
}

/**
 * 获取完整的核心工具集（含平台 shell）
 * 用于计算集合B（项目工具集）
 */
export function getFullCoreTools(): Set<string> {
	return new Set([...CORE_TOOLS, ...getPlatformShellTools()]);
}

/**
 * 获取默认的平台 shell 工具 ID
 * Windows 默认 powershell，其他平台默认 bash
 */
export function getDefaultShellTool(): string {
	return platform() === "win32" ? "a-c-powershell" : "a-c-bash";
}
