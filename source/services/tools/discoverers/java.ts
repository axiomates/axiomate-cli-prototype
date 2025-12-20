/**
 * Java 工具发现器
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const javaDefinition: ToolDefinition = {
	id: "java",
	name: "Java",
	description: "Java 运行时环境",
	category: "runtime",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "运行 Java 类",
			parameters: [
				{
					name: "class",
					description: "类名",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "java {{class}}",
		},
		{
			name: "run_jar",
			description: "运行 JAR 文件",
			parameters: [
				{
					name: "jar",
					description: "JAR 文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "java -jar {{jar}}",
		},
		{
			name: "version",
			description: "查看 Java 版本",
			parameters: [],
			commandTemplate: "java -version",
		},
	],
	installHint:
		"从 https://adoptium.net/ 下载 Eclipse Temurin\n或从 https://www.oracle.com/java/technologies/downloads/ 下载 Oracle JDK",
};

const javacDefinition: ToolDefinition = {
	id: "javac",
	name: "Java Compiler",
	description: "Java 编译器 (JDK)",
	category: "build",
	capabilities: ["execute", "build"],
	actions: [
		{
			name: "compile",
			description: "编译 Java 源文件",
			parameters: [
				{
					name: "file",
					description: "Java 源文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "javac {{file}}",
		},
		{
			name: "version",
			description: "查看编译器版本",
			parameters: [],
			commandTemplate: "javac -version",
		},
	],
	installHint: "安装 JDK（而非 JRE）以获得 javac",
};

export async function detectJava(): Promise<DiscoveredTool> {
	if (!(await commandExists("java"))) {
		return createNotInstalledTool(javaDefinition);
	}

	const execPath = await getExecutablePath("java");
	// java -version 输出到 stderr
	const version = await getVersion("java", ["-version"], {
		useStderr: true,
		parseOutput: (output) => {
			// 'openjdk version "21.0.1"' 或 'java version "1.8.0_391"'
			const match = output.match(/version "(\d+(?:\.\d+)*)/);
			return match ? match[1] : output.split("\n")[0];
		},
	});

	return createInstalledTool(
		javaDefinition,
		execPath || "java",
		version || undefined,
	);
}

export async function detectJavac(): Promise<DiscoveredTool> {
	if (!(await commandExists("javac"))) {
		return createNotInstalledTool(javacDefinition);
	}

	const execPath = await getExecutablePath("javac");
	const version = await getVersion("javac", ["-version"], {
		parseOutput: (output) => {
			// "javac 21.0.1" -> "21.0.1"
			const match = output.match(/javac (\d+(?:\.\d+)*)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		javacDefinition,
		execPath || "javac",
		version || undefined,
	);
}
