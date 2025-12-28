/**
 * In-Process MCP Provider
 * 绕过 JSON-RPC，直接在进程内调用工具
 */

import type { ToolRegistry } from "../registry.js";
import type { DiscoveredTool, ToolAction } from "../types.js";
import {
	executeToolAction,
	type ExecutionResult,
	paramsToJsonSchema,
} from "../executor.js";
import { t } from "../../../i18n/index.js";

export type McpTool = {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required: string[];
	};
};

export type McpToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

/**
 * In-Process MCP Provider
 * 直接调用工具，不经过 JSON-RPC 序列化
 */
export class InProcessMcpProvider {
	private toolMap: Map<string, { tool: DiscoveredTool; action: ToolAction }> =
		new Map();

	constructor(private registry: ToolRegistry) {
		this.buildToolMap();
	}

	private buildToolMap(): void {
		this.toolMap.clear();
		for (const tool of this.registry.getInstalled()) {
			for (const action of tool.actions) {
				const id = `${tool.id}_${action.name}`;
				this.toolMap.set(id, { tool, action });
			}
		}
	}

	/**
	 * 刷新工具映射（在重新发现后调用）
	 */
	refresh(): void {
		this.buildToolMap();
	}

	/**
	 * 列出所有可用工具
	 */
	listTools(): McpTool[] {
		const tools: McpTool[] = [];

		// list_available_tools
		tools.push({
			name: "list_available_tools",
			description: t("tools.listToolsDesc"),
			inputSchema: { type: "object", properties: {}, required: [] },
		});

		// get_tools_stats
		tools.push({
			name: "get_tools_stats",
			description: t("tools.toolStatsDesc"),
			inputSchema: { type: "object", properties: {}, required: [] },
		});

		// 每个工具的动作
		for (const [id, { tool, action }] of this.toolMap) {
			tools.push({
				name: id,
				description: `[${tool.name}] ${action.description}`,
				inputSchema: paramsToJsonSchema(action.parameters),
			});
		}

		return tools;
	}

	/**
	 * 调用工具
	 */
	async callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<McpToolResult> {
		// 处理内置工具
		if (name === "list_available_tools") {
			return this.handleListTools();
		}

		if (name === "get_tools_stats") {
			return this.handleGetStats();
		}

		// 查找工具
		const mapping = this.toolMap.get(name);
		if (!mapping) {
			return {
				content: [{ type: "text", text: t("tools.toolNotFoundMcp", { name }) }],
				isError: true,
			};
		}

		const { tool, action } = mapping;
		const result = await executeToolAction(tool, action, args);

		return this.formatResult(result);
	}

	private handleListTools(): McpToolResult {
		const installed = this.registry.getInstalled().map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			category: t.category,
			version: t.version,
			actions: t.actions.map((a) => ({
				name: a.name,
				description: a.description,
				fullId: `${t.id}_${a.name}`,
			})),
		}));

		const notInstalled = this.registry.getNotInstalled().map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			category: t.category,
			installHint: t.installHint,
		}));

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ installed, notInstalled }, null, 2),
				},
			],
		};
	}

	private handleGetStats(): McpToolResult {
		const stats = this.registry.getStats();
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(stats, null, 2),
				},
			],
		};
	}

	private formatResult(result: ExecutionResult): McpToolResult {
		if (result.success) {
			return {
				content: [
					{
						type: "text",
						text: result.stdout || t("common.noOutput"),
					},
				],
			};
		} else {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${result.error || result.stderr || t("errors.commandExecutionFailed")}\nExit code: ${result.exitCode}`,
					},
				],
				isError: true,
			};
		}
	}
}
