/**
 * PowerShell 工具发现器
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
	description: "Microsoft PowerShell 命令行工具",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "执行 PowerShell 命令",
			parameters: [
				{
					name: "command",
					description: "PowerShell 命令",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'powershell -Command "{{command}}"',
		},
		{
			name: "run_script",
			description: "运行 PowerShell 脚本",
			parameters: [
				{
					name: "file",
					description: "PS1 脚本文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "powershell -File {{file}}",
		},
		{
			name: "version",
			description: "查看 PowerShell 版本",
			parameters: [],
			commandTemplate:
				"powershell -Command $PSVersionTable.PSVersion.ToString()",
		},
	],
	installHint:
		"Windows 自带 PowerShell 5.1\n跨平台 PowerShell 7: https://github.com/PowerShell/PowerShell",
};

// PowerShell Core (pwsh) - 跨平台版本
const pwshDefinition: ToolDefinition = {
	id: "pwsh",
	name: "PowerShell Core",
	description: "跨平台 PowerShell 7+",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "执行 PowerShell 命令",
			parameters: [
				{
					name: "command",
					description: "PowerShell 命令",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'pwsh -Command "{{command}}"',
		},
		{
			name: "run_script",
			description: "运行 PowerShell 脚本",
			parameters: [
				{
					name: "file",
					description: "PS1 脚本文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "pwsh -File {{file}}",
		},
		{
			name: "version",
			description: "查看版本",
			parameters: [],
			commandTemplate: "pwsh --version",
		},
	],
	installHint: "从 https://github.com/PowerShell/PowerShell 下载安装",
};

export async function detectPowershell(): Promise<DiscoveredTool> {
	// Windows 上是 powershell.exe
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
