/**
 * VS Code 工具发现器
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
	description: "轻量级代码编辑器",
	category: "ide",
	capabilities: ["edit"],
	actions: [
		{
			name: "open",
			description: "打开文件或文件夹",
			parameters: [
				{
					name: "path",
					description: "文件或文件夹路径",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code {{path}}",
		},
		{
			name: "open_new_window",
			description: "在新窗口打开",
			parameters: [
				{
					name: "path",
					description: "文件或文件夹路径",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code -n {{path}}",
		},
		{
			name: "diff",
			description: "比较两个文件",
			parameters: [
				{
					name: "left",
					description: "左侧文件",
					type: "file",
					required: true,
				},
				{
					name: "right",
					description: "右侧文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "code --diff {{left}} {{right}}",
		},
		{
			name: "goto",
			description: "打开文件并跳转到指定行列",
			parameters: [
				{
					name: "file",
					description: "文件路径",
					type: "file",
					required: true,
				},
				{
					name: "line",
					description: "行号",
					type: "number",
					required: true,
				},
				{
					name: "column",
					description: "列号",
					type: "number",
					required: false,
					default: 1,
				},
			],
			commandTemplate: "code -g {{file}}:{{line}}:{{column}}",
		},
		{
			name: "install_extension",
			description: "安装扩展",
			parameters: [
				{
					name: "extension",
					description: "扩展 ID",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "code --install-extension {{extension}}",
		},
		{
			name: "list_extensions",
			description: "列出已安装的扩展",
			parameters: [],
			commandTemplate: "code --list-extensions",
		},
	],
	installHint: "从 https://code.visualstudio.com/ 下载安装",
};

export async function detectVscode(): Promise<DiscoveredTool> {
	if (!(await commandExists("code"))) {
		return createNotInstalledTool(vscodeDefinition);
	}

	const execPath = await getExecutablePath("code");
	const version = await getVersion("code", ["--version"], {
		parseOutput: (output) => {
			// 第一行是版本号
			return output.split("\n")[0].trim();
		},
	});

	return createInstalledTool(
		vscodeDefinition,
		execPath || "code",
		version || undefined,
	);
}
