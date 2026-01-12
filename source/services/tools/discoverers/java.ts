/**
 * Java tool discoverer
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
	id: "a-java",
	name: "Java",
	description: "Java runtime environment",
	category: "runtime",
	capabilities: ["execute"],
	actions: [
		{
			name: "run",
			description: "Run Java class",
			parameters: [
				{
					name: "class",
					description: "Class name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "java {{class}}",
		},
		{
			name: "run_jar",
			description: "Run JAR file",
			parameters: [
				{
					name: "jar",
					description: "JAR file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "java -jar {{jar}}",
		},
		{
			name: "version",
			description: "Show Java version",
			parameters: [],
			commandTemplate: "java -version",
		},
	],
	installHint:
		"Download Eclipse Temurin from https://adoptium.net/\nor Oracle JDK from https://www.oracle.com/java/technologies/downloads/",
};

const javacDefinition: ToolDefinition = {
	id: "a-javac",
	name: "Java Compiler",
	description: "Java compiler (JDK)",
	category: "build",
	capabilities: ["execute", "build"],
	actions: [
		{
			name: "compile",
			description: "Compile Java source file",
			parameters: [
				{
					name: "file",
					description: "Java source file",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "javac {{file}}",
		},
		{
			name: "version",
			description: "Show compiler version",
			parameters: [],
			commandTemplate: "javac -version",
		},
	],
	installHint: "Install JDK (not JRE) to get javac",
};

export async function detectJava(): Promise<DiscoveredTool> {
	if (!(await commandExists("java"))) {
		return createNotInstalledTool(javaDefinition);
	}

	const execPath = await getExecutablePath("java");
	// java -version outputs to stderr
	const version = await getVersion("java", ["-version"], {
		useStderr: true,
		parseOutput: (output) => {
			// 'openjdk version "21.0.1"' or 'java version "1.8.0_391"'
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
