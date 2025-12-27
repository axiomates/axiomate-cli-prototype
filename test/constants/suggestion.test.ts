import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	getSuggestionModel,
	SUGGESTION_CONFIG,
	SUGGESTION_DEBOUNCE_MS,
	MIN_INPUT_LENGTH,
	SUGGESTION_SYSTEM_PROMPT,
	SUGGESTION_CACHE,
} from "../../source/constants/suggestion.js";

// Mock config module
vi.mock("../../source/utils/config.js", () => ({
	getSuggestionModelId: vi.fn(),
}));

import { getSuggestionModelId } from "../../source/utils/config.js";

describe("suggestion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getSuggestionModel", () => {
		it("should return model from config when available", () => {
			vi.mocked(getSuggestionModelId).mockReturnValue("custom-model");
			const result = getSuggestionModel();
			expect(result).toBe("custom-model");
		});

		it("should return default model when config returns empty", () => {
			vi.mocked(getSuggestionModelId).mockReturnValue("");
			const result = getSuggestionModel();
			expect(result).toBe("THUDM/GLM-Z1-9B-0414");
		});

		it("should return default model when config returns undefined-like", () => {
			vi.mocked(getSuggestionModelId).mockReturnValue(null as unknown as string);
			const result = getSuggestionModel();
			expect(result).toBe("THUDM/GLM-Z1-9B-0414");
		});
	});

	describe("SUGGESTION_CONFIG", () => {
		it("should have maxTokens", () => {
			expect(SUGGESTION_CONFIG.maxTokens).toBe(30);
		});

		it("should have timeout", () => {
			expect(SUGGESTION_CONFIG.timeout).toBe(3000);
		});

		it("should have temperature", () => {
			expect(SUGGESTION_CONFIG.temperature).toBe(0.3);
		});
	});

	describe("SUGGESTION_DEBOUNCE_MS", () => {
		it("should be 400ms", () => {
			expect(SUGGESTION_DEBOUNCE_MS).toBe(400);
		});
	});

	describe("MIN_INPUT_LENGTH", () => {
		it("should be 5", () => {
			expect(MIN_INPUT_LENGTH).toBe(5);
		});
	});

	describe("SUGGESTION_SYSTEM_PROMPT", () => {
		it("should be a non-empty string", () => {
			expect(typeof SUGGESTION_SYSTEM_PROMPT).toBe("string");
			expect(SUGGESTION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
		});

		it("should contain rules", () => {
			expect(SUGGESTION_SYSTEM_PROMPT).toContain("Rules:");
		});
	});

	describe("SUGGESTION_CACHE", () => {
		it("should have maxSize", () => {
			expect(SUGGESTION_CACHE.maxSize).toBe(50);
		});

		it("should have ttl", () => {
			expect(SUGGESTION_CACHE.ttl).toBe(60000);
		});
	});
});
