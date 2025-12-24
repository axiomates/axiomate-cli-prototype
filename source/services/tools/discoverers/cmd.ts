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
	id: "cmd",
	name: "CMD",
	description: "Windows Command Prompt",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "Execute CMD command",
			parameters: [
				{
					name: "command",
					description: "CMD command",
					type: "string",
					required: true,
				},
			],
			// chcp 65001 sets console to UTF-8 for proper output display
			commandTemplate: 'chcp 65001 >nul & cmd /C "{{command}}"',
		},
		{
			name: "run_script",
			description: "Run batch script",
			parameters: [
				{
					name: "file",
					description: "Batch file path (.bat/.cmd)",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "chcp 65001 >nul & cmd /C {{file}}",
		},
		{
			name: "version",
			description: "Show CMD version",
			parameters: [],
			commandTemplate: "chcp 65001 >nul & cmd /C ver",
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
