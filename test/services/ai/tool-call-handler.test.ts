import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import {
	ToolCallHandler,
	createToolCallHandler,
} from "../../../source/services/ai/tool-call-handler.js";
import type { IToolRegistry } from "../../../source/services/tools/types.js";
import type { ToolCall } from "../../../source/services/ai/types.js";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

// Mock executor
vi.mock("../../../source/services/tools/executor.js", () => ({
	executeToolAction: vi.fn(),
	getToolAction: vi.fn(),
}));

import {
	executeToolAction,
	getToolAction,
} from "../../../source/services/tools/executor.js";

describe("ToolCallHandler", () => {
	let registry: IToolRegistry;
	let handler: ToolCallHandler;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock registry
		registry = {
			getTool: vi.fn(),
			getInstalledTools: vi.fn(() => []),
			discoverTools: vi.fn(async () => []),
			refresh: vi.fn(async () => []),
			getToolStats: vi.fn(() => ({
				total: 0,
				installed: 0,
				byCategory: {},
			})),
		};

		handler = new ToolCallHandler(registry, { cwd: "/test", timeout: 5000 });
	});

	describe("parseToolCallName", () => {
		it("should parse tool name with action", () => {
			const result = handler.parseToolCallName("git_status");
			expect(result.toolId).toBe("git");
			expect(result.actionName).toBe("status");
		});

		it("should parse tool name without underscore", () => {
			const result = handler.parseToolCallName("simple");
			expect(result.toolId).toBe("simple");
			expect(result.actionName).toBe("default");
		});

		it("should handle multiple underscores", () => {
			const result = handler.parseToolCallName("my_tool_action_name");
			expect(result.toolId).toBe("my");
			expect(result.actionName).toBe("tool_action_name");
		});
	});

	describe("handleToolCalls", () => {
		it("should return error when tool not found", async () => {
			vi.mocked(registry.getTool).mockReturnValue(undefined);

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "unknown_tool",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].role).toBe("tool");
			expect(results[0].tool_call_id).toBe("call_123");
			expect(results[0].content).toContain("未找到");
		});

		it("should return error when tool not installed", async () => {
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: false,
				installHint: "Install Git from git-scm.com",
				actions: [],
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_status",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("未安装");
			expect(results[0].content).toContain("git-scm.com");
		});

		it("should return error when action not found", async () => {
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [
					{ name: "status", description: "Show status", parameters: [] },
				],
			});
			vi.mocked(getToolAction).mockReturnValue(undefined);

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_unknown",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("没有动作");
		});

		it("should return error when arguments are invalid JSON", async () => {
			const action = {
				name: "status",
				description: "Show status",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_status",
						arguments: "invalid json {",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("参数解析失败");
		});

		it("should execute tool successfully", async () => {
			const action = {
				name: "status",
				description: "Show status",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "On branch main\nnothing to commit",
				stderr: "",
				exitCode: 0,
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_status",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].role).toBe("tool");
			expect(results[0].content).toContain("Git:status");
			expect(results[0].content).toContain("On branch main");
		});

		it("should handle empty stdout with success message", async () => {
			const action = {
				name: "init",
				description: "Initialize repo",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "",
				stderr: "",
				exitCode: 0,
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_init",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("执行成功，无输出");
		});

		it("should handle execution failure", async () => {
			const action = {
				name: "push",
				description: "Push changes",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "Authentication failed",
				exitCode: 1,
				error: "Authentication failed",
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_push",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("Error:");
			expect(results[0].content).toContain("Authentication failed");
		});

		it("should handle multiple tool calls", async () => {
			const action1 = {
				name: "status",
				description: "Show status",
				parameters: [],
			};
			const action2 = {
				name: "branch",
				description: "Show branches",
				parameters: [],
			};

			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action1, action2],
			});

			vi.mocked(getToolAction)
				.mockReturnValueOnce(action1)
				.mockReturnValueOnce(action2);

			vi.mocked(executeToolAction)
				.mockResolvedValueOnce({
					success: true,
					stdout: "On branch main",
					stderr: "",
					exitCode: 0,
				})
				.mockResolvedValueOnce({
					success: true,
					stdout: "* main\n  feature",
					stderr: "",
					exitCode: 0,
				});

			const toolCalls: ToolCall[] = [
				{
					id: "call_1",
					type: "function",
					function: { name: "git_status", arguments: "{}" },
				},
				{
					id: "call_2",
					type: "function",
					function: { name: "git_branch", arguments: "{}" },
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(2);
			expect(results[0].tool_call_id).toBe("call_1");
			expect(results[1].tool_call_id).toBe("call_2");
		});

		it("should include tool and action info in output", async () => {
			const action = {
				name: "status",
				description: "Show status",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);
			vi.mocked(executeToolAction).mockResolvedValue({
				success: true,
				stdout: "status output",
				stderr: "",
				exitCode: 0,
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_status",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			// Tool and action info should be included
			expect(results[0].content).toContain("[Git:status]");
		});

		it("should handle execution failure without specific error", async () => {
			const action = {
				name: "status",
				description: "Show status",
				parameters: [],
			};
			vi.mocked(registry.getTool).mockReturnValue({
				id: "git",
				name: "Git",
				description: "Git version control",
				category: "shell",
				installed: true,
				actions: [action],
			});
			vi.mocked(getToolAction).mockReturnValue(action);
			vi.mocked(executeToolAction).mockResolvedValue({
				success: false,
				stdout: "",
				stderr: "",
				exitCode: 1,
			});

			const toolCalls: ToolCall[] = [
				{
					id: "call_123",
					type: "function",
					function: {
						name: "git_status",
						arguments: "{}",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results[0].content).toContain("Error:");
			expect(results[0].content).toContain("未知错误");
		});
	});

	describe("handleAskUser", () => {
		it("should handle askuser tool call with callback", async () => {
			const onAskUser = vi.fn().mockResolvedValue("user response");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({
							question: "What is your name?",
							options: '["Alice", "Bob"]',
						}),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(results[0].role).toBe("tool");
			expect(results[0].tool_call_id).toBe("call_ask");
			expect(results[0].content).toContain("[Ask User]");
			expect(results[0].content).toContain("user response");
			expect(onAskUser).toHaveBeenCalledWith("What is your name?", [
				"Alice",
				"Bob",
			]);
		});

		it("should handle askuser without callback", async () => {
			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({ question: "Test?" }),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain(
				"User interaction not available",
			);
		});

		it("should handle user cancellation (empty response)", async () => {
			const onAskUser = vi.fn().mockResolvedValue("");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({ question: "Confirm?" }),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("User cancelled");
		});

		it("should handle callback error", async () => {
			const onAskUser = vi.fn().mockRejectedValue(new Error("Callback failed"));

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({ question: "Test?" }),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("Error:");
			expect(results[0].content).toContain("Callback failed");
		});

		it("should handle invalid JSON arguments in askuser", async () => {
			const onAskUser = vi.fn();

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: "invalid json {",
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("Failed to parse arguments");
			expect(onAskUser).not.toHaveBeenCalled();
		});

		it("should handle missing question with empty string", async () => {
			const onAskUser = vi.fn().mockResolvedValue("answer");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({}),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(onAskUser).toHaveBeenCalledWith("", []);
		});

		it("should handle invalid options JSON", async () => {
			const onAskUser = vi.fn().mockResolvedValue("answer");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({
							question: "Test?",
							options: "not valid json",
						}),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			// Should use empty options when parse fails
			expect(onAskUser).toHaveBeenCalledWith("Test?", []);
		});

		it("should handle non-array options", async () => {
			const onAskUser = vi.fn().mockResolvedValue("answer");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({
							question: "Test?",
							options: JSON.stringify({ key: "value" }),
						}),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			// Should use empty options when not an array
			expect(onAskUser).toHaveBeenCalledWith("Test?", []);
		});

		it("should convert options to strings", async () => {
			const onAskUser = vi.fn().mockResolvedValue("42");

			const toolCalls: ToolCall[] = [
				{
					id: "call_ask",
					type: "function",
					function: {
						name: "askuser_ask",
						arguments: JSON.stringify({
							question: "Pick a number?",
							options: JSON.stringify([1, 2, 3]),
						}),
					},
				},
			];

			const results = await handler.handleToolCalls(toolCalls, onAskUser);

			expect(results).toHaveLength(1);
			expect(onAskUser).toHaveBeenCalledWith("Pick a number?", ["1", "2", "3"]);
		});
	});

	describe("createToolCallHandler", () => {
		it("should create a ToolCallHandler instance", () => {
			const result = createToolCallHandler(registry);
			expect(result).toBeInstanceOf(ToolCallHandler);
		});

		it("should accept options", () => {
			const result = createToolCallHandler(registry, {
				cwd: "/home",
				timeout: 10000,
			});
			expect(result).toBeInstanceOf(ToolCallHandler);
		});
	});
});
