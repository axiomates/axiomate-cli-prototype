import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config module
vi.mock("../../../../source/utils/config.js", () => ({
	getThinkingParams: vi.fn(() => null),
	currentModelSupportsToolChoice: vi.fn(() => false),
}));

// Mock adapters
vi.mock("../../../../source/services/ai/adapters/openai.js", () => ({
	toOpenAIMessages: vi.fn((msgs) => msgs),
	parseOpenAIToolCalls: vi.fn((toolCalls) =>
		toolCalls.map((tc: any) => ({
			id: tc.id,
			type: "function",
			function: { name: tc.function.name, arguments: tc.function.arguments },
		})),
	),
}));

import { OpenAIClient } from "../../../../source/services/ai/clients/openai.js";
import { getThinkingParams } from "../../../../source/utils/config.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OpenAIClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should create client with default config", () => {
			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
			});

			const config = client.getConfig();
			expect(config.apiKey).toBe("test-key");
			expect(config.model).toBe("gpt-4");
			expect(config.baseUrl).toBe("https://api.openai.com");
			expect(config.timeout).toBe(60000);
			expect(config.maxRetries).toBe(3);
		});

		it("should create client with custom config", () => {
			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
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
					id: "chatcmpl-123",
					object: "chat.completion",
					created: 1234567890,
					model: "gpt-4",
					choices: [
						{
							index: 0,
							message: { role: "assistant", content: "Hello!" },
							finish_reason: "stop",
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

			const client = new OpenAIClient({
				apiKey: "bad-key",
				model: "gpt-4",
				maxRetries: 1,
			});

			await expect(
				client.chat([{ role: "user", content: "Hi" }]),
			).rejects.toThrow("OpenAI API error: 401 Unauthorized");
		});

		it("should include tools in request when provided", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [
						{
							message: { role: "assistant", content: "Using tool" },
							finish_reason: "stop",
						},
					],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

		it("should parse tool_calls in response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [
						{
							message: {
								role: "assistant",
								content: "",
								tool_calls: [
									{
										id: "call_1",
										type: "function",
										function: { name: "test_tool", arguments: "{}" },
									},
								],
							},
							finish_reason: "tool_calls",
						},
					],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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
						id: "chatcmpl-123",
						choices: [
							{
								message: { role: "assistant", content: "Success after retry" },
								finish_reason: "stop",
							},
						],
					}),
				});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
				maxRetries: 3,
			});

			const resultPromise = client.chat([{ role: "user", content: "Hi" }]);

			// Advance timers to allow retry
			await vi.advanceTimersByTimeAsync(1000);

			const result = await resultPromise;
			expect(result.message.content).toBe("Success after retry");
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("should handle empty choices", async () => {
			// Reset mock to ensure clean state
			mockFetch.mockReset();
			// Need to mock all retry attempts to return empty choices
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
				maxRetries: 1, // Single attempt to avoid long wait
			});

			await expect(
				client.chat([{ role: "user", content: "Hi" }]),
			).rejects.toThrow("No response from OpenAI API");
		});

		it("should add thinking params when getThinkingParams returns params", async () => {
			vi.mocked(getThinkingParams).mockReturnValue({ enable_thinking: true });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [
						{
							message: { role: "assistant", content: "Thinking response" },
							finish_reason: "stop",
						},
					],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
			});

			await client.chat([{ role: "user", content: "Hi" }]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining('"enable_thinking":true'),
				}),
			);
		});

		it("should not add thinking params when getThinkingParams returns null", async () => {
			vi.mocked(getThinkingParams).mockReturnValue(null);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [
						{
							message: { role: "assistant", content: "Response" },
							finish_reason: "stop",
						},
					],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
			});

			await client.chat([{ role: "user", content: "Hi" }]);

			const callBody = mockFetch.mock.calls[0][1].body;
			expect(callBody).not.toContain("enable_thinking");
		});

		it("should support custom thinking params format", async () => {
			// 测试 Ollama 风格的 think 参数
			vi.mocked(getThinkingParams).mockReturnValue({ think: true });

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "chatcmpl-123",
					choices: [
						{
							message: { role: "assistant", content: "Response" },
							finish_reason: "stop",
						},
					],
				}),
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "llama",
				baseUrl: "http://localhost:11434/v1",
			});

			await client.chat([{ role: "user", content: "Hi" }]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining('"think":true'),
				}),
			);
		});

		it("should parse different finish reasons", async () => {
			const finishReasons = ["stop", "eos", "tool_calls", "length", "unknown"];
			const expectedReasons = ["stop", "eos", "tool_calls", "length", "stop"];

			for (let i = 0; i < finishReasons.length; i++) {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						id: "chatcmpl-123",
						choices: [
							{
								message: { role: "assistant", content: "Response" },
								finish_reason: finishReasons[i],
							},
						],
					}),
				});

				const client = new OpenAIClient({
					apiKey: "test-key",
					model: "gpt-4",
					baseUrl: "https://api.openai.com/v1",
				});

				const result = await client.chat([{ role: "user", content: "Hi" }]);
				expect(result.finish_reason).toBe(expectedReasons[i]);
			}
		});
	});

	describe("streamChat", () => {
		it("should stream chat responses", async () => {
			const encoder = new TextEncoder();
			const chunks = [
				'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{"content":" World"},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

		it("should handle [DONE] marker", async () => {
			const encoder = new TextEncoder();
			const chunks = [
				'data: {"choices":[{"delta":{"content":"Response"},"finish_reason":null}]}\n\n',
				"data: [DONE]\n\n",
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
			});

			const results: any[] = [];
			for await (const chunk of client.streamChat([
				{ role: "user", content: "Hi" },
			])) {
				results.push(chunk);
			}

			// Should have received content and a final stop chunk
			expect(results.length).toBeGreaterThan(0);
		});

		it("should handle streaming API error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: async () => "Server error",
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
			});

			await expect(async () => {
				for await (const _chunk of client.streamChat([
					{ role: "user", content: "Hi" },
				])) {
					void _chunk; // consume
				}
			}).rejects.toThrow("OpenAI API error: 500 Internal Server Error");
		});

		it("should handle null response body", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: null,
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

		it("should handle reasoning_content in stream", async () => {
			const encoder = new TextEncoder();
			const chunks = [
				'data: {"choices":[{"delta":{"reasoning_content":"Thinking..."},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{"content":"Answer"},"finish_reason":"stop"}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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

		it("should accumulate tool_calls across chunks", async () => {
			const encoder = new TextEncoder();
			const chunks = [
				'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"test_tool","arguments":"{"}}]},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"}"}}]},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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
			expect(finalChunk.delta.tool_calls[0].function.arguments).toBe("{}");
		});

		it("should handle stream ending without explicit finish_reason", async () => {
			const encoder = new TextEncoder();
			const chunks = [
				'data: {"choices":[{"delta":{"content":"Partial"},"finish_reason":null}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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
			const chunks = [
				"data: {invalid json}\n\n",
				'data: {"choices":[{"delta":{"content":"Valid"},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
						return { done: false, value };
					}
					return { done: true, value: undefined };
				}),
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: { getReader: () => mockReader },
			});

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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
			const chunks = [
				'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
				'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
			];

			let chunkIndex = 0;
			const mockReader = {
				read: vi.fn(async () => {
					if (chunkIndex < chunks.length) {
						const value = encoder.encode(chunks[chunkIndex]!);
						chunkIndex++;
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

			const client = new OpenAIClient({
				apiKey: "test-key",
				model: "gpt-4",
				baseUrl: "https://api.openai.com/v1",
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
