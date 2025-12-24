/**
 * Python tool discoverer
 *
 * Python is the preferred tool for file operations on Windows because:
 * - Better UTF-8 encoding handling than PowerShell 5.1
 * - Can detect and preserve file encodings (UTF-8, UTF-8 BOM, GBK, etc.)
 * - Can detect and preserve line endings (LF/CRLF)
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const pythonDefinition: ToolDefinition = {
	id: "python",
	name: "Python",
	description:
		"Python programming language interpreter. Preferred for file operations due to better encoding support.",
	category: "runtime",
	capabilities: ["execute"],
	// Ensure Python uses UTF-8 encoding for I/O
	env: {
		PYTHONUTF8: "1",
		PYTHONIOENCODING: "utf-8",
	},
	actions: [
		{
			name: "run_script_content",
			description:
				"Create and run a Python script from content. The script is saved to .axiomate/scripts/ as UTF-8 and executed. This is the primary way to execute Python code.",
			parameters: [
				{
					name: "content",
					description: "Python script content",
					type: "string",
					required: true,
				},
			],
			// Special action: handled by executeScript() in executor.ts
			commandTemplate: "__SCRIPT_EXECUTION__",
		},
		{
			name: "run",
			description: "Run existing Python script file",
			parameters: [
				{
					name: "file",
					description: "Python file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "python {{file}}",
		},
		{
			name: "version",
			description: "Show Python version",
			parameters: [],
			commandTemplate: "python --version",
		},
		{
			name: "pip_install",
			description: "Install package via pip",
			parameters: [
				{
					name: "package",
					description: "Package name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "python -m pip install {{package}}",
		},
		{
			name: "pip_list",
			description: "List installed packages",
			parameters: [],
			commandTemplate: "python -m pip list",
		},
	],
	installHint: "Download from https://www.python.org/downloads/",
};

export async function detectPython(): Promise<DiscoveredTool> {
	// Try both python and python3
	const cmds = ["python", "python3"];
	let foundCmd: string | null = null;

	for (const cmd of cmds) {
		if (await commandExists(cmd)) {
			foundCmd = cmd;
			break;
		}
	}

	if (!foundCmd) {
		return createNotInstalledTool(pythonDefinition);
	}

	const execPath = await getExecutablePath(foundCmd);
	const version = await getVersion(foundCmd, ["--version"], {
		parseOutput: (output) => {
			// "Python 3.11.5" -> "3.11.5"
			const match = output.match(/Python (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		pythonDefinition,
		execPath || foundCmd,
		version || undefined,
	);
}
