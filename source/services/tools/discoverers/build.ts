/**
 * 构建工具发现器 (cmake, gradle, maven)
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// CMake 定义
const cmakeDefinition: ToolDefinition = {
	id: "cmake",
	name: "CMake",
	description: "跨平台构建系统生成器",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "configure",
			description: "配置项目",
			parameters: [
				{
					name: "source",
					description: "源码目录",
					type: "directory",
					required: true,
				},
				{
					name: "build",
					description: "构建目录",
					type: "directory",
					required: true,
				},
				{
					name: "generator",
					description: "生成器（如 Ninja, Visual Studio）",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"cmake -S \"{{source}}\" -B \"{{build}}\" {{generator ? '-G \"' + generator + '\"' : ''}}",
		},
		{
			name: "build",
			description: "构建项目",
			parameters: [
				{
					name: "build_dir",
					description: "构建目录",
					type: "directory",
					required: true,
				},
				{
					name: "config",
					description: "配置（Debug/Release）",
					type: "string",
					required: false,
					default: "Release",
				},
			],
			commandTemplate: 'cmake --build "{{build_dir}}" --config {{config}}',
		},
		{
			name: "install",
			description: "安装项目",
			parameters: [
				{
					name: "build_dir",
					description: "构建目录",
					type: "directory",
					required: true,
				},
				{
					name: "prefix",
					description: "安装前缀",
					type: "directory",
					required: false,
				},
			],
			commandTemplate:
				"cmake --install \"{{build_dir}}\" {{prefix ? '--prefix \"' + prefix + '\"' : ''}}",
		},
	],
	installHint: "从 https://cmake.org/download/ 下载安装",
};

// Gradle 定义
const gradleDefinition: ToolDefinition = {
	id: "gradle",
	name: "Gradle",
	description: "基于 Groovy/Kotlin 的构建工具",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "build",
			description: "构建项目",
			parameters: [],
			commandTemplate: "gradle build",
		},
		{
			name: "clean",
			description: "清理构建输出",
			parameters: [],
			commandTemplate: "gradle clean",
		},
		{
			name: "test",
			description: "运行测试",
			parameters: [],
			commandTemplate: "gradle test",
		},
		{
			name: "tasks",
			description: "列出可用任务",
			parameters: [],
			commandTemplate: "gradle tasks",
		},
		{
			name: "run_task",
			description: "运行指定任务",
			parameters: [
				{
					name: "task",
					description: "任务名称",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "gradle {{task}}",
		},
	],
	installHint:
		"从 https://gradle.org/install/ 下载安装\n或使用项目自带的 gradlew",
};

// Maven 定义
const mavenDefinition: ToolDefinition = {
	id: "maven",
	name: "Maven",
	description: "Apache Maven 项目管理工具",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "compile",
			description: "编译项目",
			parameters: [],
			commandTemplate: "mvn compile",
		},
		{
			name: "package",
			description: "打包项目",
			parameters: [],
			commandTemplate: "mvn package",
		},
		{
			name: "install",
			description: "安装到本地仓库",
			parameters: [],
			commandTemplate: "mvn install",
		},
		{
			name: "clean",
			description: "清理构建输出",
			parameters: [],
			commandTemplate: "mvn clean",
		},
		{
			name: "test",
			description: "运行测试",
			parameters: [],
			commandTemplate: "mvn test",
		},
		{
			name: "dependency_tree",
			description: "显示依赖树",
			parameters: [],
			commandTemplate: "mvn dependency:tree",
		},
	],
	installHint: "从 https://maven.apache.org/download.cgi 下载安装",
};

export async function detectCmake(): Promise<DiscoveredTool> {
	if (!(await commandExists("cmake"))) {
		return createNotInstalledTool(cmakeDefinition);
	}

	const execPath = await getExecutablePath("cmake");
	const version = await getVersion("cmake", ["--version"], {
		parseOutput: (output) => {
			// "cmake version 3.28.1" -> "3.28.1"
			const match = output.match(/cmake version (\d+\.\d+\.\d+)/);
			return match ? match[1] : output.split("\n")[0];
		},
	});

	return createInstalledTool(
		cmakeDefinition,
		execPath || "cmake",
		version || undefined,
	);
}

export async function detectGradle(): Promise<DiscoveredTool> {
	if (!(await commandExists("gradle"))) {
		return createNotInstalledTool(gradleDefinition);
	}

	const execPath = await getExecutablePath("gradle");
	const version = await getVersion("gradle", ["--version"], {
		parseOutput: (output) => {
			// 找 "Gradle X.Y.Z" 行
			const match = output.match(/Gradle (\d+\.\d+(?:\.\d+)?)/);
			return match ? match[1] : output.split("\n")[0];
		},
	});

	return createInstalledTool(
		gradleDefinition,
		execPath || "gradle",
		version || undefined,
	);
}

export async function detectMaven(): Promise<DiscoveredTool> {
	if (!(await commandExists("mvn"))) {
		return createNotInstalledTool(mavenDefinition);
	}

	const execPath = await getExecutablePath("mvn");
	const version = await getVersion("mvn", ["--version"], {
		parseOutput: (output) => {
			// "Apache Maven 3.9.6" -> "3.9.6"
			const match = output.match(/Apache Maven (\d+\.\d+\.\d+)/);
			return match ? match[1] : output.split("\n")[0];
		},
	});

	return createInstalledTool(
		mavenDefinition,
		execPath || "mvn",
		version || undefined,
	);
}
