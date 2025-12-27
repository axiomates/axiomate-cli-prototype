import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	DEFAULT_MODEL_ID,
	DEFAULT_SUGGESTION_MODEL_ID,
	getDefaultModel,
	getAllModels,
	getModelById,
} from "../../source/constants/models.js";

// Mock config module
vi.mock("../../source/utils/config.js", () => ({
	getAllModels: vi.fn(),
	getModelById: vi.fn(),
}));

import * as configModule from "../../source/utils/config.js";

describe("models", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("DEFAULT_MODEL_ID", () => {
		it("should be Qwen/Qwen3-8B", () => {
			expect(DEFAULT_MODEL_ID).toBe("Qwen/Qwen3-8B");
		});
	});

	describe("DEFAULT_SUGGESTION_MODEL_ID", () => {
		it("should be THUDM/glm-4-9b-chat", () => {
			expect(DEFAULT_SUGGESTION_MODEL_ID).toBe("THUDM/glm-4-9b-chat");
		});
	});

	describe("getDefaultModel", () => {
		it("should return model config when found", () => {
			const mockModel = {
				model: "Qwen/Qwen3-8B",
				name: "Qwen3",
				protocol: "openai" as const,
				supportsTools: true,
				supportsThinking: false,
				contextWindow: 32768,
				baseUrl: "https://api.example.com",
				apiKey: "test-key",
			};
			vi.mocked(configModule.getModelById).mockReturnValue(mockModel);

			const result = getDefaultModel();
			expect(result).toEqual(mockModel);
			expect(configModule.getModelById).toHaveBeenCalledWith(DEFAULT_MODEL_ID);
		});

		it("should return null when model not found", () => {
			vi.mocked(configModule.getModelById).mockReturnValue(undefined);

			const result = getDefaultModel();
			expect(result).toBeNull();
		});
	});

	describe("re-exported functions", () => {
		it("should re-export getAllModels", () => {
			expect(getAllModels).toBe(configModule.getAllModels);
		});

		it("should re-export getModelById", () => {
			expect(getModelById).toBe(configModule.getModelById);
		});
	});
});
