import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	SuggestionClient,
	getSuggestionClient,
} from "../../../source/services/ai/suggestionClient.js";

// Mock dependencies
vi.mock("../../../source/constants/suggestion.js", () => ({
	SUGGESTION_CONFIG: {
		maxTokens: 100,
		temperature: 0.3,
		timeout: 5000,
	},
	SUGGESTION_SYSTEM_PROMPT: "You are a suggestion assistant",
	SUGGESTION_CACHE: {
		maxSize: 100,
		ttl: 60000,
	},
	getSuggestionModel: vi.fn(() => "test-model"),
}));

vi.mock("../../../source/utils/config.js", () => ({
	getModelApiConfig: vi.fn(() => ({
		baseUrl: "https://api.test.com",
		apiKey: "test-api-key",
	})),
}));

describe("SuggestionClient", () => {
	let client: SuggestionClient;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new SuggestionClient();
		fetchMock = vi.fn();
		global.fetch = fetchMock;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("getSuggestion", () => {
		it("should return suggestion from API", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "test suggestion" } }],
					}),
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBe("test suggestion");
			expect(result.cached).toBe(false);
		});

		it("should return cached suggestion on second call", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "cached suggestion" } }],
					}),
			});

			// First call - from API
			const result1 = await client.getSuggestion("hello");
			expect(result1.suggestion).toBe("cached suggestion");
			expect(result1.cached).toBe(false);

			// Second call - from cache
			const result2 = await client.getSuggestion("hello");
			expect(result2.suggestion).toBe("cached suggestion");
			expect(result2.cached).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("should handle API error gracefully", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 500,
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBeNull();
			expect(result.cached).toBe(false);
		});

		it("should handle network error gracefully", async () => {
			fetchMock.mockRejectedValueOnce(new Error("Network error"));

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBeNull();
			expect(result.cached).toBe(false);
		});

		it("should handle empty response", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "" } }],
					}),
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBeNull();
		});

		it("should handle response with no choices", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ choices: [] }),
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBeNull();
		});

		it("should clean up suggestion by removing quotes", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: '"quoted suggestion"' } }],
					}),
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBe("quoted suggestion");
		});

		it("should clean up suggestion by removing input prefix", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "hello world complete" } }],
					}),
			});

			const result = await client.getSuggestion("hello");
			expect(result.suggestion).toBe("world complete");
		});

		it("should replace newlines with spaces", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "line1\nline2\r\nline3" } }],
					}),
			});

			const result = await client.getSuggestion("test");
			expect(result.suggestion).not.toContain("\n");
			expect(result.suggestion).not.toContain("\r");
		});

		it("should return null when cleaned suggestion is empty after processing", async () => {
			// Input: "hello world", suggestion after quote removal is just the same text
			// After removing input prefix, it becomes empty or whitespace
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: '"hello"' } }], // Just the input wrapped in quotes
					}),
			});

			const result = await client.getSuggestion("hello");
			// After cleaning: "hello" -> remove quotes -> "hello" -> remove input prefix -> ""
			expect(result.suggestion).toBeNull();
		});

		it("should return null when suggestion becomes whitespace after cleaning", async () => {
			// Content that passes the initial check but becomes whitespace after quote removal
			// "'   '" -> trim -> "'   '" -> remove quotes -> "   " -> collapse spaces -> " " -> trim -> "" (empty)
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "'   '" } }], // Quoted whitespace
					}),
			});

			const result = await client.getSuggestion("test");
			expect(result.suggestion).toBeNull();
		});

		it("should abort previous request when new one starts", async () => {
			// Track abort calls
			const abortSpy = vi.fn();

			// First request - will be aborted
			fetchMock.mockImplementationOnce((url, options) => {
				options?.signal?.addEventListener?.("abort", abortSpy);
				return new Promise(() => {}); // Never resolves
			});

			// Start first request (don't await)
			client.getSuggestion("slow");

			// Small delay to ensure first request starts
			await new Promise((r) => setTimeout(r, 5));

			// Starting second request should abort the first
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "fast" } }],
					}),
			});
			await client.getSuggestion("fast");

			// First request's signal should have been aborted
			expect(abortSpy).toHaveBeenCalled();
		});
	});

	describe("cancel", () => {
		it("should cancel in-progress request", async () => {
			const slowPromise = new Promise<Response>((_, reject) => {
				setTimeout(() => {
					reject(new DOMException("Aborted", "AbortError"));
				}, 100);
			});
			fetchMock.mockReturnValueOnce(slowPromise);

			const promise = client.getSuggestion("hello");
			client.cancel();

			const result = await promise;
			expect(result.suggestion).toBeNull();
		});

		it("should do nothing if no request in progress", () => {
			// Should not throw
			client.cancel();
		});
	});

	describe("clearCache", () => {
		it("should clear cached suggestions", async () => {
			fetchMock.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						choices: [{ message: { content: "suggestion" } }],
					}),
			});

			// First call
			await client.getSuggestion("hello");
			expect(fetchMock).toHaveBeenCalledTimes(1);

			// Second call - should be cached
			await client.getSuggestion("hello");
			expect(fetchMock).toHaveBeenCalledTimes(1);

			// Clear cache
			client.clearCache();

			// Third call - should fetch again
			await client.getSuggestion("hello");
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	describe("getSuggestionClient singleton", () => {
		it("should return same instance", () => {
			const instance1 = getSuggestionClient();
			const instance2 = getSuggestionClient();
			expect(instance1).toBe(instance2);
		});
	});
});

describe("SuggestionClient without API config", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("should return null when no API config", async () => {
		// Re-mock with null API config
		vi.doMock("../../../source/utils/config.js", () => ({
			getModelApiConfig: vi.fn(() => null),
		}));

		const { SuggestionClient } =
			await import("../../../source/services/ai/suggestionClient.js");
		const client = new SuggestionClient();
		const result = await client.getSuggestion("hello");
		expect(result.suggestion).toBeNull();
	});
});
