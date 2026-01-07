import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../../source/constants/models.js", () => ({
	getModelById: vi.fn(),
	getDefaultModel: vi.fn(),
	DEFAULT_MODEL_ID: "Qwen/Qwen3-8B",
}));

vi.mock("../../../source/utils/config.js", () => ({
	getCurrentModelId: vi.fn(),
	getModelApiConfig: vi.fn(),
	isApiConfigValid: vi.fn(),
}));

import {
	getCurrentModel,
	getApiConfig,
	getModelApiConfig,
	isApiConfigValid,
} from "../../../source/services/ai/config.js";
import * as modelsModule from "../../../source/constants/models.js";
import * as configModule from "../../../source/utils/config.js";

describe("ai/config", () => {
	const mockModelConfig = {
		model: "test-model",
		name: "Test Model",
		protocol: "openai" as const,
		supportsTools: true,
		supportsThinking: false,
		contextWindow: 4096,
		baseUrl: "https://api.test.com",
		apiKey: "test-key",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getCurrentModel", () => {
		it("should return model config when currentModel is set", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("test-model");
			vi.mocked(modelsModule.getModelById).mockReturnValue(mockModelConfig);

			const result = getCurrentModel();

			expect(result).toEqual(mockModelConfig);
		});

		it("should return default model when currentModel is not found", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("nonexistent");
			vi.mocked(modelsModule.getModelById).mockReturnValue(undefined);
			vi.mocked(modelsModule.getDefaultModel).mockReturnValue(mockModelConfig);

			const result = getCurrentModel();

			expect(result).toEqual(mockModelConfig);
		});

		it("should return default model when currentModel is empty", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("");
			vi.mocked(modelsModule.getDefaultModel).mockReturnValue(mockModelConfig);

			const result = getCurrentModel();

			expect(result).toEqual(mockModelConfig);
		});

		it("should return null when no model is available", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("");
			vi.mocked(modelsModule.getDefaultModel).mockReturnValue(null);

			const result = getCurrentModel();

			expect(result).toBeNull();
		});
	});

	describe("getApiConfig", () => {
		it("should return api config when model exists", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("test-model");
			vi.mocked(modelsModule.getModelById).mockReturnValue(mockModelConfig);
			vi.mocked(configModule.getModelApiConfig).mockReturnValue({
				baseUrl: "https://api.test.com",
				apiKey: "test-key",
				model: "test-model",
				protocol: "openai" as const,
			});

			const result = getApiConfig();

			expect(result).toEqual({
				baseUrl: "https://api.test.com",
				apiKey: "test-key",
			});
		});

		it("should return empty values when no model", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("");
			vi.mocked(modelsModule.getDefaultModel).mockReturnValue(null);

			const result = getApiConfig();

			expect(result).toEqual({ baseUrl: "" });
		});

		it("should return empty values when api config not found", () => {
			vi.mocked(configModule.getCurrentModelId).mockReturnValue("test-model");
			vi.mocked(modelsModule.getModelById).mockReturnValue(mockModelConfig);
			vi.mocked(configModule.getModelApiConfig).mockReturnValue(null);

			const result = getApiConfig();

			expect(result).toEqual({ baseUrl: "" });
		});
	});

	describe("getModelApiConfig", () => {
		it("should return full api config", () => {
			vi.mocked(configModule.getModelApiConfig).mockReturnValue({
				baseUrl: "https://api.test.com",
				apiKey: "test-key",
				model: "test-model",
				protocol: "openai" as const,
			});

			const result = getModelApiConfig(mockModelConfig);

			expect(result).toEqual({
				baseUrl: "https://api.test.com",
				apiKey: "test-key",
				apiModel: "test-model",
				protocol: "openai",
			});
		});

		it("should return null when config not found", () => {
			vi.mocked(configModule.getModelApiConfig).mockReturnValue(null);

			const result = getModelApiConfig(mockModelConfig);

			expect(result).toBeNull();
		});
	});

	describe("isApiConfigValid", () => {
		it("should delegate to config module", () => {
			vi.mocked(configModule.isApiConfigValid).mockReturnValue(true);

			expect(isApiConfigValid()).toBe(true);

			vi.mocked(configModule.isApiConfigValid).mockReturnValue(false);

			expect(isApiConfigValid()).toBe(false);
		});
	});
});
