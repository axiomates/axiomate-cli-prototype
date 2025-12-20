/**
 * Docker 工具发现器
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
	id: "docker",
	name: "Docker",
	description: "容器化平台",
	category: "container",
	capabilities: ["execute"],
	actions: [
		{
			name: "ps",
			description: "列出运行中的容器",
			parameters: [],
			commandTemplate: "docker ps",
		},
		{
			name: "ps_all",
			description: "列出所有容器",
			parameters: [],
			commandTemplate: "docker ps -a",
		},
		{
			name: "images",
			description: "列出镜像",
			parameters: [],
			commandTemplate: "docker images",
		},
		{
			name: "run",
			description: "运行容器",
			parameters: [
				{
					name: "image",
					description: "镜像名称",
					type: "string",
					required: true,
				},
				{
					name: "name",
					description: "容器名称",
					type: "string",
					required: false,
				},
				{
					name: "ports",
					description: "端口映射（如 8080:80）",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"docker run {{name ? '--name ' + name : ''}} {{ports ? '-p ' + ports : ''}} {{image}}",
		},
		{
			name: "stop",
			description: "停止容器",
			parameters: [
				{
					name: "container",
					description: "容器 ID 或名称",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker stop {{container}}",
		},
		{
			name: "start",
			description: "启动容器",
			parameters: [
				{
					name: "container",
					description: "容器 ID 或名称",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker start {{container}}",
		},
		{
			name: "logs",
			description: "查看容器日志",
			parameters: [
				{
					name: "container",
					description: "容器 ID 或名称",
					type: "string",
					required: true,
				},
				{
					name: "tail",
					description: "显示最后 N 行",
					type: "number",
					required: false,
					default: 100,
				},
			],
			commandTemplate: "docker logs --tail {{tail}} {{container}}",
		},
		{
			name: "exec",
			description: "在容器中执行命令",
			parameters: [
				{
					name: "container",
					description: "容器 ID 或名称",
					type: "string",
					required: true,
				},
				{
					name: "command",
					description: "要执行的命令",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "docker exec {{container}} {{command}}",
		},
		{
			name: "build",
			description: "构建镜像",
			parameters: [
				{
					name: "tag",
					description: "镜像标签",
					type: "string",
					required: true,
				},
				{
					name: "path",
					description: "Dockerfile 所在目录",
					type: "directory",
					required: false,
					default: ".",
				},
			],
			commandTemplate: "docker build -t {{tag}} {{path}}",
		},
	],
	installHint:
		"从 https://www.docker.com/products/docker-desktop/ 下载 Docker Desktop",
};

const dockerComposeDefinition: ToolDefinition = {
	id: "docker-compose",
	name: "Docker Compose",
	description: "多容器应用编排工具",
	category: "container",
	capabilities: ["execute"],
	actions: [
		{
			name: "up",
			description: "启动服务",
			parameters: [
				{
					name: "detach",
					description: "后台运行",
					type: "boolean",
					required: false,
					default: true,
				},
			],
			commandTemplate: "docker compose up {{detach ? '-d' : ''}}",
		},
		{
			name: "down",
			description: "停止并移除服务",
			parameters: [],
			commandTemplate: "docker compose down",
		},
		{
			name: "ps",
			description: "列出服务状态",
			parameters: [],
			commandTemplate: "docker compose ps",
		},
		{
			name: "logs",
			description: "查看服务日志",
			parameters: [
				{
					name: "service",
					description: "服务名称（可选）",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "docker compose logs {{service}}",
		},
		{
			name: "restart",
			description: "重启服务",
			parameters: [
				{
					name: "service",
					description: "服务名称（可选）",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "docker compose restart {{service}}",
		},
	],
	installHint: "Docker Compose 随 Docker Desktop 一起安装",
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
	// Docker Compose V2 是 docker 的子命令
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
