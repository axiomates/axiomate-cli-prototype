/**
 * Tool command executor
 * Handles command template rendering and execution
 *
 * NOTE: Shell commands from AI are executed as-is without escaping.
 * Escaping would break valid shell syntax ($variables, backticks, pipes, etc.)
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
 * Render command template
 * Replaces {{param}} placeholders with actual values
 */
export function renderCommandTemplate(
	template: string,
	params: Record<string, unknown>,
	tool?: DiscoveredTool,
): string {
	let result = template;

	// Replace special variable {{execPath}}
	if (tool) {
		result = result.replace(/\{\{execPath\}\}/g, tool.executablePath);
	}

	// Replace parameters as-is
	for (const [key, value] of Object.entries(params)) {
		const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		result = result.replace(placeholder, String(value ?? ""));
	}

	// Remove unreplaced placeholders
	result = result.replace(/\{\{[^}]+\}\}/g, "");

	// Clean up extra spaces
	result = result.replace(/\s+/g, " ").trim();

	return result;
}

/**
 * Validate parameters
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
			errors.push(`Missing required parameter: ${param.name}`);
			continue;
		}

		if (value !== undefined && value !== null) {
			switch (param.type) {
				case "number":
					if (typeof value !== "number" && isNaN(Number(value))) {
						errors.push(`Parameter ${param.name} must be a number`);
					}
					break;
				case "boolean":
					if (
						typeof value !== "boolean" &&
						value !== "true" &&
						value !== "false"
					) {
						errors.push(`Parameter ${param.name} must be a boolean`);
					}
					break;
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Fill default values
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
 * Execute command
 * Note: Encoding handling should be done by each tool's commandTemplate,
 * not here. This function just executes the command as-is.
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
		const spawnOptions: SpawnOptions = {
			cwd: options?.cwd,
			env: {
				...process.env,
				...options?.env,
			},
			shell: options?.shell ?? true,
			windowsHide: true,
		};

		const proc = spawn(command, [], spawnOptions);

		let stdout = "";
		let stderr = "";
		let timedOut = false;

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
				error: timedOut ? "Command execution timed out" : undefined,
			});
		});
	});
}

/**
 * Execute tool action
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
	if (!tool.installed) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Tool ${tool.name} is not installed. ${tool.installHint || ""}`,
		};
	}

	const validation = validateParams(action, params);
	if (!validation.valid) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Parameter validation failed: ${validation.errors.join(", ")}`,
		};
	}

	const filledParams = fillDefaults(action, params);
	const command = renderCommandTemplate(
		action.commandTemplate,
		filledParams,
		tool,
	);

	return executeCommand(command, {
		cwd: options?.cwd,
		env: tool.env,
		timeout: options?.timeout,
	});
}

/**
 * Get tool action by name
 */
export function getToolAction(
	tool: DiscoveredTool,
	actionName: string,
): ToolAction | undefined {
	return tool.actions.find((a) => a.name === actionName);
}

/**
 * Convert parameter definitions to JSON Schema (for MCP/OpenAI)
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
