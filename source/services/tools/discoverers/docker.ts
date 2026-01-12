/**
 * Docker tool discoverer
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const dockerDefinition: ToolDefinition = {
	id: "a-docker",
	name: "Docker",
	description: "Container platform",
	category: "container",
	capabilities: ["execute"],
	actions: [
		{
			name: "ps",
			description: "List running containers",
			parameters: [],
			commandTemplate: "docker ps",
		},
		{
			name: "ps_all",
			description: "List all containers",
			parameters: [],
			commandTemplate: "docker ps -a",
		},
		{
			name: "images",
			description: "List images",
			parameters: [],
			commandTemplate: "docker images",
		},
		{
			name: "run",
			description: "Run container",
			parameters: [
				{
					name: "image",
					description: "Image name",
					type: "string",
					required: true,
				},
				{
					name: "name",
					description: "Container name",
					type: "string",
					required: false,
				},
				{
					name: "ports",
					description: "Port mapping (e.g., 8080:80)",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"docker run {{name ? '--name ' + name : ''}} {{ports ? '-p ' + ports : ''}} {{image}}",
		},
		{
			name: "stop",
			description: "Stop container",
			parameters: [
				{
					name: "container",
					description: "Container ID or name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker stop {{container}}",
		},
		{
			name: "start",
			description: "Start container",
			parameters: [
				{
					name: "container",
					description: "Container ID or name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker start {{container}}",
		},
		{
			name: "logs",
			description: "View container logs",
			parameters: [
				{
					name: "container",
					description: "Container ID or name",
					type: "string",
					required: true,
				},
				{
					name: "tail",
					description: "Show last N lines",
					type: "number",
					required: false,
					default: 100,
				},
			],
			commandTemplate: "docker logs --tail {{tail}} {{container}}",
		},
		{
			name: "exec",
			description: "Execute command in container",
			parameters: [
				{
					name: "container",
					description: "Container ID or name",
					type: "string",
					required: true,
				},
				{
					name: "command",
					description: "Command to execute",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker exec {{container}} {{command}}",
		},
		{
			name: "build",
			description: "Build image",
			parameters: [
				{
					name: "tag",
					description: "Image tag",
					type: "string",
					required: true,
				},
				{
					name: "path",
					description: "Dockerfile directory",
					type: "directory",
					required: false,
					default: ".",
				},
			],
			commandTemplate: "docker build -t {{tag}} {{path}}",
		},
	],
	installHint:
		"Download Docker Desktop from https://www.docker.com/products/docker-desktop/",
};

const dockerComposeDefinition: ToolDefinition = {
	id: "a-dockercompose",
	name: "Docker Compose",
	description: "Multi-container application orchestration tool",
	category: "container",
	capabilities: ["execute"],
	actions: [
		{
			name: "up",
			description: "Start services",
			parameters: [
				{
					name: "detach",
					description: "Run in background",
					type: "boolean",
					required: false,
					default: true,
				},
			],
			commandTemplate: "docker compose up {{detach ? '-d' : ''}}",
		},
		{
			name: "down",
			description: "Stop and remove services",
			parameters: [],
			commandTemplate: "docker compose down",
		},
		{
			name: "ps",
			description: "List service status",
			parameters: [],
			commandTemplate: "docker compose ps",
		},
		{
			name: "logs",
			description: "View service logs",
			parameters: [
				{
					name: "service",
					description: "Service name (optional)",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "docker compose logs {{service}}",
		},
		{
			name: "restart",
			description: "Restart services",
			parameters: [
				{
					name: "service",
					description: "Service name (optional)",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "docker compose restart {{service}}",
		},
	],
	installHint: "Docker Compose is included with Docker Desktop",
};

export async function detectDocker(): Promise<DiscoveredTool> {
	if (!(await commandExists("docker"))) {
		return createNotInstalledTool(dockerDefinition);
	}

	const execPath = await getExecutablePath("docker");
	const version = await getVersion("docker", ["--version"], {
		parseOutput: (output) => {
			// "Docker version 24.0.7, build afdd53b" -> "24.0.7"
			const match = output.match(/Docker version (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		dockerDefinition,
		execPath || "docker",
		version || undefined,
	);
}

export async function detectDockerCompose(): Promise<DiscoveredTool> {
	// Docker Compose V2 is a docker subcommand
	if (!(await commandExists("docker"))) {
		return createNotInstalledTool(dockerComposeDefinition);
	}

	const version = await getVersion("docker", ["compose", "version"], {
		parseOutput: (output) => {
			// "Docker Compose version v2.23.0" -> "2.23.0"
			const match = output.match(/v?(\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	if (!version) {
		return createNotInstalledTool(dockerComposeDefinition);
	}

	return createInstalledTool(
		dockerComposeDefinition,
		"docker compose",
		version,
	);
}
