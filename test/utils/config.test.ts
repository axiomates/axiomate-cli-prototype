import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Mock fs and os modules before importing config
vi.mock("node:fs");
vi.mock("node:os");

// 重置模块以清除单例状态
async function resetConfigModule() {
	vi.resetModules();
	const configModule = await import("../../source/utils/config.js");
	return configModule;
}

describe("config", () => {
	const mockHomeDir = "/mock/home";
	const configPath = path.join(mockHomeDir, ".axiomate.json");

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
	});

	describe("getConfigPath", () => {
		it("should return config path in home directory", async () => {
			const { getConfigPath } = await resetConfigModule();
			const result = getConfigPath();
			expect(result).toBe(configPath);
		});
	});

	describe("getConfig", () => {
		it("should return default config when file does not exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getConfig } = await resetConfigModule();
			const config = getConfig();

			expect(config.models).toEqual({});
			expect(config.currentModel).toBe("");
			expect(config.suggestionModel).toBe("");
		});

		it("should return config from file when it exists", async () => {
			const fileConfig = {
				models: {
					"test-model": {
						model: "test-model",
						name: "Test",
						protocol: "openai",
						supportsTools: true,
						supportsThinking: false,
						contextWindow: 4096,
						baseUrl: "https://api.test.com",
						apiKey: "test-key",
					},
				},
				currentModel: "test-model",
				suggestionModel: "test-model",
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileConfig));

			const { getConfig } = await resetConfigModule();
			const config = getConfig();

			expect(config.currentModel).toBe("test-model");
			expect(config.models["test-model"]).toBeDefined();
		});

		it("should handle invalid JSON in config file", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json");
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getConfig } = await resetConfigModule();
			const config = getConfig();

			expect(config.models).toEqual({});
		});

		it("should handle array config (invalid)", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("[]");
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getConfig } = await resetConfigModule();
			const config = getConfig();

			expect(config.models).toEqual({});
		});

		it("should handle null config (invalid)", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("null");
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getConfig } = await resetConfigModule();
			const config = getConfig();

			expect(config.models).toEqual({});
		});
	});

	describe("updateConfig", () => {
		it("should update and save config", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { updateConfig, getConfig } = await resetConfigModule();

			updateConfig({ currentModel: "new-model" });
			const config = getConfig();

			expect(config.currentModel).toBe("new-model");
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("initConfig", () => {
		it("should initialize config from file", async () => {
			const fileConfig = {
				currentModel: "init-model",
				suggestionModel: "suggest-model",
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileConfig));

			const { initConfig } = await resetConfigModule();
			const config = initConfig();

			expect(config.currentModel).toBe("init-model");
			expect(config.suggestionModel).toBe("suggest-model");
		});
	});

	describe("isFirstTimeUser", () => {
		it("should return true when config file does not exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when config is not valid JSON", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when config is an array", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("[]");

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when config is null", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("null");

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when models is empty", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: {},
					currentModel: "test",
					suggestionModel: "test",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when currentModel is missing", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { test: {} },
					suggestionModel: "test",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when currentModel is empty string", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { test: {} },
					currentModel: "",
					suggestionModel: "test",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when currentModel not in models", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { other: {} },
					currentModel: "test",
					suggestionModel: "other",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when suggestionModel is missing", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { test: {} },
					currentModel: "test",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return true when suggestionModel not in models", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { test: {} },
					currentModel: "test",
					suggestionModel: "other",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(true);
		});

		it("should return false when config is complete", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					models: { "test-model": {} },
					currentModel: "test-model",
					suggestionModel: "test-model",
				}),
			);

			const { isFirstTimeUser } = await resetConfigModule();
			expect(isFirstTimeUser()).toBe(false);
		});
	});

	describe("model accessors", () => {
		it("should get and set current model id", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getCurrentModelId, setCurrentModelId } =
				await resetConfigModule();

			expect(getCurrentModelId()).toBe("");

			setCurrentModelId("new-model");
			expect(getCurrentModelId()).toBe("new-model");
		});

		it("should get all models", async () => {
			const models = {
				model1: { model: "model1", name: "Model 1" },
				model2: { model: "model2", name: "Model 2" },
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ models }));

			const { getAllModels } = await resetConfigModule();
			const result = getAllModels();

			expect(result).toHaveLength(2);
		});

		it("should get model by id", async () => {
			const models = {
				model1: { model: "model1", name: "Model 1" },
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ models }));

			const { getModelById } = await resetConfigModule();

			expect(getModelById("model1")).toBeDefined();
			expect(getModelById("nonexistent")).toBeUndefined();
		});
	});

	describe("getModelApiConfig", () => {
		it("should return api config when model exists", async () => {
			const models = {
				model1: {
					model: "model1",
					name: "Model 1",
					protocol: "openai",
					baseUrl: "https://api.test.com",
					apiKey: "test-key",
				},
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ models }));

			const { getModelApiConfig } = await resetConfigModule();
			const config = getModelApiConfig("model1");

			expect(config).toEqual({
				baseUrl: "https://api.test.com",
				apiKey: "test-key",
				model: "model1",
				protocol: "openai",
			});
		});

		it("should return null when model does not exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getModelApiConfig } = await resetConfigModule();
			const config = getModelApiConfig("nonexistent");

			expect(config).toBeNull();
		});

		it("should return null when model lacks api config", async () => {
			const models = {
				model1: { model: "model1", name: "Model 1" },
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ models }));

			const { getModelApiConfig } = await resetConfigModule();
			const config = getModelApiConfig("model1");

			expect(config).toBeNull();
		});
	});

	describe("isApiConfigValid", () => {
		it("should return false when no current model", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { isApiConfigValid } = await resetConfigModule();
			expect(isApiConfigValid()).toBe(false);
		});

		it("should return true when current model has valid config", async () => {
			const config = {
				models: {
					model1: {
						model: "model1",
						baseUrl: "https://api.test.com",
						apiKey: "test-key",
						protocol: "openai",
					},
				},
				currentModel: "model1",
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { isApiConfigValid } = await resetConfigModule();
			expect(isApiConfigValid()).toBe(true);
		});
	});

	describe("suggestion model accessors", () => {
		it("should get and set suggestion model id", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getSuggestionModelId, setSuggestionModelId } =
				await resetConfigModule();

			expect(getSuggestionModelId()).toBe("");

			setSuggestionModelId("suggestion-model");
			expect(getSuggestionModelId()).toBe("suggestion-model");
		});
	});

	describe("suggestion enabled", () => {
		it("should return true by default", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { isSuggestionEnabled } = await resetConfigModule();
			expect(isSuggestionEnabled()).toBe(true);
		});

		it("should return false when explicitly disabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					suggestionEnabled: false,
				}),
			);

			const { isSuggestionEnabled } = await resetConfigModule();
			expect(isSuggestionEnabled()).toBe(false);
		});

		it("should set suggestion enabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { setSuggestionEnabled, isSuggestionEnabled } =
				await resetConfigModule();

			setSuggestionEnabled(false);
			expect(isSuggestionEnabled()).toBe(false);

			setSuggestionEnabled(true);
			expect(isSuggestionEnabled()).toBe(true);
		});
	});

	describe("thinking enabled", () => {
		it("should return false by default", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { isThinkingEnabled } = await resetConfigModule();
			expect(isThinkingEnabled()).toBe(false);
		});

		it("should return true when explicitly enabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					thinkingEnabled: true,
				}),
			);

			const { isThinkingEnabled } = await resetConfigModule();
			expect(isThinkingEnabled()).toBe(true);
		});

		it("should set thinking enabled", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { setThinkingEnabled, isThinkingEnabled } =
				await resetConfigModule();

			setThinkingEnabled(true);
			expect(isThinkingEnabled()).toBe(true);
		});
	});

	describe("currentModelSupportsThinking", () => {
		it("should return false when no current model", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { currentModelSupportsThinking } = await resetConfigModule();
			expect(currentModelSupportsThinking()).toBe(false);
		});

		it("should return true when model supports thinking", async () => {
			const config = {
				models: {
					"thinking-model": {
						model: "thinking-model",
						supportsThinking: true,
					},
				},
				currentModel: "thinking-model",
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { currentModelSupportsThinking } = await resetConfigModule();
			expect(currentModelSupportsThinking()).toBe(true);
		});

		it("should return false when model does not support thinking", async () => {
			const config = {
				models: {
					"normal-model": {
						model: "normal-model",
						supportsThinking: false,
					},
				},
				currentModel: "normal-model",
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { currentModelSupportsThinking } = await resetConfigModule();
			expect(currentModelSupportsThinking()).toBe(false);
		});
	});

	describe("getThinkingParams", () => {
		it("should return null when no current model", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getThinkingParams } = await resetConfigModule();
			expect(getThinkingParams()).toBeNull();
		});

		it("should return null when model has no thinkingParams", async () => {
			const config = {
				models: {
					"no-params-model": {
						model: "no-params-model",
						supportsThinking: true,
						// 没有 thinkingParams 表示 API 不支持 thinking 参数
					},
				},
				currentModel: "no-params-model",
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getThinkingParams } = await resetConfigModule();
			expect(getThinkingParams()).toBeNull();
		});

		it("should return enabled params when thinking is enabled and model supports it", async () => {
			const config = {
				models: {
					"thinking-model": {
						model: "thinking-model",
						supportsThinking: true,
						thinkingParams: {
							enabled: { enable_thinking: true },
							disabled: { enable_thinking: false },
						},
					},
				},
				currentModel: "thinking-model",
				thinkingEnabled: true,
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getThinkingParams } = await resetConfigModule();
			expect(getThinkingParams()).toEqual({ enable_thinking: true });
		});

		it("should return disabled params when thinking is enabled but model does not support it", async () => {
			const config = {
				models: {
					"no-thinking-model": {
						model: "no-thinking-model",
						supportsThinking: false,
						thinkingParams: {
							// enabled 可选，supportsThinking: false 的模型不需要配置
							disabled: { enable_thinking: false },
						},
					},
				},
				currentModel: "no-thinking-model",
				thinkingEnabled: true,
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getThinkingParams } = await resetConfigModule();
			expect(getThinkingParams()).toEqual({ enable_thinking: false });
		});

		it("should return disabled params when thinking is disabled", async () => {
			const config = {
				models: {
					"thinking-model": {
						model: "thinking-model",
						supportsThinking: true,
						thinkingParams: {
							enabled: { enable_thinking: true },
							disabled: { enable_thinking: false },
						},
					},
				},
				currentModel: "thinking-model",
				thinkingEnabled: false,
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getThinkingParams } = await resetConfigModule();
			expect(getThinkingParams()).toEqual({ enable_thinking: false });
		});
	});

	describe("getSuggestionThinkingParams", () => {
		it("should return null when model has no thinkingParams", async () => {
			const config = {
				models: {
					"suggestion-model": {
						model: "suggestion-model",
						supportsThinking: true,
						// 没有 thinkingParams 表示 API 不支持 thinking 参数
					},
				},
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getSuggestionThinkingParams } = await resetConfigModule();
			expect(getSuggestionThinkingParams("suggestion-model")).toBeNull();
		});

		it("should always return disabled params for suggestion models", async () => {
			const config = {
				models: {
					"suggestion-model": {
						model: "suggestion-model",
						supportsThinking: true,
						thinkingParams: {
							enabled: { thinking_budget: 1000 },
							disabled: { thinking_budget: 0 },
						},
					},
				},
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

			const { getSuggestionThinkingParams } = await resetConfigModule();
			// Suggestion always uses disabled params, regardless of user settings
			expect(getSuggestionThinkingParams("suggestion-model")).toEqual({
				thinking_budget: 0,
			});
		});

		it("should return null when model does not exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

			const { getSuggestionThinkingParams } = await resetConfigModule();
			expect(getSuggestionThinkingParams("non-existent-model")).toBeNull();
		});
	});
});
