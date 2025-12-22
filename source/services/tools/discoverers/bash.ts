/**
 * Bash shell 工具发现器
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
	description: "Unix shell 脚本解释器",
	category: "shell",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "执行 Bash 命令",
			parameters: [
				{
					name: "command",
					description: "Bash 命令",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'bash -c "{{command}}"',
		},
		{
			name: "run_script",
			description: "运行 shell 脚本",
			parameters: [
				{
					name: "file",
					description: "脚本文件路径 (.sh)",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "bash {{file}}",
		},
		{
			name: "version",
			description: "查看 Bash 版本",
			parameters: [],
			commandTemplate: "bash --version",
		},
	],
	installHint:
		"Linux/macOS: 通常预装\nWindows: 安装 Git Bash 或 WSL",
};

export async function detectBash(): Promise<DiscoveredTool> {
	if (!(await commandExists("bash"))) {
		return createNotInstalledTool(bashDefinition);
	}

	const execPath = await getExecutablePath("bash");
	const version = await getVersion("bash", ["--version"], {
		parseOutput: (output) => {
			// "GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)"
			// → "5.1.16"
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
