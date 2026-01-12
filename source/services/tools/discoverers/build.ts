/**
 * Build tools discoverer (cmake, gradle, maven)
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// CMake definition
const cmakeDefinition: ToolDefinition = {
	id: "a-cmake",
	name: "CMake",
	description: "Cross-platform build system generator for C/C++ projects",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "configure",
			description: "Configure project",
			parameters: [
				{
					name: "source",
					description: "Source directory",
					type: "directory",
					required: true,
				},
				{
					name: "build",
					description: "Build directory",
					type: "directory",
					required: true,
				},
				{
					name: "generator",
					description: "Generator (e.g., Ninja, Visual Studio)",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"cmake -S \"{{source}}\" -B \"{{build}}\" {{generator ? '-G \"' + generator + '\"' : ''}}",
		},
		{
			name: "build",
			description: "Build project",
			parameters: [
				{
					name: "build_dir",
					description: "Build directory",
					type: "directory",
					required: true,
				},
				{
					name: "config",
					description: "Configuration (Debug/Release)",
					type: "string",
					required: false,
					default: "Release",
				},
			],
			commandTemplate: 'cmake --build "{{build_dir}}" --config {{config}}',
		},
		{
			name: "install",
			description: "Install project",
			parameters: [
				{
					name: "build_dir",
					description: "Build directory",
					type: "directory",
					required: true,
				},
				{
					name: "prefix",
					description: "Install prefix",
					type: "directory",
					required: false,
				},
			],
			commandTemplate:
				"cmake --install \"{{build_dir}}\" {{prefix ? '--prefix \"' + prefix + '\"' : ''}}",
		},
	],
	installHint: "Download from https://cmake.org/download/",
};

// Gradle definition
const gradleDefinition: ToolDefinition = {
	id: "a-gradle",
	name: "Gradle",
	description: "Groovy/Kotlin-based build tool",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "build",
			description: "Build project",
			parameters: [],
			commandTemplate: "gradle build",
		},
		{
			name: "clean",
			description: "Clean build output",
			parameters: [],
			commandTemplate: "gradle clean",
		},
		{
			name: "test",
			description: "Run tests",
			parameters: [],
			commandTemplate: "gradle test",
		},
		{
			name: "tasks",
			description: "List available tasks",
			parameters: [],
			commandTemplate: "gradle tasks",
		},
		{
			name: "run_task",
			description: "Run specific task",
			parameters: [
				{
					name: "task",
					description: "Task name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "gradle {{task}}",
		},
	],
	installHint:
		"Download from https://gradle.org/install/\nor use project's gradlew wrapper",
};

// Maven definition
const mavenDefinition: ToolDefinition = {
	id: "a-maven",
	name: "Maven",
	description: "Apache Maven project management tool",
	category: "build",
	capabilities: ["build"],
	actions: [
		{
			name: "compile",
			description: "Compile project",
			parameters: [],
			commandTemplate: "mvn compile",
		},
		{
			name: "package",
			description: "Package project",
			parameters: [],
			commandTemplate: "mvn package",
		},
		{
			name: "install",
			description: "Install to local repository",
			parameters: [],
			commandTemplate: "mvn install",
		},
		{
			name: "clean",
			description: "Clean build output",
			parameters: [],
			commandTemplate: "mvn clean",
		},
		{
			name: "test",
			description: "Run tests",
			parameters: [],
			commandTemplate: "mvn test",
		},
		{
			name: "dependency_tree",
			description: "Show dependency tree",
			parameters: [],
			commandTemplate: "mvn dependency:tree",
		},
	],
	installHint: "Download from https://maven.apache.org/download.cgi",
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
			// Find "Gradle X.Y.Z" line
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
