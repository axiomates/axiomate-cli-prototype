/**
 * VS Code tool discoverer
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const vscodeDefinition: ToolDefinition = {
	id: "vscode",
	name: "Visual Studio Code",
	description: "Lightweight code editor",
	category: "ide",
	capabilities: ["edit"],
	actions: [
		{
			name: "open",
			description: "Open file or folder",
			parameters: [
				{
					name: "path",
					description: "File or folder path",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code {{path}}",
		},
		{
			name: "open_new_window",
			description: "Open in new window",
			parameters: [
				{
					name: "path",
					description: "File or folder path",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code -n {{path}}",
		},
		{
			name: "diff",
			description: "Compare two files",
			parameters: [
				{
					name: "left",
					description: "Left file",
					type: "file",
					required: true,
				},
				{
					name: "right",
					description: "Right file",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "code --diff {{left}} {{right}}",
		},
		{
			name: "goto",
			description: "Open file and go to specific line and column",
			parameters: [
				{
					name: "file",
					description: "File path",
					type: "file",
					required: true,
				},
				{
					name: "line",
					description: "Line number",
					type: "number",
					required: true,
				},
				{
					name: "column",
					description: "Column number",
					type: "number",
					required: false,
					default: 1,
				},
			],
			commandTemplate: "code -g {{file}}:{{line}}:{{column}}",
		},
		{
			name: "install_extension",
			description: "Install extension",
			parameters: [
				{
					name: "extension",
					description: "Extension ID",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code --install-extension {{extension}}",
		},
		{
			name: "list_extensions",
			description: "List installed extensions",
			parameters: [],
			commandTemplate: "code --list-extensions",
		},
	],
	installHint: "Download from https://code.visualstudio.com/",
};

export async function detectVscode(): Promise<DiscoveredTool> {
	if (!(await commandExists("code"))) {
		return createNotInstalledTool(vscodeDefinition);
	}

	const execPath = await getExecutablePath("code");
	const version = await getVersion("code", ["--version"], {
		parseOutput: (output) => {
			// First line is the version number
			return output.split("\n")[0].trim();
		},
	});

	return createInstalledTool(
		vscodeDefinition,
		execPath || "code",
		version || undefined,
	);
}
