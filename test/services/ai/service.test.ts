import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

// Create mock instances to be used by class mocks
const mockMatcherInstance = {
	autoSelect: vi.fn(() => []),
	match: vi.fn(() => []),
};

const mockToolCallHandlerInstance = {
	handleToolCalls: vi.fn(async () => []),
};

// Mock dependencies - use class syntax for constructors
vi.mock("../../../source/services/tools/matcher.js", () => ({
	ToolMatcher: class {
		autoSelect = mockMatcherInstance.autoSelect;
		match = mockMatcherInstance.match;
	},
	detectProjectType: vi.fn(() => "node"),
}));

vi.mock("../../../source/services/ai/tool-call-handler.js", () => ({
	ToolCallHandler: class {
		handleToolCalls = mockToolCallHandlerInstance.handleToolCalls;
	},
}));

vi.mock("../../../source/services/ai/adapters/openai.js", () => ({
	toOpenAITools: vi.fn((tools) =>
		tools.map((t: any) => ({ type: "function", function: { name: t.id } })),
	),
}));

vi.mock("../../../source/constants/prompts.js", () => ({
	SYSTEM_PROMPT: "Test system prompt",
	buildSystemPrompt: vi.fn(() => "Built system prompt"),
}));

import {
	AIService,
	createAIService,
} from "../../../source/services/ai/service.js";
import type {
	IAIClient,
	ChatResponse,
	StreamChunk,
} from "../../../source/services/ai/types.js";
import type {
	IToolRegistry,
	ToolDefinition,
} from "../../../source/services/tools/types.js";
import {
	ToolMatcher,
	detectProjectType,
} from "../../../source/services/tools/matcher.js";
import { ToolCallHandler } from "../../../source/services/ai/tool-call-handler.js";
import { buildSystemPrompt } from "../../../source/constants/prompts.js";

// Helper to create mock client
function createMockClient(overrides?: Partial<IAIClient>): IAIClient {
	return {
		chat: vi.fn(
			async (): Promise<ChatResponse> => ({
				message: { role: "assistant", content: "Test response" },
				finish_reason: "stop",
			}),
		),
		...overrides,
	};
}

// Helper to create mock registry
function createMockRegistry(tools: ToolDefinition[] = []): IToolRegistry {
	return {
		getAllTools: vi.fn(() => tools),
		getTool: vi.fn((id) => tools.find((t) => t.id === id)),
		getInstalledTools: vi.fn(() => tools.filter((t) => t.installed)),
		discoverTools: vi.fn(async () => {}),
		getToolsByType: vi.fn(() => []),
		addTool: vi.fn(),
		updateTool: vi.fn(),
		removeTool: vi.fn(),
	};
}

