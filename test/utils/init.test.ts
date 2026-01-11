import { describe, it, expect, vi, beforeEach } from "vitest";
import { initApp } from "../../source/utils/init.js";

// Mock registry instance shared across calls
const mockRegistry = {
	loadBuiltinTools: vi.fn().mockResolvedValue(undefined),
	discoverExternalAsync: vi.fn(),
	onDiscoveryComplete: vi.fn((callback: (tools: unknown[]) => void) => {
		// 模拟立即调用回调
		callback([]);
	}),
	freezeTools: vi.fn(),
};

// Mock dependencies
vi.mock("../../source/services/tools/registry.js", () => ({
	getToolRegistry: vi.fn(() => mockRegistry),
}));

vi.mock("../../source/services/ai/index.js", () => ({
	createAIServiceFromConfig: vi.fn(() => ({
		chat: vi.fn(),
	})),
	getCurrentModel: vi.fn(() => ({
		name: "Test Model",
		apiKey: "test-key",
	})),
}));

vi.mock("../../source/i18n/index.js", () => ({
	t: vi.fn((key: string) => key),
}));

import { getToolRegistry } from "../../source/services/tools/registry.js";
import {
	createAIServiceFromConfig,
	getCurrentModel,
} from "../../source/services/ai/index.js";

describe("init", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("initApp", () => {
		it("should initialize app and return aiService and currentModel", async () => {
			const result = await initApp();

			expect(result.aiService).toBeDefined();
			expect(result.currentModel).toBeDefined();
			expect(result.currentModel?.name).toBe("Test Model");
		});

		it("should call tool registry loadBuiltinTools and discoverExternalAsync", async () => {
			await initApp();

			expect(getToolRegistry).toHaveBeenCalled();
			const registry = getToolRegistry();
			expect(registry.loadBuiltinTools).toHaveBeenCalled();
			expect(registry.discoverExternalAsync).toHaveBeenCalled();
		});

		it("should call createAIServiceFromConfig with registry", async () => {
			await initApp();

			expect(createAIServiceFromConfig).toHaveBeenCalled();
		});

		it("should call getCurrentModel", async () => {
			await initApp();

			expect(getCurrentModel).toHaveBeenCalled();
		});

		it("should call onProgress callback with correct stages", async () => {
			const progressCallback = vi.fn();
			await initApp(progressCallback);

			expect(progressCallback).toHaveBeenCalledTimes(3);

			// First call - tools stage
			expect(progressCallback).toHaveBeenNthCalledWith(1, {
				stage: "tools",
				message: "splash.discoveringTools",
			});

			// Second call - ai stage
			expect(progressCallback).toHaveBeenNthCalledWith(2, {
				stage: "ai",
				message: "splash.loadingAI",
			});

			// Third call - done stage
			expect(progressCallback).toHaveBeenNthCalledWith(3, {
				stage: "done",
				message: "splash.loading",
			});
		});

		it("should work without onProgress callback", async () => {
			const result = await initApp();

			expect(result.aiService).toBeDefined();
			expect(result.currentModel).toBeDefined();
		});

		it("should handle null current model", async () => {
			vi.mocked(getCurrentModel).mockReturnValue(null);

			const result = await initApp();

			expect(result.currentModel).toBeNull();
		});
	});
});
