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
			name: "run_script_content",
			description:
				"Create and run a Bash script from content. The script is saved to .axiomate/scripts/ as UTF-8 and executed. This is the primary way to execute shell scripts.",
			parameters: [
				{
					name: "content",
					description: "Bash script content",
					type: "string",
					required: true,
				},
			],
			// Special action: handled by executeScript() in executor.ts
			commandTemplate: "__SCRIPT_EXECUTION__",
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
