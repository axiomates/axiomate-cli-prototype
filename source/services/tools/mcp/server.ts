/**
 * MCP Server 核心实现
 * 将本地工具暴露为 MCP Tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolRegistry } from "../registry.js";
import type { DiscoveredTool, ToolAction, ToolParameter } from "../types.js";
import { executeToolAction, paramsToJsonSchema } from "../executor.js";
import { VERSION } from "../../../constants/meta.js";

/**
 * 将 ToolParameter 数组转换为 Zod Schema
 */
function paramsToZodSchema(
	params: ToolParameter[],
): Record<string, z.ZodTypeAny> {
	const schema: Record<string, z.ZodTypeAny> = {};

	for (const param of params) {
		let zodType: z.ZodTypeAny;

		switch (param.type) {
			case "string":
			case "file":
			case "directory":
				zodType = z.string().describe(param.description);
				break;
			case "number":
				zodType = z.number().describe(param.description);
				break;
			case "boolean":
				zodType = z.boolean().describe(param.description);
				break;
			default:
				zodType = z.string().describe(param.description);
		}

		if (!param.required) {
			zodType = zodType.optional();
			if (param.default !== undefined) {
				zodType = zodType.default(param.default);
			}
		}

		schema[param.name] = zodType;
	}

	return schema;
}

/**
 * 生成工具 ID（用于 MCP tool name）
 */
function generateToolId(tool: DiscoveredTool, action: ToolAction): string {
	return `${tool.id}_${action.name}`;
}

/**
 * 创建 MCP Server
 */
export function createToolsMcpServer(registry: ToolRegistry): McpServer {
	const server = new McpServer({
		name: "axiomate-local-tools",
		version: VERSION,
	});

	// 注册工具列表查询
	server.registerTool(
		"list_available_tools",
		{ description: "列出所有可用/未安装的本地开发工具" },
		async () => {
			const installed = registry.getInstalled().map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				category: t.category,
				version: t.version,
				actions: t.actions.map((a) => ({
					name: a.name,
					description: a.description,
					fullId: generateToolId(t, a),
				})),
			}));

			const notInstalled = registry.getNotInstalled().map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				category: t.category,
				installHint: t.installHint,
			}));

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ installed, notInstalled }, null, 2),
					},
				],
			};
		},
	);

	// 注册工具统计
	server.registerTool(
		"get_tools_stats",
		{ description: "获取工具统计信息" },
		async () => {
			const stats = registry.getStats();
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(stats, null, 2),
					},
				],
			};
		},
	);

	// 为每个已安装工具的每个动作注册 MCP Tool
	for (const tool of registry.getInstalled()) {
		for (const action of tool.actions) {
			const toolId = generateToolId(tool, action);
			const description = `[${tool.name}] ${action.description}`;
			const inputSchema = paramsToZodSchema(action.parameters);

			server.registerTool(
				toolId,
				{ description, inputSchema },
				async (args) => {
					const result = await executeToolAction(
						tool,
						action,
						args as Record<string, unknown>,
					);

					if (result.success) {
						return {
							content: [
								{
									type: "text" as const,
									text: result.stdout || "(无输出)",
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text" as const,
									text: `错误: ${result.error || result.stderr || "命令执行失败"}\n退出码: ${result.exitCode}`,
								},
							],
							isError: true,
						};
					}
				},
			);
		}
	}

	return server;
}

/**
 * 获取所有工具的 JSON Schema 定义（用于 OpenAI Function Calling）
 */
export function getToolsAsJsonSchema(registry: ToolRegistry): Array<{
	name: string;
	description: string;
	parameters: ReturnType<typeof paramsToJsonSchema>;
}> {
	const tools: Array<{
		name: string;
		description: string;
		parameters: ReturnType<typeof paramsToJsonSchema>;
	}> = [];

	// list_available_tools
	tools.push({
		name: "list_available_tools",
		description: "列出所有可用/未安装的本地开发工具",
		parameters: { type: "object", properties: {}, required: [] },
	});

	// 每个工具的动作
	for (const tool of registry.getInstalled()) {
		for (const action of tool.actions) {
			tools.push({
				name: generateToolId(tool, action),
				description: `[${tool.name}] ${action.description}`,
				parameters: paramsToJsonSchema(action.parameters),
			});
		}
	}

	return tools;
}
