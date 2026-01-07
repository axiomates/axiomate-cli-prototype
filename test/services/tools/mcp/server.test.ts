import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { ToolRegistry } from "../../../../source/services/tools/registry.js";
import type {
	DiscoveredTool,
	ToolAction,
	ToolParameter,
} from "../../../../source/services/tools/types.js";
import { initI18n, setLocale } from "../../../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

// Mock MCP SDK
const mockRegisterTool = vi.fn();
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
	McpServer: class {
		registerTool = mockRegisterTool;
	},
}));

// Mock executor module
vi.mock("../../../../source/services/tools/executor.js", () => ({
	executeToolAction: vi.fn(),
	paramsToJsonSchema: vi.fn((params) => ({
		type: "object",
		properties: Object.fromEntries(
			params.map((p: ToolParameter) => [
				p.name,
				{
					type: p.type === "number" ? "number" : "string",
					description: p.description,
				},
			]),
		),
		required: params
			.filter((p: ToolParameter) => p.required)
			.map((p: ToolParameter) => p.name),
	})),
}));

import {
	createToolsMcpServer,
	getToolsAsJsonSchema,
} from "../../../../source/services/tools/mcp/server.js";
import { executeToolAction } from "../../../../source/services/tools/executor.js";

describe("MCP Server", () => {
	let mockRegistry: ToolRegistry;

	const createMockTool = (
		id: string,
		actions: ToolAction[],
	): DiscoveredTool => ({
		id,
		name: id,
		description: `${id} tool`,
		installed: true,
		version: "1.0.0",
		capabilities: ["execute"],
		actions,
		executionPath: `/bin/${id}`,
	});

	const createMockAction = (
		name: string,
		params: ToolParameter[] = [],
	): ToolAction => ({
		name,
		description: `${name} action`,
		parameters: params,
	});

	beforeEach(() => {
		vi.clearAllMocks();

		const gitTool = createMockTool("git", [
			createMockAction("status"),
			createMockAction("log", [
				{
					name: "count",
					type: "number",
					description: "Number of commits",
					required: false,
				},
			]),
		]);

		const nodeTool = createMockTool("node", [
			createMockAction("version"),
			createMockAction("eval", [
				{
					name: "code",
					type: "string",
					description: "Code to evaluate",
					required: true,
				},
			]),
		]);

		const tools = new Map<string, DiscoveredTool>();
		tools.set("git", gitTool);
		tools.set("node", nodeTool);

		mockRegistry = {
			register: vi.fn(),
			getTool: vi.fn((id) => tools.get(id) || null),
			getInstalled: vi.fn(() => [gitTool, nodeTool]),
			getNotInstalled: vi.fn(() => [
				{
					id: "python",
					name: "Python",
					description: "Python interpreter",
					installed: false,
					category: "language",
					installHint: "Install Python from python.org",
					capabilities: [],
					actions: [],
				} as DiscoveredTool,
			]),
			getByCapability: vi.fn(() => []),
			discover: vi.fn(),
			getStats: vi.fn(() => ({ total: 3, installed: 2 })),
		} as unknown as ToolRegistry;
	});

	describe("createToolsMcpServer", () => {
		it("should create MCP server", () => {
			const server = createToolsMcpServer(mockRegistry);
			expect(server).toBeDefined();
		});

		it("should register list_available_tools", () => {
			createToolsMcpServer(mockRegistry);

			expect(mockRegisterTool).toHaveBeenCalledWith(
				"list_available_tools",
				expect.objectContaining({ description: expect.any(String) }),
				expect.any(Function),
			);
		});

		it("should register get_tools_stats", () => {
			createToolsMcpServer(mockRegistry);

			expect(mockRegisterTool).toHaveBeenCalledWith(
				"get_tools_stats",
				expect.objectContaining({ description: expect.any(String) }),
				expect.any(Function),
			);
		});

		it("should register tools for each action", () => {
			createToolsMcpServer(mockRegistry);

			// 2 built-in + 4 actions = 6 tools
			expect(mockRegisterTool).toHaveBeenCalledTimes(6);

			expect(mockRegisterTool).toHaveBeenCalledWith(
				"git_status",
				expect.objectContaining({
					description: expect.stringContaining("[git]"),
				}),
				expect.any(Function),
			);

			expect(mockRegisterTool).toHaveBeenCalledWith(
				"node_eval",
				expect.objectContaining({
					description: expect.stringContaining("[node]"),
					inputSchema: expect.any(Object),
				}),
				expect.any(Function),
			);
		});

		it("should execute list_available_tools handler", async () => {
			createToolsMcpServer(mockRegistry);

			// Find the list_available_tools handler
			const listToolsCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "list_available_tools",
			);
			expect(listToolsCall).toBeDefined();

			const handler = listToolsCall![2];
			const result = await handler();

			expect(result.content[0].type).toBe("text");
			const data = JSON.parse(result.content[0].text);
			expect(data.installed.length).toBe(2);
			expect(data.notInstalled.length).toBe(1);
		});

		it("should execute get_tools_stats handler", async () => {
			createToolsMcpServer(mockRegistry);

			const statsCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "get_tools_stats",
			);
			expect(statsCall).toBeDefined();

			const handler = statsCall![2];
			const result = await handler();

			expect(result.content[0].type).toBe("text");
			const data = JSON.parse(result.content[0].text);
			expect(data.total).toBe(3);
			expect(data.installed).toBe(2);
		});

		it("should execute tool action handler successfully", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "On branch main",
				stderr: "",
				exitCode: 0,
			});

			createToolsMcpServer(mockRegistry);

			const gitStatusCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "git_status",
			);
			expect(gitStatusCall).toBeDefined();

			const handler = gitStatusCall![2];
			const result = await handler({});

			expect(result.content[0].text).toBe("On branch main");
			expect(result.isError).toBeUndefined();
		});

		it("should handle empty stdout in tool action", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "",
				stderr: "",
				exitCode: 0,
			});

			createToolsMcpServer(mockRegistry);

			const gitStatusCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "git_status",
			);
			const handler = gitStatusCall![2];
			const result = await handler({});

			// Uses i18n t("common.noOutput") which is "(无输出)" in zh-CN
			expect(result.content[0].text).toBe("(无输出)");
		});

		it("should handle tool action failure", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "fatal: not a git repository",
				exitCode: 128,
			});

			createToolsMcpServer(mockRegistry);

			const gitStatusCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "git_status",
			);
			const handler = gitStatusCall![2];
			const result = await handler({});

			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain("fatal: not a git repository");
			// Exit code is hardcoded in English in source
			expect(result.content[0].text).toContain("Exit code: 128");
		});

		it("should handle tool action failure with error message", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "",
				exitCode: 1,
				error: "Command not found",
			});

			createToolsMcpServer(mockRegistry);

			const gitStatusCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "git_status",
			);
			const handler = gitStatusCall![2];
			const result = await handler({});

			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain("Command not found");
		});

		it("should handle tool action failure with no details", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "",
				exitCode: 1,
			});

			createToolsMcpServer(mockRegistry);

			const gitStatusCall = mockRegisterTool.mock.calls.find(
				(call) => call[0] === "git_status",
			);
			const handler = gitStatusCall![2];
			const result = await handler({});

			expect(result.isError).toBe(true);
			// Uses i18n t("errors.commandExecutionFailed") which is "命令执行失败" in zh-CN
			expect(result.content[0].text).toContain("Error:");
			expect(result.content[0].text).toContain("命令执行失败");
		});
	});

	describe("getToolsAsJsonSchema", () => {
		it("should return array of tool schemas", () => {
			const schemas = getToolsAsJsonSchema(mockRegistry);

			expect(Array.isArray(schemas)).toBe(true);
			// 1 built-in (list_available_tools) + 4 actions = 5
			expect(schemas.length).toBe(5);
		});

		it("should include list_available_tools", () => {
			const schemas = getToolsAsJsonSchema(mockRegistry);

			const listTool = schemas.find((s) => s.name === "list_available_tools");
			expect(listTool).toBeDefined();
			// Uses i18n t("tools.listToolsDesc") which contains "可用" in zh-CN
			expect(listTool!.description).toContain("可用");
		});

		it("should include tool actions with correct format", () => {
			const schemas = getToolsAsJsonSchema(mockRegistry);

			const gitStatus = schemas.find((s) => s.name === "git_status");
			expect(gitStatus).toBeDefined();
			expect(gitStatus!.description).toContain("[git]");
			expect(gitStatus!.parameters).toBeDefined();
			expect(gitStatus!.parameters.type).toBe("object");
		});

		it("should include parameters for tool actions", () => {
			const schemas = getToolsAsJsonSchema(mockRegistry);

			const nodeEval = schemas.find((s) => s.name === "node_eval");
			expect(nodeEval).toBeDefined();
			expect(nodeEval!.parameters.required).toContain("code");
		});
	});
});
