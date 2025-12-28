#!/usr/bin/env node
/**
 * 独立 MCP Server 入口
 * 可被 Claude Desktop 或其他 MCP 客户端调用
 *
 * 用法:
 *   node dist/mcp-server.js
 *   npx axiomate-mcp
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ToolRegistry } from "./services/tools/registry.js";
import { createToolsMcpServer } from "./services/tools/mcp/server.js";
import { t } from "./i18n/index.js";

async function main(): Promise<void> {
	// 发现本地工具
	const registry = new ToolRegistry();
	await registry.discover();

	// 创建 MCP Server
	const server = createToolsMcpServer(registry);

	// 使用 STDIO 传输
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// 保持运行直到被终止
	process.on("SIGINT", () => {
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		process.exit(0);
	});
}

main().catch((err) => {
	console.error(t("errors.mcpServerStartFailed"), err);
	process.exit(1);
});
