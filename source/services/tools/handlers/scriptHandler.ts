/**
 * Script execution handler
 * Handles running script content through interpreters
 */

import type { RegisteredHandler, ExecutionResult } from "./types.js";
import {
	writeScript,
	buildScriptCommand,
	type ScriptType,
} from "../scriptWriter.js";
import { executeCommand } from "../executorUtils.js";

// Map tool IDs to script types for run_script_content action
const TOOL_SCRIPT_TYPE_MAP: Record<string, ScriptType> = {
	"a-c-powershell": "powershell",
	"a-c-pwsh": "pwsh", // PowerShell Core - uses pwsh command
	"a-python": "python",
	"a-c-cmd": "cmd",
	"a-c-bash": "bash",
};

/**
 * Script handler - handles run_script_content action
 */
export const scriptHandler: RegisteredHandler = {
	name: "script",
	matches: (ctx) =>
		ctx.action.name === "run_script_content" &&
		ctx.action.commandTemplate === "__SCRIPT_EXECUTION__",
	handle: async (ctx) => {
		const { tool, params, options } = ctx;

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

		const content = params.content as string;
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
	},
};

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