describe("AIService", () => {
	let mockClient: IAIClient;
	let mockRegistry: IToolRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = createMockClient();
		mockRegistry = createMockRegistry();
	});

	describe("constructor", () => {
		it("should create service with default config", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			expect(service.getContextWindow()).toBe(32768); // DEFAULT_CONTEXT_WINDOW
			// ToolMatcher and ToolCallHandler are instantiated internally
			expect(service).toBeDefined();
		});

		it("should create service with custom context window", () => {
			const service = new AIService(
				{ client: mockClient, contextWindow: 16384 },
				mockRegistry,
			);

			expect(service.getContextWindow()).toBe(16384);
		});

		it("should create service with custom maxToolCallRounds", () => {
			const service = new AIService(
				{ client: mockClient, maxToolCallRounds: 10 },
				mockRegistry,
			);

			// Can't directly test this, but we can verify it doesn't throw
			expect(service).toBeDefined();
		});
	});

	describe("setSystemPrompt", () => {
		it("should set system prompt on session", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			service.setSystemPrompt("Custom prompt");

			// The prompt is stored in session, we can verify by checking history behavior
			expect(service.getHistory()).toEqual([]);
		});
	});

	describe("getHistory", () => {
		it("should return empty history initially", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			expect(service.getHistory()).toEqual([]);
		});

		it("should return history after messages", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello");

			const history = service.getHistory();
			expect(history.length).toBe(2); // user + assistant
			expect(history[0]?.role).toBe("user");
			expect(history[1]?.role).toBe("assistant");
		});
	});

	describe("clearHistory", () => {
		it("should clear all history", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello");
			expect(service.getHistory().length).toBe(2);

			service.clearHistory();
			expect(service.getHistory()).toEqual([]);
		});
	});

	describe("getSessionStatus", () => {
		it("should return session status", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			const status = service.getSessionStatus();

			expect(status).toHaveProperty("usedTokens");
			expect(status).toHaveProperty("messageCount");
		});
	});

	describe("getAvailableTokens", () => {
		it("should return available tokens", () => {
			const service = new AIService(
				{ client: mockClient, contextWindow: 8192 },
				mockRegistry,
			);

			const available = service.getAvailableTokens();

			expect(available).toBeGreaterThan(0);
			expect(available).toBeLessThanOrEqual(8192);
		});
	});

	describe("shouldCompact", () => {
		it("should return compact check result", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			const result = service.shouldCompact(0);

			expect(result).toHaveProperty("shouldCompact");
			// reason is optional, only present when shouldCompact is true
			expect(typeof result.shouldCompact).toBe("boolean");
		});
	});

	describe("compactWith", () => {
		it("should reset session with summary", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello");
			expect(service.getHistory().length).toBe(2);

			service.compactWith("Summary of conversation");

			const history = service.getHistory();
			expect(history.length).toBe(1);
			expect(history[0]?.role).toBe("assistant");
			expect(history[0]?.content).toContain("Summary");
		});
	});

	describe("getSession", () => {
		it("should return session instance", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			const session = service.getSession();

			expect(session).toBeDefined();
			expect(typeof session.getStatus).toBe("function");
		});
	});

	describe("restoreSession", () => {
		it("should restore session from another session", async () => {
			const service1 = new AIService({ client: mockClient }, mockRegistry);
			await service1.sendMessage("Hello from session 1");

			const service2 = new AIService({ client: mockClient }, mockRegistry);
			service2.restoreSession(service1.getSession());

			const history = service2.getHistory();
			expect(history.length).toBe(2);
			expect(history[0]?.content).toBe("Hello from session 1");
		});
	});

	describe("savePartialResponse", () => {
		it("should save partial response to session", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			service.savePartialResponse("Partial content");

			const history = service.getHistory();
			expect(history.length).toBe(1);
			expect(history[0]?.content).toContain("Partial content");
			expect(history[0]?.content).toContain("[Response interrupted]");
		});

		it("should not save empty content", () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			service.savePartialResponse("");
			service.savePartialResponse("   ");

			expect(service.getHistory()).toEqual([]);
		});
	});

	describe("sendMessage", () => {
		it("should send message and get response", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			const response = await service.sendMessage("Hello");

			expect(response).toBe("Test response");
			expect(mockClient.chat).toHaveBeenCalled();
		});

		it("should inject context into system prompt on first message", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello", { cwd: "/project" });

			expect(buildSystemPrompt).toHaveBeenCalledWith("/project", "node", false);
		});

		it("should not re-inject context on subsequent messages", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello", { cwd: "/project" });
			vi.mocked(buildSystemPrompt).mockClear();

			await service.sendMessage("World", { cwd: "/project" });

			expect(buildSystemPrompt).not.toHaveBeenCalled();
		});

		it("should detect project type from cwd", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			await service.sendMessage("Hello", { cwd: "/my-project" });

			expect(detectProjectType).toHaveBeenCalledWith("/my-project");
		});
	});

	describe("sendMessageWithStatus", () => {
		it("should return detailed result with session status", async () => {
			const service = new AIService({ client: mockClient }, mockRegistry);

			const result = await service.sendMessageWithStatus("Hello");

			expect(result.content).toBe("Test response");
			expect(result.sessionStatus).toHaveProperty("usedTokens");
		});
	});

	describe("streamMessage", () => {
		it("should stream message with callbacks", async () => {
			const chunks: StreamChunk[] = [
				{ delta: { content: "Hello " }, finish_reason: null },
				{ delta: { content: "World" }, finish_reason: "stop" },
			];

			async function* mockStreamChat() {
				for (const chunk of chunks) {
					yield chunk;
				}
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);
			const onStart = vi.fn();
			const onChunk = vi.fn();
			const onEnd = vi.fn();

			const result = await service.streamMessage(
				"Hello",
				{},
				{ onStart, onChunk, onEnd },
			);

			expect(result).toBe("Hello World");
			expect(onStart).toHaveBeenCalled();
			expect(onChunk).toHaveBeenCalled();
			expect(onEnd).toHaveBeenCalled();
		});

		it("should handle reasoning content in stream", async () => {
			const chunks: StreamChunk[] = [
				{ delta: { reasoning_content: "Thinking..." }, finish_reason: null },
				{ delta: { content: "Answer" }, finish_reason: "stop" },
			];

			async function* mockStreamChat() {
				for (const chunk of chunks) {
					yield chunk;
				}
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);
			const onChunk = vi.fn();
			const onEnd = vi.fn();

			await service.streamMessage("Hello", {}, { onChunk, onEnd });

			expect(onEnd).toHaveBeenCalledWith({
				reasoning: "Thinking...",
				content: "Answer",
			});
		});

		it("should fallback to non-streaming when streamChat not available", async () => {
			// Client without streamChat
			const clientWithoutStream = createMockClient();
			delete (clientWithoutStream as any).streamChat;

			const service = new AIService(
				{ client: clientWithoutStream },
				mockRegistry,
			);

			const result = await service.streamMessage("Hello");

			expect(result).toBe("Test response");
		});

		it("should handle abort signal", async () => {
			const controller = new AbortController();

			async function* mockStreamChat() {
				yield { delta: { content: "Start" }, finish_reason: null };
				// Simulate abort during stream
				controller.abort();
				yield { delta: { content: " More" }, finish_reason: null };
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);

			// Abort immediately
			controller.abort();

			await expect(
				service.streamMessage("Hello", {}, {}, { signal: controller.signal }),
			).rejects.toThrow("Request was aborted");
		});

		it("should rollback session on error (non-abort)", async () => {
			async function* mockStreamChat(): AsyncGenerator<StreamChunk> {
				yield { delta: { content: "Start" }, finish_reason: null };
				throw new Error("Network error");
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);

			// First, add some history
			await service.sendMessage("Setup");
			const historyBefore = service.getHistory().length;

			// Now try streaming which will fail
			await expect(service.streamMessage("Fail")).rejects.toThrow(
				"Network error",
			);

			// History should be restored (rollback)
			expect(service.getHistory().length).toBe(historyBefore);
		});

		it("should handle eos finish reason", async () => {
			const chunks: StreamChunk[] = [
				{ delta: { content: "Response" }, finish_reason: "eos" },
			];

			async function* mockStreamChat() {
				for (const chunk of chunks) {
					yield chunk;
				}
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);

			const result = await service.streamMessage("Hello");

			expect(result).toBe("Response");
		});

		it("should handle length finish reason", async () => {
			const chunks: StreamChunk[] = [
				{ delta: { content: "Truncated" }, finish_reason: "length" },
			];

			async function* mockStreamChat() {
				for (const chunk of chunks) {
					yield chunk;
				}
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);

			const result = await service.streamMessage("Hello");

			expect(result).toBe("Truncated");
		});

		it("should return empty string when stream ends without content", async () => {
			async function* mockStreamChat(): AsyncGenerator<StreamChunk> {
				// Empty stream
			}

			mockClient.streamChat = vi.fn(() => mockStreamChat());

			const service = new AIService({ client: mockClient }, mockRegistry);
			const onEnd = vi.fn();

			const result = await service.streamMessage("Hello", {}, { onEnd });

			expect(result).toBe("");
			expect(onEnd).toHaveBeenCalledWith({ reasoning: "", content: "" });
		});
	});

	describe("tool calling", () => {
		it("should select tools based on context", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			const service = new AIService({ client: mockClient }, registry);

			await service.sendMessage("Hello", { cwd: "/project" });

			expect(mockMatcherInstance.autoSelect).toHaveBeenCalled();
		});

		it("should handle tool calls in non-streaming mode", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			// First call returns tool_calls, second returns final response
			let callCount = 0;
			mockClient.chat = vi.fn(async (): Promise<ChatResponse> => {
				callCount++;
				if (callCount === 1) {
					return {
						message: {
							role: "assistant",
							content: "",
							tool_calls: [
								{
									id: "call_1",
									type: "function",
									function: { name: "test-tool", arguments: "{}" },
								},
							],
						},
						finish_reason: "tool_calls",
					};
				}
				return {
					message: { role: "assistant", content: "Final response" },
					finish_reason: "stop",
				};
			});

			// Configure the shared tool handler mock
			mockToolCallHandlerInstance.handleToolCalls.mockResolvedValue([
				{
					role: "tool" as const,
					content: "Tool result",
					tool_call_id: "call_1",
				},
			]);

			const service = new AIService({ client: mockClient }, registry);

			const result = await service.sendMessage("Use tool", { cwd: "/project" });

			expect(result).toBe("Final response");
			expect(mockToolCallHandlerInstance.handleToolCalls).toHaveBeenCalled();
		});

		it("should handle tool calls in streaming mode", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			// Configure the shared tool handler mock
			mockToolCallHandlerInstance.handleToolCalls.mockResolvedValue([
				{
					role: "tool" as const,
					content: "Tool result",
					tool_call_id: "call_1",
				},
			]);

			let streamCallCount = 0;
			mockClient.streamChat = vi.fn(() => {
				streamCallCount++;
				if (streamCallCount === 1) {
					async function* firstStream(): AsyncGenerator<StreamChunk> {
						yield {
							delta: {
								content: "",
								tool_calls: [
									{
										id: "call_1",
										type: "function",
										function: { name: "test-tool", arguments: "{}" },
									},
								],
							},
							finish_reason: "tool_calls",
						};
					}
					return firstStream();
				}
				async function* secondStream(): AsyncGenerator<StreamChunk> {
					yield { delta: { content: "Final" }, finish_reason: "stop" };
				}
				return secondStream();
			});

			const service = new AIService({ client: mockClient }, registry);

			const result = await service.streamMessage("Use tool", {
				cwd: "/project",
			});

			expect(result).toBe("Final");
			expect(mockToolCallHandlerInstance.handleToolCalls).toHaveBeenCalled();
		});

		it("should respect maxToolCallRounds limit", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			// Configure the shared tool handler mock
			mockToolCallHandlerInstance.handleToolCalls.mockResolvedValue([
				{
					role: "tool" as const,
					content: "Tool result",
					tool_call_id: "call_1",
				},
			]);

			// Always return tool_calls to hit the limit
			mockClient.chat = vi.fn(
				async (): Promise<ChatResponse> => ({
					message: {
						role: "assistant",
						content: "",
						tool_calls: [
							{
								id: "call_1",
								type: "function",
								function: { name: "test-tool", arguments: "{}" },
							},
						],
					},
					finish_reason: "tool_calls",
				}),
			);

			const service = new AIService(
				{ client: mockClient, maxToolCallRounds: 3 },
				registry,
			);

			const result = await service.sendMessage("Use tool repeatedly", {
				cwd: "/project",
			});

			expect(result).toContain("Maximum tool call rounds limit reached");
			expect(mockClient.chat).toHaveBeenCalledTimes(3);
		});

		it("should respect maxToolCallRounds limit in streaming mode", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			// Configure the shared tool handler mock
			mockToolCallHandlerInstance.handleToolCalls.mockResolvedValue([
				{
					role: "tool" as const,
					content: "Tool result",
					tool_call_id: "call_1",
				},
			]);

			// Always return tool_calls in stream to hit the limit
			mockClient.streamChat = vi.fn(() => {
				async function* toolStream(): AsyncGenerator<StreamChunk> {
					yield {
						delta: {
							content: "",
							tool_calls: [
								{
									id: "call_1",
									type: "function",
									function: { name: "test-tool", arguments: "{}" },
								},
							],
						},
						finish_reason: "tool_calls",
					};
				}
				return toolStream();
			});

			const service = new AIService(
				{ client: mockClient, maxToolCallRounds: 3 },
				registry,
			);

			const onEnd = vi.fn();
			const result = await service.streamMessage(
				"Use tool repeatedly",
				{ cwd: "/project" },
				{ onEnd },
			);

			expect(result).toContain("Maximum tool call rounds limit reached");
			expect(mockClient.streamChat).toHaveBeenCalledTimes(3);
			expect(onEnd).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.stringContaining("Maximum tool call rounds limit reached"),
				}),
			);
		});

		it("should select tools from query matches", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "matched-tool",
					name: "Matched Tool",
					description: "Tool matched by query",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance for query matching
			mockMatcherInstance.autoSelect.mockReturnValue([]); // No auto-selected tools
			mockMatcherInstance.match.mockReturnValue([{ tool: tools[0], score: 0.9 }]); // Match by query

			const service = new AIService({ client: mockClient }, registry);

			await service.sendMessage("Use matched tool", { cwd: "/project" });

			// Verify match was called with the query
			expect(mockMatcherInstance.match).toHaveBeenCalled();
		});
	});

	describe("context aware disabled", () => {
		it("should not use tools when contextAwareEnabled is false", async () => {
			const tools: ToolDefinition[] = [
				{
					id: "test-tool",
					name: "Test Tool",
					description: "A test tool",
					type: "node",
					installed: true,
					parameters: {},
				},
			];
			const registry = createMockRegistry(tools);

			// Configure the shared mock instance
			mockMatcherInstance.autoSelect.mockReturnValue([tools[0]]);
			mockMatcherInstance.match.mockReturnValue([]);

			const service = new AIService(
				{ client: mockClient, contextAwareEnabled: false },
				registry,
			);

			await service.sendMessage("Hello", { cwd: "/project" });

			// Chat should be called without tools
			expect(mockClient.chat).toHaveBeenCalledWith(expect.any(Array));
		});
	});

	describe("createAIService", () => {
		it("should create an AIService instance", () => {
			const service = createAIService({ client: mockClient }, mockRegistry);

			expect(service).toBeInstanceOf(AIService);
		});
	});
});
