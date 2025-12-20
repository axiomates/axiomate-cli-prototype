/**
 * Visual Studio 工具发现器
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
	id: "vs2022",
	name: "Visual Studio 2022",
	description: "Microsoft Visual Studio 集成开发环境",
	category: "ide",
	capabilities: ["edit", "build", "debug"],
	actions: [
		{
			name: "open",
			description: "打开解决方案或项目",
			parameters: [
				{
					name: "path",
					description: "解决方案(.sln)或项目文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'devenv "{{path}}"',
		},
		{
			name: "build",
			description: "构建解决方案",
			parameters: [
				{
					name: "solution",
					description: "解决方案文件路径",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "配置（Debug/Release）",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Build "{{config}}"',
		},
		{
			name: "rebuild",
			description: "重新构建解决方案",
			parameters: [
				{
					name: "solution",
					description: "解决方案文件路径",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "配置（Debug/Release）",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Rebuild "{{config}}"',
		},
		{
			name: "clean",
			description: "清理解决方案",
			parameters: [
				{
					name: "solution",
					description: "解决方案文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'devenv "{{solution}}" /Clean',
		},
	],
	installHint:
		"从 https://visualstudio.microsoft.com/downloads/ 下载 Visual Studio 2022",
};

// MSBuild 定义
const msbuildDefinition: ToolDefinition = {
	id: "msbuild",
	name: "MSBuild",
	description: "Microsoft Build Engine",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "build",
			description: "构建项目或解决方案",
			parameters: [
				{
					name: "project",
					description: "项目/解决方案文件路径",
					type: "file",
					required: true,
				},
				{
					name: "config",
					description: "配置",
					type: "string",
					required: false,
					default: "Debug",
				},
			],
			commandTemplate: 'msbuild "{{project}}" /p:Configuration={{config}}',
		},
		{
			name: "restore",
			description: "恢复 NuGet 包",
			parameters: [
				{
					name: "project",
					description: "项目/解决方案文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'msbuild "{{project}}" /t:Restore',
		},
		{
			name: "clean",
			description: "清理构建输出",
			parameters: [
				{
					name: "project",
					description: "项目/解决方案文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'msbuild "{{project}}" /t:Clean',
		},
	],
	installHint: "MSBuild 随 Visual Studio 或 .NET SDK 一起安装",
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

	// 从版本号提取主版本 (17.x.x for VS 2022)
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
			// 最后一行通常是版本号
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
