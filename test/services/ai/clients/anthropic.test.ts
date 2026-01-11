import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config module
vi.mock("../../../../source/utils/config.js", () => ({
	isThinkingEnabled: vi.fn(() => false),
	currentModelSupportsThinking: vi.fn(() => false),
	currentModelSupportsToolChoice: vi.fn(() => false),
	currentModelSupportsPrefill: vi.fn(() => true),
}));

// Mock adapters
vi.mock("../../../../source/services/ai/adapters/anthropic.js", () => ({
	toAnthropicMessages: vi.fn((msgs) =>
		msgs
			.filter((m: any) => m.role !== "system")
			.map((m: any) => ({ role: m.role, content: m.content })),
	),
	extractSystemMessage: vi.fn((msgs) => {
		const sys = msgs.find((m: any) => m.role === "system");
		return sys?.content || null;
	}),
	parseAnthropicToolUse: vi.fn((blocks) =>
		blocks.map((b: any) => ({
			id: b.id,
			type: "function",
			function: { name: b.name, arguments: JSON.stringify(b.input) },
		})),
	),
}));

import { AnthropicClient } from "../../../../source/services/ai/clients/anthropic.js";
import {
	isThinkingEnabled,
	currentModelSupportsThinking,
} from "../../../../source/utils/config.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AnthropicClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should create client with default config", () => {
			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
			});

			const config = client.getConfig();
			expect(config.apiKey).toBe("test-key");
			expect(config.model).toBe("claude-3-opus");
			expect(config.baseUrl).toBe("https://api.anthropic.com");
			expect(config.timeout).toBe(60000);
			expect(config.maxRetries).toBe(3);
		});

		it("should create client with custom config", () => {
			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://custom.api.com",
				timeout: 30000,
				maxRetries: 5,
			});

			const config = client.getConfig();
			expect(config.baseUrl).toBe("https://custom.api.com");
			expect(config.timeout).toBe(30000);
			expect(config.maxRetries).toBe(5);
		});
	});

	describe("chat", () => {
		it("should make successful chat request", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [{ type: "text", text: "Hello!" }],
					model: "claude-3-opus",
					stop_reason: "end_turn",
					stop_sequence: null,
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const result = await client.chat([{ role: "user", content: "Hi" }]);

			expect(result.message.content).toBe("Hello!");
			expect(result.finish_reason).toBe("stop");
			expect(result.usage?.total_tokens).toBe(15);
		});

		it("should handle API error response", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: async () => "Invalid API key",
			});

			const client = new AnthropicClient({
				apiKey: "bad-key",
				model: "claude-3-opus",
				maxRetries: 1,
			});

			await expect(
				client.chat([{ role: "user", content: "Hi" }]),
			).rejects.toThrow("Anthropic API error: 401 Unauthorized");
		});

		it("should include tools in request when provided", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [{ type: "text", text: "Using tool" }],
					stop_reason: "end_turn",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: {},
					},
				},
			];

			await client.chat([{ role: "user", content: "Hi" }], tools);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining("tools"),
				}),
			);
		});

		it("should parse tool_use blocks in response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [
						{ type: "text", text: "" },
						{
							type: "tool_use",
							id: "toolu_1",
							name: "test_tool",
							input: { arg: "value" },
						},
					],
					stop_reason: "tool_use",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const result = await client.chat([{ role: "user", content: "Hi" }]);

			expect(result.finish_reason).toBe("tool_calls");
			expect(result.message.tool_calls).toHaveLength(1);
			expect(result.message.tool_calls?.[0]?.function.name).toBe("test_tool");
		});

		it("should retry on failure", async () => {
			mockFetch
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						id: "msg_123",
						type: "message",
						role: "assistant",
						content: [{ type: "text", text: "Success after retry" }],
						stop_reason: "end_turn",
						usage: { input_tokens: 10, output_tokens: 5 },
					}),
				});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
				maxRetries: 3,
			});

			const resultPromise = client.chat([{ role: "user", content: "Hi" }]);

			// Advance timers to allow retry
			await vi.advanceTimersByTimeAsync(1000);

			const result = await resultPromise;
			expect(result.message.content).toBe("Success after retry");
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("should include system message when present", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [{ type: "text", text: "Response" }],
					stop_reason: "end_turn",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await client.chat([
				{ role: "system", content: "You are helpful" },
				{ role: "user", content: "Hi" },
			]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining("system"),
				}),
			);
		});

		it("should add thinking when thinking is enabled", async () => {
			vi.mocked(isThinkingEnabled).mockReturnValue(true);
			vi.mocked(currentModelSupportsThinking).mockReturnValue(true);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [{ type: "text", text: "Thinking response" }],
					stop_reason: "end_turn",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await client.chat([{ role: "user", content: "Hi" }]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining("thinking"),
				}),
			);
		});

		it("should handle max_tokens stop reason", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [{ type: "text", text: "Truncated" }],
					stop_reason: "max_tokens",
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const result = await client.chat([{ role: "user", content: "Hi" }]);

			expect(result.finish_reason).toBe("length");
		});
	});

	describe("streamChat", () => {
		it("should stream chat responses", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n',
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}\n\n',
				'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
				'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
				'event: message_stop\ndata: {"type":"message_stop"}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const results: string[] = [];
			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				if (chunk.delta.content) {
					results.push(chunk.delta.content);
				}
			}

			expect(results).toEqual(["Hello", " World"]);
		});

		it("should handle streaming API error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: async () => "Server error",
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await expect(async () => {
				for await (const _chunk of client.streamChat([
					{ role: "user", content: "Hi" },
				])) {
					void _chunk; // consume
				}
			}).rejects.toThrow("Anthropic API error: 500 Internal Server Error");
		});

		it("should handle null response body", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: null,
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await expect(async () => {
				for await (const _chunk of client.streamChat([
					{ role: "user", content: "Hi" },
				])) {
					void _chunk; // consume
				}
			}).rejects.toThrow("Response body is null");
		});

		it("should handle external abort signal", async () => {
			const controller = new AbortController();
			controller.abort();

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await expect(async () => {
				for await (const _chunk of client.streamChat(
					[{ role: "user", content: "Hi" }],
					undefined,
					{ signal: controller.signal },
				)) {
					void _chunk; // consume
				}
			}).rejects.toThrow("Request was aborted");
		});

		it("should handle thinking content in stream", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Thinking..."}}\n\n',
				'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
				'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Answer"}}\n\n',
				'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
				'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
				'event: message_stop\ndata: {"type":"message_stop"}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const reasonings: string[] = [];
			const contents: string[] = [];

			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				if (chunk.delta.reasoning_content) {
					reasonings.push(chunk.delta.reasoning_content);
				}
				if (chunk.delta.content) {
					contents.push(chunk.delta.content);
				}
			}

			expect(reasonings).toContain("Thinking...");
			expect(contents).toContain("Answer");
		});

		it("should handle tool_use in stream", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"test_tool"}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"arg\\":"}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"value\\"}"}}\n\n',
				'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
				'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}\n\n',
				'event: message_stop\ndata: {"type":"message_stop"}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			let finalChunk: any = null;
			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				if (chunk.finish_reason === "tool_calls") {
					finalChunk = chunk;
				}
			}

			expect(finalChunk).not.toBeNull();
			expect(finalChunk.delta.tool_calls).toHaveLength(1);
			expect(finalChunk.delta.tool_calls[0].function.name).toBe("test_tool");
		});

		it("should handle error event in stream", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: error\ndata: {"type":"error","error":{"message":"Rate limit exceeded"}}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			await expect(async () => {
				for await (const _chunk of client.streamChat([
					{ role: "user", content: "Hi" },
				])) {
					void _chunk; // consume
				}
			}).rejects.toThrow("Anthropic streaming error: Rate limit exceeded");
		});

		it("should handle stream ending without explicit finish", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Partial"}}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const results: any[] = [];
			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				results.push(chunk);
			}

			// Should have a final stop chunk
			const lastChunk = results[results.length - 1];
			expect(lastChunk.finish_reason).toBe("stop");
		});

		it("should skip invalid JSON lines and continue processing", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
				"event: content_block_delta\ndata: {invalid json}\n\n",
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Valid"}}\n\n',
				'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
				'event: message_stop\ndata: {"type":"message_stop"}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			const results: string[] = [];
			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				if (chunk.delta.content) {
					results.push(chunk.delta.content);
				}
			}

			// Should have processed the valid line after invalid one
			expect(results).toContain("Valid");
		});

		it("should cleanup external abort signal listener in finally", async () => {
			const encoder = new TextEncoder();
			const events = [
				'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
				'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
				'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
				'event: message_stop\ndata: {"type":"message_stop"}\n\n',
			];

			let eventIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (eventIndex < events.length) {
						const value = encoder.encode(events[eventIndex]!);
						eventIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const controller = new AbortController();
			const removeEventListenerSpy = vi.spyOn(
				controller.signal,
				"removeEventListener",
			);

			const client = new AnthropicClient({
				apiKey: "test-key",
				model: "claude-3-opus",
				baseUrl: "https://api.anthropic.com/v1",
			});

			for await (const _chunk of client.streamChat(
				[{ role: "user", content: "Hi" }],
				undefined,
				{ signal: controller.signal },
			)) {
				void _chunk; // consume
			}

			// Verify that removeEventListener was called in the finally block
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"abort",
				expect.any(Function),
			);
		});
	});
});
