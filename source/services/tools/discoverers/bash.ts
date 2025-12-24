/**
 * Bash shell tool discoverer
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const bashDefinition: ToolDefinition = {
	id: "bash",
	name: "Bash",
	description: "Unix shell script interpreter",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "Execute Bash command",
			parameters: [
				{
					name: "command",
					description: "Bash command",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'bash -c "{{command}}"',
		},
		{
			name: "run_script",
			description: "Run shell script",
			parameters: [
				{
					name: "file",
					description: "Script file path (.sh)",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "bash {{file}}",
		},
		{
			name: "version",
			description: "Show Bash version",
			parameters: [],
			commandTemplate: "bash --version",
		},
	],
	installHint:
		"Linux/macOS: Usually pre-installed\nWindows: Install Git Bash or WSL",
};

export async function detectBash(): Promise<DiscoveredTool> {
	if (!(await commandExists("bash"))) {
		return createNotInstalledTool(bashDefinition);
	}

	const execPath = await getExecutablePath("bash");
	const version = await getVersion("bash", ["--version"], {
		parseOutput: (output) => {
			// "GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)"
			// -> "5.1.16"
			const match = output.match(/version (\d+\.\d+\.\d+)/);
			return match ? match[1] : output.split("\n")[0].trim();
		},
	});

	return createInstalledTool(
		bashDefinition,
		execPath || "bash",
		version || undefined,
	);
}
