/**
 * 工具发现基础设施
 * 提供跨平台的工具检测、版本获取等功能
 *
 * 注意：所有函数都使用异步 spawn 以避免阻塞事件循环
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";
import { existsSync } from "node:fs";
import type { DiscoveredTool, ToolDefinition } from "../types.js";

const isWindows = platform() === "win32";

/**
 * 执行命令并返回结果（异步版本）
 */
function execCommand(
	cmd: string,
	args: string[],
	options?: { timeout?: number },
): Promise<{ status: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let resolved = false;

		const proc = spawn(cmd, args, {
			stdio: "pipe",
			windowsHide: true,
		});

		// 设置超时
		const timeout = options?.timeout ?? 5000;
		const timer = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				proc.kill();
				resolve({ status: -1, stdout, stderr });
			}
		}, timeout);

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timer);
				resolve({ status: code ?? -1, stdout, stderr });
			}
		});

		proc.on("error", () => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timer);
				resolve({ status: -1, stdout, stderr });
			}
		});
	});
}

/**
 * 检测命令是否存在（异步）
 */
export async function commandExists(cmd: string): Promise<boolean> {
	const result = await execCommand(isWindows ? "where" : "which", [cmd], {
		timeout: 3000,
	});
	return result.status === 0;
}

/**
 * 获取可执行文件的完整路径（异步）
 */
export async function getExecutablePath(cmd: string): Promise<string | null> {
	const result = await execCommand(isWindows ? "where" : "which", [cmd], {
		timeout: 3000,
	});
	if (result.status === 0 && result.stdout) {
		// where 在 Windows 可能返回多行，取第一行
		const lines = result.stdout.trim().split(/\r?\n/);
		return lines[0] || null;
	}
	return null;
}

/**
 * 执行命令获取版本信息（异步）
 */
export async function getVersion(
	cmd: string,
	args: string[] = ["--version"],
	options?: {
		parseOutput?: (output: string) => string;
		useStderr?: boolean; // java -version 输出到 stderr
	},
): Promise<string | null> {
	const result = await execCommand(cmd, args, { timeout: 5000 });

	const output = options?.useStderr ? result.stderr : result.stdout;
	if (output) {
		const trimmed = output.trim();
		if (options?.parseOutput) {
			return options.parseOutput(trimmed);
		}
		// 默认取第一行
		return trimmed.split(/\r?\n/)[0] || null;
	}
	return null;
}

/**
 * 检查文件是否存在
 */
export function fileExists(path: string): boolean {
	return existsSync(path);
}

/**
 * Windows 注册表查询（异步）
 */
export async function queryRegistry(
	keyPath: string,
	valueName?: string,
): Promise<string | null> {
	if (!isWindows) return null;

	const args = ["query", keyPath];
	if (valueName) {
		args.push("/v", valueName);
	}

	const result = await execCommand("reg", args, { timeout: 3000 });

	if (result.status === 0 && result.stdout) {
		// 解析 reg query 输出
		const lines = result.stdout.split(/\r?\n/);
		for (const line of lines) {
			if (valueName) {
				// 查找特定值
				if (line.includes(valueName)) {
					const match = line.match(/REG_\w+\s+(.+)$/);
					if (match) {
						return match[1].trim();
					}
				}
			} else {
				// 返回默认值
				if (line.includes("(Default)")) {
					const match = line.match(/REG_\w+\s+(.+)$/);
					if (match) {
						return match[1].trim();
					}
				}
			}
		}
	}
	return null;
}

/**
 * 使用 vswhere.exe 查找 Visual Studio 安装（异步）
 */
export async function findVisualStudio(): Promise<{
	installPath: string;
	version: string;
	productId: string;
} | null> {
	if (!isWindows) return null;

	// vswhere.exe 的常见位置
	const vswherePaths = [
		"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
		"C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe",
	];

	let vswherePath: string | null = null;
	for (const p of vswherePaths) {
		if (fileExists(p)) {
			vswherePath = p;
			break;
		}
	}

	if (!vswherePath) {
		// 尝试在 PATH 中查找
		vswherePath = await getExecutablePath("vswhere");
	}

	if (!vswherePath) return null;

	const result = await execCommand(
		vswherePath,
		["-latest", "-format", "json", "-utf8"],
		{ timeout: 5000 },
	);

	if (result.status === 0 && result.stdout) {
		try {
			const data = JSON.parse(result.stdout);
			if (Array.isArray(data) && data.length > 0) {
				const vs = data[0];
				return {
					installPath: vs.installationPath,
					version: vs.installationVersion,
					productId: vs.productId,
				};
			}
		} catch {
			// ignore JSON parse error
		}
	}
	return null;
}

/**
 * 创建未安装的工具对象
 */
export function createNotInstalledTool(
	definition: ToolDefinition,
): DiscoveredTool {
	return {
		...definition,
		executablePath: "",
		installed: false,
	};
}

/**
 * 创建已安装的工具对象
 */
export function createInstalledTool(
	definition: ToolDefinition,
	executablePath: string,
	version?: string,
): DiscoveredTool {
	return {
		...definition,
		executablePath,
		version,
		installed: true,
	};
}
