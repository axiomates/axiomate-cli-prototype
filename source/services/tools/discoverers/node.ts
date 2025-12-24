/**
 * Node.js and NVM tool discoverer
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// Node.js definition
const nodeDefinition: ToolDefinition = {
	id: "node",
	name: "Node.js",
	description: "JavaScript runtime environment",
	category: "runtime",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "Run JavaScript file",
			parameters: [
				{
					name: "file",
					description: "JS file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "node {{file}}",
		},
		{
			name: "eval",
			description: "Execute JavaScript code",
			parameters: [
				{
					name: "code",
					description: "JavaScript code",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'node -e "{{code}}"',
		},
		{
			name: "version",
			description: "Show Node.js version",
			parameters: [],
			commandTemplate: "node --version",
		},
	],
	installHint: "Download from https://nodejs.org or use nvm to manage versions",
};

// NVM (Node Version Manager) definition
const nvmDefinition: ToolDefinition = {
	id: "nvm",
	name: "NVM",
	description: "Node.js version manager",
	category: "package",
	capabilities: ["execute"],
	actions: [
		{
			name: "list",
			description: "List installed Node.js versions",
			parameters: [],
			commandTemplate: "nvm list",
		},
		{
			name: "use",
			description: "Switch Node.js version",
			parameters: [
				{
					name: "version",
					description: "Version number (e.g., 18.17.0 or lts)",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "nvm use {{version}}",
		},
		{
			name: "install",
			description: "Install specific Node.js version",
			parameters: [
				{
					name: "version",
					description: "Version number",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "nvm install {{version}}",
		},
		{
			name: "current",
			description: "Show current version",
			parameters: [],
			commandTemplate: "nvm current",
		},
	],
	installHint:
		"Windows: https://github.com/coreybutler/nvm-windows\nUnix: https://github.com/nvm-sh/nvm",
};

// npm definition
const npmDefinition: ToolDefinition = {
	id: "npm",
	name: "npm",
	description: "Node.js package manager",
	category: "package",
	capabilities: ["execute"],
	actions: [
		{
			name: "install",
			description: "Install dependencies",
			parameters: [
				{
					name: "package",
					description: "Package name (optional, omit to install all)",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "npm install {{package}}",
		},
		{
			name: "run",
			description: "Run script",
			parameters: [
				{
					name: "script",
					description: "Script name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "npm run {{script}}",
		},
		{
			name: "list",
			description: "List installed packages",
			parameters: [],
			commandTemplate: "npm list --depth=0",
		},
		{
			name: "outdated",
			description: "Check for outdated packages",
			parameters: [],
			commandTemplate: "npm outdated",
		},
	],
	installHint: "npm is installed with Node.js",
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
