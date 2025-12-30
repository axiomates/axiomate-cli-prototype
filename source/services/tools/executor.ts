/**
 * Tool command executor
 * Handles command template rendering and execution
 *
 * NOTE: Shell commands from AI are executed as-is without escaping.
 * Escaping would break valid shell syntax ($variables, backticks, pipes, etc.)
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { join, isAbsolute } from "node:path";
import type { DiscoveredTool, ToolAction, ToolParameter } from "./types.js";
import {
	writeScript,
	buildScriptCommand,
	type ScriptType,
} from "./scriptWriter.js";
import {
	readFileContent,
	writeFileContent,
	editFileContent,
	readFileLines,
	searchInFile,
	type WriteMode,
} from "./fileOperations.js";
import { getPlanFilePath } from "./discoverers/plan.js";
import { getCurrentModelId, getModelById } from "../../utils/config.js";

// Map tool IDs to script types for run_script_content action
const TOOL_SCRIPT_TYPE_MAP: Record<string, ScriptType> = {
	powershell: "powershell",
	pwsh: "pwsh", // PowerShell Core - uses pwsh command
	python: "python",
	cmd: "cmd",
	bash: "bash",
};

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

		const timeout = options?.timeout ?? 180000; // 3 minutes default
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

	// Handle builtin web fetch tool
	if (tool.id === "web" && action.name === "fetch") {
		return executeWebFetch(filledParams.url as string, options?.timeout);
	}

	// Handle file operations
	if (action.commandTemplate === "__FILE_READ__") {
		const path = filledParams.path as string;
		const encoding = filledParams.encoding as string | undefined;
		const cwd = options?.cwd || process.cwd();
		const fullPath = isAbsolute(path) ? path : join(cwd, path);
		const result = readFileContent(fullPath, encoding);
		const encodingInfo = result.encoding
			? `[Encoding: ${result.encoding.encoding}${result.encoding.hasBOM ? " (with BOM)" : ""}]\n`
			: "";
		return {
			success: result.success,
			stdout: result.success ? encodingInfo + (result.content || "") : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__FILE_READ_LINES__") {
		const path = filledParams.path as string;
		const startLine = (filledParams.start_line as number) || 1;
		const endLine = (filledParams.end_line as number) ?? -1;
		const cwd = options?.cwd || process.cwd();
		const fullPath = isAbsolute(path) ? path : join(cwd, path);
		const result = readFileLines(fullPath, startLine, endLine);
		const header = result.success
			? `[Lines ${result.startLine}-${result.endLine} of ${result.totalLines}]\n`
			: "";
		return {
			success: result.success,
			stdout: result.success ? header + (result.lines?.join("\n") || "") : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__FILE_WRITE__") {
		const path = filledParams.path as string;
		const content = filledParams.content as string;
		const mode = (filledParams.mode as WriteMode) || "overwrite";
		const encoding = filledParams.encoding as string | undefined;
		const cwd = options?.cwd || process.cwd();
		const fullPath = isAbsolute(path) ? path : join(cwd, path);
		const result = writeFileContent(fullPath, content, mode, encoding);
		return {
			success: result.success,
			stdout: result.success
				? `Written to ${result.path} (encoding: ${result.encoding || "utf-8"})`
				: "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__FILE_SEARCH__") {
		const path = filledParams.path as string;
		const pattern = filledParams.pattern as string;
		const isRegex = filledParams.regex === true;
		const maxMatches = (filledParams.max_matches as number) || 100;
		const cwd = options?.cwd || process.cwd();
		const fullPath = isAbsolute(path) ? path : join(cwd, path);

		const searchPattern = isRegex ? new RegExp(pattern, "gm") : pattern;
		const result = searchInFile(fullPath, searchPattern, maxMatches);

		const output = result.success
			? result.matches.length > 0
				? result.matches
						.map((m) => `${m.line}:${m.column}: ${m.content}`)
						.join("\n")
				: "(no matches)"
			: "";

		return {
			success: result.success,
			stdout: output,
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__FILE_EDIT__") {
		const path = filledParams.path as string;
		const oldContent = filledParams.old_content as string;
		const newContent = filledParams.new_content as string;
		const replaceAll = filledParams.replace_all === true;
		const cwd = options?.cwd || process.cwd();
		const fullPath = isAbsolute(path) ? path : join(cwd, path);
		const result = editFileContent(fullPath, oldContent, newContent, replaceAll);
		return {
			success: result.success,
			stdout: result.success
				? `Replaced ${result.replaced} occurrence(s) in ${result.path}`
				: "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	// Handle plan operations (uses file operations but with fixed path)
	if (action.commandTemplate === "__PLAN_READ__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const result = readFileContent(planPath);
		return {
			success: true, // Always success, even if file doesn't exist
			stdout: result.content || "[No plan file exists yet]",
			stderr: "",
			exitCode: 0,
		};
	}

	if (action.commandTemplate === "__PLAN_WRITE__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const content = filledParams.content as string;
		const result = writeFileContent(planPath, content, "overwrite");
		return {
			success: result.success,
			stdout: result.success ? `Plan written to ${result.path}` : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__PLAN_READ_LINES__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const startLine = (filledParams.start_line as number) || 1;
		const endLine = (filledParams.end_line as number) ?? -1;
		const result = readFileLines(planPath, startLine, endLine);
		const header = result.success
			? `[Lines ${result.startLine}-${result.endLine} of ${result.totalLines}]\n`
			: "";
		return {
			success: result.success,
			stdout: result.success ? header + (result.lines?.join("\n") || "") : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__PLAN_APPEND__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const content = filledParams.content as string;
		const result = writeFileContent(planPath, content, "append");
		return {
			success: result.success,
			stdout: result.success ? `Content appended to ${result.path}` : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__PLAN_EDIT__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const oldContent = filledParams.old_content as string;
		const newContent = filledParams.new_content as string;
		const replaceAll = filledParams.replace_all === true;
		const result = editFileContent(planPath, oldContent, newContent, replaceAll);
		return {
			success: result.success,
			stdout: result.success ? "Plan updated" : "",
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	if (action.commandTemplate === "__PLAN_SEARCH__") {
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);
		const pattern = filledParams.pattern as string;
		const isRegex = filledParams.regex === true;
		const maxMatches = (filledParams.max_matches as number) || 100;

		const searchPattern = isRegex ? new RegExp(pattern, "gm") : pattern;
		const result = searchInFile(planPath, searchPattern, maxMatches);

		const output = result.success
			? result.matches.length > 0
				? result.matches
						.map((m) => `${m.line}:${m.column}: ${m.content}`)
						.join("\n")
				: "(no matches)"
			: "";

		return {
			success: result.success,
			stdout: output,
			stderr: "",
			exitCode: result.success ? 0 : 1,
			error: result.error,
		};
	}

	// Handle special run_script_content action
	if (
		action.name === "run_script_content" &&
		action.commandTemplate === "__SCRIPT_EXECUTION__"
	) {
		const scriptType = TOOL_SCRIPT_TYPE_MAP[tool.id];
		if (!scriptType) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: `Tool ${tool.id} does not support script execution`,
			};
		}

		const content = filledParams.content as string;
		if (!content) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: "Script content is required",
			};
		}

		return executeScript(scriptType, content, {
			cwd: options?.cwd,
			env: tool.env,
			timeout: options?.timeout,
			prefix: tool.id,
		});
	}

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
 * Execute a script by writing it to a temporary file and running it
 * @param scriptType - The type of script (powershell, python, cmd, bash)
 * @param content - The script content
 * @param options - Execution options
 * @returns Execution result with script file path in stdout prefix
 */
