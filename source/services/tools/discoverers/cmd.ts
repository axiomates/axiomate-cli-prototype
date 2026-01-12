/**
 * Windows CMD tool discoverer
 */

import { platform } from "node:os";
import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const cmdDefinition: ToolDefinition = {
	id: "a-c-cmd",
	name: "CMD",
	description: "Windows Command Prompt",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run_script_content",
			description:
				"Create and run a batch script from content. The script is saved to .axiomate/scripts/ as UTF-8 and executed with chcp 65001. This is the primary way to execute batch scripts.",
			parameters: [
				{
					name: "content",
					description: "Batch script content",
					type: "string",
					required: true,
				},
			],
			// Special action: handled by executeScript() in executor.ts
			commandTemplate: "__SCRIPT_EXECUTION__",
		},
		{
			name: "version",
			description: "Show CMD version",
			parameters: [],
			commandTemplate: "ver",
		},
	],
	installHint: "Included with Windows",
};

export async function detectCmd(): Promise<DiscoveredTool> {
	// CMD is only available on Windows
	if (platform() !== "win32") {
		return createNotInstalledTool(cmdDefinition);
	}

	if (!(await commandExists("cmd"))) {
		return createNotInstalledTool(cmdDefinition);
	}

	const execPath = await getExecutablePath("cmd");

	// CMD version is not easily retrievable, skip version
	return createInstalledTool(cmdDefinition, execPath || "cmd", undefined);
}
