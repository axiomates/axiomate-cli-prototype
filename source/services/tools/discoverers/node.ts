/**
 * Node.js 和 NVM 工具发现器
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// Node.js 定义
const nodeDefinition: ToolDefinition = {
	id: "node",
	name: "Node.js",
	description: "JavaScript 运行时环境",
	category: "runtime",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "运行 JavaScript 文件",
			parameters: [
				{
					name: "file",
					description: "JS 文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "node {{file}}",
		},
		{
			name: "eval",
			description: "执行 JavaScript 代码",
			parameters: [
				{
					name: "code",
					description: "JavaScript 代码",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'node -e "{{code}}"',
		},
		{
			name: "version",
			description: "查看 Node.js 版本",
			parameters: [],
			commandTemplate: "node --version",
		},
	],
	installHint: "从 https://nodejs.org 下载安装，或使用 nvm 管理",
};

// NVM (Node Version Manager) 定义
const nvmDefinition: ToolDefinition = {
	id: "nvm",
	name: "NVM",
	description: "Node.js 版本管理器",
	category: "package",
	capabilities: ["execute"],
	actions: [
		{
			name: "list",
			description: "列出已安装的 Node.js 版本",
			parameters: [],
			commandTemplate: "nvm list",
		},
		{
			name: "use",
			description: "切换 Node.js 版本",
			parameters: [
				{
					name: "version",
					description: "版本号（如 18.17.0 或 lts）",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "nvm use {{version}}",
		},
		{
			name: "install",
			description: "安装指定版本的 Node.js",
			parameters: [
				{
					name: "version",
					description: "版本号",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "nvm install {{version}}",
		},
		{
			name: "current",
			description: "查看当前使用的版本",
			parameters: [],
			commandTemplate: "nvm current",
		},
	],
	installHint:
		"Windows: https://github.com/coreybutler/nvm-windows\nUnix: https://github.com/nvm-sh/nvm",
};

// npm 定义
const npmDefinition: ToolDefinition = {
	id: "npm",
	name: "npm",
	description: "Node.js 包管理器",
	category: "package",
	capabilities: ["execute"],
	actions: [
		{
			name: "install",
			description: "安装依赖",
			parameters: [
				{
					name: "package",
					description: "包名（可选，不填安装所有依赖）",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "npm install {{package}}",
		},
		{
			name: "run",
			description: "运行脚本",
			parameters: [
				{
					name: "script",
					description: "脚本名",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "npm run {{script}}",
		},
		{
			name: "list",
			description: "列出已安装的包",
			parameters: [],
			commandTemplate: "npm list --depth=0",
		},
		{
			name: "outdated",
			description: "检查过期的包",
			parameters: [],
			commandTemplate: "npm outdated",
		},
	],
	installHint: "npm 随 Node.js 一起安装",
};

export async function detectNode(): Promise<DiscoveredTool> {
	if (!(await commandExists("node"))) {
		return createNotInstalledTool(nodeDefinition);
	}

	const execPath = await getExecutablePath("node");
	const version = await getVersion("node", ["--version"], {
		parseOutput: (output) => output.replace(/^v/, ""),
	});

	return createInstalledTool(
		nodeDefinition,
		execPath || "node",
		version || undefined,
	);
}

export async function detectNvm(): Promise<DiscoveredTool> {
	if (!(await commandExists("nvm"))) {
		return createNotInstalledTool(nvmDefinition);
	}

	const execPath = await getExecutablePath("nvm");
	const version = await getVersion("nvm", ["version"], {
		parseOutput: (output) => output.trim(),
	});

	return createInstalledTool(
		nvmDefinition,
		execPath || "nvm",
		version || undefined,
	);
}

export async function detectNpm(): Promise<DiscoveredTool> {
	if (!(await commandExists("npm"))) {
		return createNotInstalledTool(npmDefinition);
	}

	const execPath = await getExecutablePath("npm");
	const version = await getVersion("npm", ["--version"]);

	return createInstalledTool(
		npmDefinition,
		execPath || "npm",
		version || undefined,
	);
}
