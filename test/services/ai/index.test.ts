import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	createAIClient,
	createAIServiceFromConfig,
	getCurrentModelInfo,
} from "../../../source/services/ai/index.js";
import { OpenAIClient } from "../../../source/services/ai/clients/openai.js";
import { AnthropicClient } from "../../../source/services/ai/clients/anthropic.js";
import { AIService } from "../../../source/services/ai/service.js";
import type { ModelConfig } from "../../../source/constants/models.js";
import type { IToolRegistry } from "../../../source/services/tools/types.js";

// Mock config module
vi.mock("../../../source/services/ai/config.js", () => ({
	getCurrentModel: vi.fn(),
	getModelApiConfig: vi.fn(),
	isApiConfigValid: vi.fn(),
}));

import {
	getCurrentModel,
	getModelApiConfig,
	isApiConfigValid,
} from "../../../source/services/ai/config.js";

describe("AI Service index", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createAIClient", () => {
		const baseModel: ModelConfig = {
			id: "test-model",
			name: "Test Model",
			provider: "Test Provider",
			apiProtocol: "openai",
			contextWindow: 32000,
			supportsTools: true,
			supportsThinking: false,
		};

		it("should return null if model has no API config", () => {
			vi.mocked(getModelApiConfig).mockReturnValue(null);

			const result = createAIClient(baseModel);

			expect(result).toBeNull();
		});

		it("should create OpenAI client for openai protocol", () => {
			vi.mocked(getModelApiConfig).mockReturnValue({
				protocol: "openai",
				apiKey: "test-api-key",
				baseUrl: "https://api.openai.com/v1",
				apiModel: "gpt-4",
			});

			const result = createAIClient(baseModel);

			expect(result).toBeInstanceOf(OpenAIClient);
		});

		it("should create Anthropic client for anthropic protocol", () => {
			const anthropicModel: ModelConfig = {
				...baseModel,
				apiProtocol: "anthropic",
			};

			vi.mocked(getModelApiConfig).mockReturnValue({
				protocol: "anthropic",
				apiKey: "test-api-key",
				baseUrl: "https://api.anthropic.com",
				apiModel: "claude-3-opus",
			});

			const result = createAIClient(anthropicModel);

			expect(result).toBeInstanceOf(AnthropicClient);
		});

		it("should default to OpenAI client for unknown protocol", () => {
			vi.mocked(getModelApiConfig).mockReturnValue({
				protocol: "unknown" as any,
				apiKey: "test-api-key",
				baseUrl: "https://api.example.com",
				apiModel: "some-model",
			});

			const result = createAIClient(baseModel);

			expect(result).toBeInstanceOf(OpenAIClient);
		});
	});

	describe("createAIServiceFromConfig", () => {
		const mockRegistry: IToolRegistry = {
			getTool: vi.fn(),
			getInstalledTools: vi.fn(() => []),
			discoverTools: vi.fn(async () => []),
			refresh: vi.fn(async () => []),
			getToolStats: vi.fn(() => ({
				total: 0,
				installed: 0,
				byCategory: {},
			})),
			// 两阶段冻结方法
			freezeAllTools: vi.fn(),
			freezeProjectTools: vi.fn(),
			getAllTools: vi.fn(() => []),
			getProjectTools: vi.fn(() => []),
			isAllToolsFrozen: vi.fn(() => false),
			isProjectFrozen: vi.fn(() => false),
		};

		it("should return null if API config is invalid", () => {
			vi.mocked(isApiConfigValid).mockReturnValue(false);

			const result = createAIServiceFromConfig(mockRegistry);

			expect(result).toBeNull();
		});

		it("should return null if no current model", () => {
			vi.mocked(isApiConfigValid).mockReturnValue(true);
			vi.mocked(getCurrentModel).mockReturnValue(null);

			const result = createAIServiceFromConfig(mockRegistry);

			expect(result).toBeNull();
		});

		it("should return null if createAIClient returns null", () => {
			vi.mocked(isApiConfigValid).mockReturnValue(true);
			vi.mocked(getCurrentModel).mockReturnValue({
				id: "test-model",
				name: "Test Model",
				provider: "Test",
				apiProtocol: "openai",
				contextWindow: 32000,
				supportsTools: true,
				supportsThinking: false,
			});
			vi.mocked(getModelApiConfig).mockReturnValue(null);

			const result = createAIServiceFromConfig(mockRegistry);

			expect(result).toBeNull();
		});

		it("should create AIService with correct config", () => {
			vi.mocked(isApiConfigValid).mockReturnValue(true);
			vi.mocked(getCurrentModel).mockReturnValue({
				id: "test-model",
				name: "Test Model",
				provider: "Test",
				apiProtocol: "openai",
				contextWindow: 64000,
				supportsTools: true,
				supportsThinking: false,
			});
			vi.mocked(getModelApiConfig).mockReturnValue({
				protocol: "openai",
				apiKey: "test-api-key",
				baseUrl: "https://api.openai.com/v1",
				apiModel: "gpt-4",
			});

			const result = createAIServiceFromConfig(mockRegistry);

			expect(result).toBeInstanceOf(AIService);
		});

		it("should disable context awareness for models without tool support", () => {
			vi.mocked(isApiConfigValid).mockReturnValue(true);
			vi.mocked(getCurrentModel).mockReturnValue({
				id: "simple-model",
				name: "Simple Model",
				provider: "Test",
				apiProtocol: "openai",
				contextWindow: 16000,
				supportsTools: false,
				supportsThinking: false,
			});
			vi.mocked(getModelApiConfig).mockReturnValue({
				protocol: "openai",
				apiKey: "test-api-key",
				baseUrl: "https://api.openai.com/v1",
				apiModel: "gpt-3.5-turbo",
			});

			const result = createAIServiceFromConfig(mockRegistry);

			expect(result).toBeInstanceOf(AIService);
		});
	});

	describe("getCurrentModelInfo", () => {
		it("should return model and isConfigured status", () => {
			const mockModel: ModelConfig = {
				id: "test-model",
				name: "Test Model",
				provider: "Test",
				apiProtocol: "openai",
				contextWindow: 32000,
				supportsTools: true,
				supportsThinking: false,
			};

			vi.mocked(getCurrentModel).mockReturnValue(mockModel);
			vi.mocked(isApiConfigValid).mockReturnValue(true);

			const result = getCurrentModelInfo();

			expect(result.model).toEqual(mockModel);
			expect(result.isConfigured).toBe(true);
		});

		it("should return null model when not configured", () => {
			vi.mocked(getCurrentModel).mockReturnValue(null);
			vi.mocked(isApiConfigValid).mockReturnValue(false);

			const result = getCurrentModelInfo();

			expect(result.model).toBeNull();
			expect(result.isConfigured).toBe(false);
		});

		it("should return model but not configured when API invalid", () => {
			const mockModel: ModelConfig = {
				id: "test-model",
				name: "Test Model",
				provider: "Test",
				apiProtocol: "openai",
				contextWindow: 32000,
				supportsTools: true,
				supportsThinking: false,
			};

			vi.mocked(getCurrentModel).mockReturnValue(mockModel);
			vi.mocked(isApiConfigValid).mockReturnValue(false);

			const result = getCurrentModelInfo();

			expect(result.model).toEqual(mockModel);
			expect(result.isConfigured).toBe(false);
		});
	});
});