export async function executeScript(
	scriptType: ScriptType,
	content: string,
	options?: {
		cwd?: string;
		env?: Record<string, string>;
		timeout?: number;
		prefix?: string;
	},
): Promise<ExecutionResult> {
	const cwd = options?.cwd || process.cwd();

	try {
		// Write script to temporary file
		const scriptPath = writeScript(cwd, scriptType, content, {
			prefix: options?.prefix,
		});

		// Build and execute the command
		const command = buildScriptCommand(scriptType, scriptPath);

		const result = await executeCommand(command, {
			cwd,
			env: options?.env,
			timeout: options?.timeout,
		});

		// Prepend script path info to stdout for reference
		const pathInfo = `[Script: ${scriptPath}]\n`;
		return {
			...result,
			stdout: result.stdout ? pathInfo + result.stdout : pathInfo.trim(),
		};
	} catch (err) {
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Failed to create script file: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
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

/**
 * Execute web fetch (builtin tool)
 * Fetches URL content and converts HTML to readable text
 */
async function executeWebFetch(
	url: string,
	timeout?: number,
): Promise<ExecutionResult> {
	try {
		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: `Invalid URL: ${url}`,
			};
		}

		// Only allow http/https
		if (!parsedUrl.protocol.startsWith("http")) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: `Unsupported protocol: ${parsedUrl.protocol}`,
			};
		}

		// Fetch with timeout
		const controller = new AbortController();
		const timeoutMs = timeout ?? 60000; // 1 minute default
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; axiomate/1.0; +https://github.com/anthropics/axiomate)",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
			},
		});

		clearTimeout(timer);

		if (!response.ok) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: response.status,
				error: `HTTP ${response.status}: ${response.statusText}`,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		const text = await response.text();

		// Convert HTML to readable text
		let content: string;
		if (contentType.includes("text/html")) {
			content = htmlToText(text);
		} else {
			content = text;
		}

		// Calculate max length based on model's context window
		// Use ~4 chars per token, reserve 50% for response
		const modelId = getCurrentModelId();
		const model = modelId ? getModelById(modelId) : null;
		const contextWindow = model?.contextWindow ?? 32000; // Default 32K if no model
		const maxTokensForContent = Math.floor(contextWindow * 0.5); // 50% for content
		const maxLength = maxTokensForContent * 4; // ~4 chars per token

		if (content.length > maxLength) {
			content =
				content.substring(0, maxLength) +
				`\n\n[Content truncated, total ${content.length} characters, limit ${maxLength} based on context window ${contextWindow}]`;
		}

		return {
			success: true,
			stdout: `[URL: ${url}]\n[Content-Type: ${contentType}]\n\n${content}`,
			stderr: "",
			exitCode: 0,
		};
	} catch (err) {
		const message =
			err instanceof Error
				? err.name === "AbortError"
					? "Request timed out"
					: err.message
				: String(err);
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: message,
		};
	}
}

