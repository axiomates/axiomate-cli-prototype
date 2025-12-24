/**
 * 工具命令执行器
 * 负责执行工具动作，处理命令模板
 */

import { spawn, type SpawnOptions } from "node:child_process";
import type { DiscoveredTool, ToolAction, ToolParameter } from "./types.js";

export type ExecutionResult = {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	error?: string;
};

/**
 * 渲染命令模板
 * 将 {{param}} 占位符替换为实际值
 */
export function renderCommandTemplate(
	template: string,
	params: Record<string, unknown>,
	tool?: DiscoveredTool,
): string {
	let result = template;

	// 替换特殊变量
	if (tool) {
		result = result.replace(/\{\{execPath\}\}/g, tool.executablePath);
	}

	// 替换普通参数
	for (const [key, value] of Object.entries(params)) {
		const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		result = result.replace(placeholder, String(value ?? ""));
	}

	// 处理条件表达式 {{condition ? 'true' : 'false'}}
	// 简化处理：移除未替换的占位符
	result = result.replace(/\{\{[^}]+\}\}/g, "");

	// 清理多余空格
	result = result.replace(/\s+/g, " ").trim();

	return result;
}

/**
 * 验证参数
 */
export function validateParams(
	action: ToolAction,
	params: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const param of action.parameters) {
		const value = params[param.name];

		if (
			param.required &&
			(value === undefined || value === null || value === "")
		) {
			errors.push(`缺少必需参数: ${param.name}`);
			continue;
		}

		if (value !== undefined && value !== null) {
			// 类型检查
			switch (param.type) {
				case "number":
					if (typeof value !== "number" && isNaN(Number(value))) {
						errors.push(`参数 ${param.name} 必须是数字`);
					}
					break;
				case "boolean":
					if (
						typeof value !== "boolean" &&
						value !== "true" &&
						value !== "false"
					) {
						errors.push(`参数 ${param.name} 必须是布尔值`);
					}
					break;
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * 填充默认值
 */
export function fillDefaults(
	action: ToolAction,
	params: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...params };

	for (const param of action.parameters) {
		if (result[param.name] === undefined && param.default !== undefined) {
			result[param.name] = param.default;
		}
	}

	return result;
}

/**
 * 执行命令
 */
export async function executeCommand(
	command: string,
	options?: {
		cwd?: string;
		env?: Record<string, string>;
		timeout?: number;
		shell?: boolean;
	},
): Promise<ExecutionResult> {
	return new Promise((resolve) => {
		// Windows 下设置代码页为 UTF-8 (65001)
		const isWindows = process.platform === "win32";
		const finalCommand = isWindows ? `chcp 65001 >nul && ${command}` : command;

		const spawnOptions: SpawnOptions = {
			cwd: options?.cwd,
			env: {
				...process.env,
				...options?.env,
				// 确保 PowerShell 使用 UTF-8
				...(isWindows && { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }),
			},
			shell: options?.shell ?? true,
			windowsHide: true,
		};

		const proc = spawn(finalCommand, [], spawnOptions);

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		// 超时处理
		const timeout = options?.timeout ?? 30000;
		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
		}, timeout);

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString("utf8");
		});

		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString("utf8");
		});

		proc.on("error", (err) => {
			clearTimeout(timer);
			resolve({
				success: false,
				stdout,
				stderr,
				exitCode: null,
				error: err.message,
			});
		});

		proc.on("close", (code) => {
			clearTimeout(timer);
			resolve({
				success: code === 0 && !timedOut,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				exitCode: code,
				error: timedOut ? "命令执行超时" : undefined,
			});
		});
	});
}

/**
 * 执行工具动作
 */
export async function executeToolAction(
	tool: DiscoveredTool,
	action: ToolAction,
	params: Record<string, unknown>,
	options?: {
		cwd?: string;
		timeout?: number;
	},
): Promise<ExecutionResult> {
	// 检查工具是否已安装
	if (!tool.installed) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `工具 ${tool.name} 未安装。${tool.installHint || ""}`,
		};
	}

	// 验证参数
	const validation = validateParams(action, params);
	if (!validation.valid) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `参数验证失败: ${validation.errors.join(", ")}`,
		};
	}

	// 填充默认值
	const filledParams = fillDefaults(action, params);

	// 渲染命令
	const command = renderCommandTemplate(
		action.commandTemplate,
		filledParams,
		tool,
	);

	// 执行命令
	return executeCommand(command, {
		cwd: options?.cwd,
		env: tool.env,
		timeout: options?.timeout,
	});
}

/**
 * 获取工具的动作
 */
export function getToolAction(
	tool: DiscoveredTool,
	actionName: string,
): ToolAction | undefined {
	return tool.actions.find((a) => a.name === actionName);
}

/**
 * 将参数定义转换为 JSON Schema（用于 MCP/OpenAI）
 */
export function paramsToJsonSchema(params: ToolParameter[]): {
	type: "object";
	properties: Record<string, unknown>;
	required: string[];
} {
	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const param of params) {
		const schema: Record<string, unknown> = {
			description: param.description,
		};

		switch (param.type) {
			case "string":
			case "file":
			case "directory":
				schema.type = "string";
				break;
			case "number":
				schema.type = "number";
				break;
			case "boolean":
				schema.type = "boolean";
				break;
		}

		if (param.default !== undefined) {
			schema.default = param.default;
		}

		properties[param.name] = schema;

		if (param.required) {
			required.push(param.name);
		}
	}

	return {
		type: "object",
		properties,
		required,
	};
}
