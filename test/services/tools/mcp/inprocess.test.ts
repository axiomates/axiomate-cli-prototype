import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolRegistry } from "../../../../source/services/tools/registry.js";
import type { DiscoveredTool, ToolAction } from "../../../../source/services/tools/types.js";

// Mock executor module
vi.mock("../../../../source/services/tools/executor.js", () => ({
	executeToolAction: vi.fn(),
	paramsToJsonSchema: vi.fn((params) => ({
		type: "object",
		properties: Object.fromEntries(
			params.map((p: { name: string; type: string; description: string }) => [
				p.name,
				{ type: p.type === "number" ? "number" : "string", description: p.description },
			])
		),
		required: params.filter((p: { required: boolean }) => p.required).map((p: { name: string }) => p.name),
	})),
}));

import { InProcessMcpProvider } from "../../../../source/services/tools/mcp/inprocess.js";
import { executeToolAction } from "../../../../source/services/tools/executor.js";

describe("InProcessMcpProvider", () => {
	let mockRegistry: ToolRegistry;
	let provider: InProcessMcpProvider;

	const createMockTool = (id: string, actions: ToolAction[]): DiscoveredTool => ({
		id,
		name: id,
		description: `${id} tool`,
		installed: true,
		version: "1.0.0",
		capabilities: ["execute"],
		actions,
		executionPath: `/bin/${id}`,
	});

	const createMockAction = (name: string, params: { name: string; type: string; description: string; required: boolean }[] = []): ToolAction => ({
		name,
		description: `${name} action`,
		parameters: params.map((p) => ({
			...p,
			type: p.type as "string" | "number" | "boolean" | "file" | "directory",
		})),
	});

	beforeEach(() => {
		vi.clearAllMocks();

		const gitTool = createMockTool("git", [
			createMockAction("status"),
			createMockAction("log", [{ name: "count", type: "number", description: "Number of commits", required: false }]),
		]);

		const nodeTool = createMockTool("node", [
			createMockAction("version"),
			createMockAction("eval", [{ name: "code", type: "string", description: "Code to evaluate", required: true }]),
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

		provider = new InProcessMcpProvider(mockRegistry);
	});

	describe("constructor", () => {
		it("should create provider and build tool map", () => {
			expect(provider).toBeDefined();
			// Tool map should be built
			const tools = provider.listTools();
			// 2 built-in tools + 4 tool actions = 6
			expect(tools.length).toBe(6);
		});
	});

	describe("refresh", () => {
		it("should rebuild tool map", () => {
			provider.refresh();

			const tools = provider.listTools();
			expect(tools.length).toBe(6);
		});
	});

	describe("listTools", () => {
		it("should return built-in tools and all tool actions", () => {
			const tools = provider.listTools();

			// Should have built-in tools
			expect(tools.some((t) => t.name === "list_available_tools")).toBe(true);
			expect(tools.some((t) => t.name === "get_tools_stats")).toBe(true);

			// Should have tool actions
			expect(tools.some((t) => t.name === "git_status")).toBe(true);
			expect(tools.some((t) => t.name === "git_log")).toBe(true);
			expect(tools.some((t) => t.name === "node_version")).toBe(true);
			expect(tools.some((t) => t.name === "node_eval")).toBe(true);
		});

		it("should return correct tool format", () => {
			const tools = provider.listTools();
			const gitStatus = tools.find((t) => t.name === "git_status");

			expect(gitStatus).toBeDefined();
			expect(gitStatus!.description).toContain("[git]");
			expect(gitStatus!.inputSchema.type).toBe("object");
		});

		it("should have correct input schema for tools with parameters", () => {
			const tools = provider.listTools();
			const nodeEval = tools.find((t) => t.name === "node_eval");

			expect(nodeEval).toBeDefined();
			expect(nodeEval!.inputSchema.required).toContain("code");
		});
	});

	describe("callTool", () => {
		it("should handle list_available_tools", async () => {
			const result = await provider.callTool("list_available_tools", {});

			expect(result.isError).toBeUndefined();
			expect(result.content[0]!.type).toBe("text");

			const data = JSON.parse(result.content[0]!.text);
			expect(data.installed.length).toBe(2);
			expect(data.notInstalled.length).toBe(1);
			expect(data.installed[0].actions).toBeDefined();
		});

		it("should handle get_tools_stats", async () => {
			const result = await provider.callTool("get_tools_stats", {});

			expect(result.isError).toBeUndefined();
			expect(result.content[0]!.type).toBe("text");

			const data = JSON.parse(result.content[0]!.text);
			expect(data.total).toBe(3);
			expect(data.installed).toBe(2);
		});

		it("should return error for unknown tool", async () => {
			const result = await provider.callTool("unknown_tool", {});

			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain("未找到工具");
		});

		it("should execute tool action successfully", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "On branch main",
				stderr: "",
				exitCode: 0,
			});

			const result = await provider.callTool("git_status", {});

			expect(result.isError).toBeUndefined();
			expect(result.content[0]!.text).toBe("On branch main");
		});

		it("should handle empty stdout", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "",
				stderr: "",
				exitCode: 0,
			});

			const result = await provider.callTool("git_status", {});

			expect(result.isError).toBeUndefined();
			expect(result.content[0]!.text).toBe("(无输出)");
		});

		it("should handle tool execution failure with error message", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "",
				exitCode: 1,
				error: "Command not found",
			});

			const result = await provider.callTool("git_status", {});

			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain("错误: Command not found");
			expect(result.content[0]!.text).toContain("退出码: 1");
		});

		it("should handle tool execution failure with stderr", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "fatal: not a git repository",
				exitCode: 128,
			});

			const result = await provider.callTool("git_status", {});

			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain("fatal: not a git repository");
		});

		it("should handle tool execution failure with no error details", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "",
				exitCode: 1,
			});

			const result = await provider.callTool("git_status", {});

			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain("命令执行失败");
		});

		it("should pass arguments to tool execution", async () => {
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "result",
				stderr: "",
				exitCode: 0,
			});

			await provider.callTool("node_eval", { code: "console.log('hello')" });

			expect(executeToolAction).toHaveBeenCalledWith(
				expect.objectContaining({ id: "node" }),
				expect.objectContaining({ name: "eval" }),
				{ code: "console.log('hello')" }
			);
		});
	});
});