/**
 * Convert HTML to readable plain text
 * Simple implementation without external dependencies
 */
function htmlToText(html: string): string {
	let text = html;

	// Remove script and style content
	text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
	text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

	// Convert common block elements to newlines
	text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
	text = text.replace(/<(br|hr)[^>]*\/?>/gi, "\n");

	// Convert list items
	text = text.replace(/<li[^>]*>/gi, "• ");

	// Extract link URLs
	text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)");

	// Remove remaining HTML tags
	text = text.replace(/<[^>]+>/g, "");

	// Decode HTML entities
	text = decodeHtmlEntities(text);

	// Clean up whitespace
	text = text.replace(/\r\n/g, "\n");
	text = text.replace(/[ \t]+/g, " ");
	text = text.replace(/\n[ \t]+/g, "\n");
	text = text.replace(/[ \t]+\n/g, "\n");
	text = text.replace(/\n{3,}/g, "\n\n");
	text = text.trim();

	return text;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		"&amp;": "&",
		"&lt;": "<",
		"&gt;": ">",
		"&quot;": '"',
		"&apos;": "'",
		"&nbsp;": " ",
		"&copy;": "©",
		"&reg;": "®",
		"&trade;": "™",
		"&mdash;": "—",
		"&ndash;": "–",
		"&hellip;": "…",
		"&laquo;": "«",
		"&raquo;": "»",
		"&bull;": "•",
	};

	let result = text;
	for (const [entity, char] of Object.entries(entities)) {
		result = result.replace(new RegExp(entity, "gi"), char);
	}

	// Decode numeric entities
	result = result.replace(/&#(\d+);/g, (_, code) =>
		String.fromCharCode(parseInt(code, 10)),
	);
	result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
		String.fromCharCode(parseInt(code, 16)),
	);

	return result;
}
