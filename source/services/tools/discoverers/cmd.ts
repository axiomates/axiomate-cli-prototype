/**
 * Windows CMD 工具发现器
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
	description: "Windows 命令提示符",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "执行 CMD 命令",
			parameters: [
				{
					name: "command",
					description: "CMD 命令",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'cmd /C "{{command}}"',
		},
		{
			name: "run_script",
			description: "运行批处理脚本",
			parameters: [
				{
					name: "file",
					description: "批处理文件路径 (.bat/.cmd)",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "cmd /C {{file}}",
		},
		{
			name: "version",
			description: "查看 CMD 版本",
			parameters: [],
			commandTemplate: "cmd /C ver",
		},
	],
	installHint: "Windows 系统自带",
};

export async function detectCmd(): Promise<DiscoveredTool> {
	// CMD 仅在 Windows 上可用
	if (platform() !== "win32") {
		return createNotInstalledTool(cmdDefinition);
	}

	if (!(await commandExists("cmd"))) {
		return createNotInstalledTool(cmdDefinition);
	}

	const execPath = await getExecutablePath("cmd");

	// CMD 版本号不易获取，不设置 version
	return createInstalledTool(cmdDefinition, execPath || "cmd", undefined);
}
