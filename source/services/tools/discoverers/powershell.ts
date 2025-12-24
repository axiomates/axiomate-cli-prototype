/**
 * PowerShell tool discoverer
 *
 * IMPORTANT: PowerShell is for Windows system operations ONLY.
 * DO NOT use PowerShell for file read/write operations - use Python instead.
 *
 * PowerShell 5.1 has known encoding issues:
 * - Console encoding may not match file encoding
 * - UTF-8 with BOM handling is inconsistent
 * - Non-ASCII characters may be corrupted
 *
 * For file operations, Python is preferred because it properly handles:
 * - Encoding detection (UTF-8, UTF-8 BOM, GBK, etc.)
 * - Line ending detection and preservation (LF/CRLF)
 * - UTF-8 as default with proper fallback
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const powershellDefinition: ToolDefinition = {
	id: "powershell",
	name: "PowerShell",
	description:
		"Windows PowerShell 5.1 for Windows system operations. NOT recommended for file read/write - use Python instead.",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run_script_content",
			description:
				"Create and run a PowerShell script from content. The script is saved to .axiomate/scripts/ as UTF-8 with BOM and executed. This is the primary way to execute PowerShell code.",
			parameters: [
				{
					name: "content",
					description: "PowerShell script content",
					type: "string",
					required: true,
				},
			],
			// Special action: handled by executeScript() in executor.ts
			commandTemplate: "__SCRIPT_EXECUTION__",
		},
		{
			name: "version",
			description: "Show PowerShell version",
			parameters: [],
			commandTemplate:
				'powershell -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"',
		},
	],
	installHint:
		"Windows includes PowerShell 5.1 by default.\nFor PowerShell 7+: winget install --id Microsoft.PowerShell --source winget, see https://github.com/PowerShell/PowerShell",
};

// PowerShell Core (pwsh) - cross-platform version
const pwshDefinition: ToolDefinition = {
	id: "pwsh",
	name: "PowerShell Core",
	description:
		"Cross-platform PowerShell 7+. Better encoding support than Windows PowerShell 5.1.",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run_script_content",
			description:
				"Create and run a PowerShell script from content. The script is saved to .axiomate/scripts/ as UTF-8 with BOM and executed. This is the primary way to execute PowerShell code.",
			parameters: [
				{
					name: "content",
					description: "PowerShell script content",
					type: "string",
					required: true,
				},
			],
			// Special action: handled by executeScript() in executor.ts
			commandTemplate: "__SCRIPT_EXECUTION__",
		},
		{
			name: "version",
			description: "Show version",
			parameters: [],
			commandTemplate: "pwsh --version",
		},
	],
	installHint: "Download from https://github.com/PowerShell/PowerShell",
};

export async function detectPowershell(): Promise<DiscoveredTool> {
	// powershell.exe on Windows
	if (!(await commandExists("powershell"))) {
		return createNotInstalledTool(powershellDefinition);
	}

	const execPath = await getExecutablePath("powershell");
	const version = await getVersion(
		"powershell",
		["-Command", "$PSVersionTable.PSVersion.ToString()"],
		{
			parseOutput: (output) => output.trim(),
		},
	);

	return createInstalledTool(
		powershellDefinition,
		execPath || "powershell",
		version || undefined,
	);
}

export async function detectPwsh(): Promise<DiscoveredTool> {
	if (!(await commandExists("pwsh"))) {
		return createNotInstalledTool(pwshDefinition);
	}

	const execPath = await getExecutablePath("pwsh");
	const version = await getVersion("pwsh", ["--version"], {
		parseOutput: (output) => {
			// "PowerShell 7.4.1" -> "7.4.1"
			const match = output.match(/PowerShell (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		pwshDefinition,
		execPath || "pwsh",
		version || undefined,
	);
}
