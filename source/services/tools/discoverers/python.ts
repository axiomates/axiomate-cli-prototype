/**
 * Python 工具发现器
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const pythonDefinition: ToolDefinition = {
	id: "python",
	name: "Python",
	description: "Python 编程语言解释器",
	category: "runtime",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "运行 Python 脚本",
			parameters: [
				{
					name: "file",
					description: "Python 文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "python {{file}}",
		},
		{
			name: "eval",
			description: "执行 Python 代码",
			parameters: [
				{
					name: "code",
					description: "Python 代码",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'python -c "{{code}}"',
		},
		{
			name: "version",
			description: "查看 Python 版本",
			parameters: [],
			commandTemplate: "python --version",
		},
		{
			name: "pip_install",
			description: "使用 pip 安装包",
			parameters: [
				{
					name: "package",
					description: "包名",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "python -m pip install {{package}}",
		},
		{
			name: "pip_list",
			description: "列出已安装的包",
			parameters: [],
			commandTemplate: "python -m pip list",
		},
	],
	installHint: "从 https://www.python.org/downloads/ 下载安装",
};

export async function detectPython(): Promise<DiscoveredTool> {
	// 尝试 python 和 python3
	const cmds = ["python", "python3"];
	let foundCmd: string | null = null;

	for (const cmd of cmds) {
		if (await commandExists(cmd)) {
			foundCmd = cmd;
			break;
		}
	}

	if (!foundCmd) {
		return createNotInstalledTool(pythonDefinition);
	}

	const execPath = await getExecutablePath(foundCmd);
	const version = await getVersion(foundCmd, ["--version"], {
		parseOutput: (output) => {
			// "Python 3.11.5" -> "3.11.5"
			const match = output.match(/Python (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		pythonDefinition,
		execPath || foundCmd,
		version || undefined,
	);
}
