/**
 * Visual Studio tool discoverer
 */

import { join } from "node:path";
import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	findVisualStudio,
	fileExists,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const vsDefinition: ToolDefinition = {
	id: "a-vs2022",
	name: "Visual Studio 2022",
	description: "Microsoft Visual Studio IDE for .NET development",
	category: "ide",
	capabilities: ["edit", "build", "debug"],
	actions: [
		{
			name: "open",
			description: "Open solution or project",
			parameters: [
				{
					name: "path",
					description: "Solution (.sln) or project file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'devenv "{{path}}"',
		},
		{
			name: "build",
			description: "Build solution",
			parameters: [
				{
					name: "solution",
					description: "Solution file path",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "Configuration (Debug/Release)",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Build "{{config}}"',
		},
		{
			name: "rebuild",
			description: "Rebuild solution",
			parameters: [
				{
					name: "solution",
					description: "Solution file path",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "Configuration (Debug/Release)",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Rebuild "{{config}}"',
		},
		{
			name: "clean",
			description: "Clean solution",
			parameters: [
				{
					name: "solution",
					description: "Solution file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Clean',
		},
	],
	installHint:
		"Download Visual Studio 2022 from https://visualstudio.microsoft.com/downloads/",
};

// MSBuild definition
const msbuildDefinition: ToolDefinition = {
	id: "a-msbuild",
	name: "MSBuild",
	description: "Microsoft Build Engine",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "build",
			description: "Build project or solution",
			parameters: [
				{
					name: "project",
					description: "Project/solution file path",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "Configuration",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'msbuild "{{project}}" /p:Configuration={{config}}',
		},
		{
			name: "restore",
			description: "Restore NuGet packages",
			parameters: [
				{
					name: "project",
					description: "Project/solution file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'msbuild "{{project}}" /t:Restore',
		},
		{
			name: "clean",
			description: "Clean build output",
			parameters: [
				{
					name: "project",
					description: "Project/solution file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'msbuild "{{project}}" /t:Clean',
		},
	],
	installHint: "MSBuild is included with Visual Studio or .NET SDK",
};

export async function detectVisualStudio(): Promise<DiscoveredTool> {
	const vs = await findVisualStudio();
	if (!vs) {
		return createNotInstalledTool(vsDefinition);
	}

	const devenvPath = join(vs.installPath, "Common7", "IDE", "devenv.exe");
	if (!fileExists(devenvPath)) {
		return createNotInstalledTool(vsDefinition);
	}

	// Extract major version from version number (17.x.x for VS 2022)
	const versionMatch = vs.version.match(/^(\d+\.\d+)/);
	const version = versionMatch ? versionMatch[1] : vs.version;

	return createInstalledTool(vsDefinition, devenvPath, version);
}

export async function detectMsbuild(): Promise<DiscoveredTool> {
	const vs = await findVisualStudio();
	if (!vs) {
		return createNotInstalledTool(msbuildDefinition);
	}

	const msbuildPath = join(
		vs.installPath,
		"MSBuild",
		"Current",
		"Bin",
		"MSBuild.exe",
	);
	if (!fileExists(msbuildPath)) {
		return createNotInstalledTool(msbuildDefinition);
	}

	const version = await getVersion(msbuildPath, ["-version"], {
		parseOutput: (output) => {
			// Last line is usually the version number
			const lines = output.trim().split("\n");
			return lines[lines.length - 1].trim();
		},
	});

	return createInstalledTool(
		msbuildDefinition,
		msbuildPath,
		version || undefined,
	);
}
