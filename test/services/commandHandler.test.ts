import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../source/constants/commands.js", () => ({
	SLASH_COMMANDS: [
		{
			name: "exit",
			description: "Exit the app",
			action: { type: "internal", handler: "exit" },
		},
		{
			name: "model",
			description: "Select model",
			children: [
				{
					name: "test-model",
					description: "Test model",
					action: { type: "internal", handler: "model_select" },
				},
			],
		},
		{
			name: "language",
			children: [
				{
					name: "en",
					description: "English",
					action: { type: "internal", handler: "language_en" },
				},
				{
					name: "zh-CN",
					description: "Chinese",
					action: { type: "internal", handler: "language_zh-CN" },
				},
			],
		},
		{
			name: "compact",
			description: "Compact",
			action: { type: "internal", handler: "compact" },
		},
		{
			name: "stop",
			description: "Stop",
			action: { type: "internal", handler: "stop" },
		},
		{
			name: "suggestion",
			children: [
				{
					name: "on",
					description: "Enable",
					action: { type: "internal", handler: "suggestion_on" },
				},
				{
					name: "off",
					description: "Disable",
					action: { type: "internal", handler: "suggestion_off" },
				},
			],
		},
		{
			name: "thinking",
			children: [
				{
					name: "on",
					description: "Enable",
					action: { type: "internal", handler: "thinking_on" },
				},
				{
					name: "off",
					description: "Disable",
					action: { type: "internal", handler: "thinking_off" },
				},
			],
		},
		{
			name: "session",
			children: [
				{
					name: "list",
					description: "List",
					action: { type: "internal", handler: "session_list" },
				},
				{
					name: "new",
					description: "New",
					action: { type: "internal", handler: "session_new" },
				},
				{
					name: "clear",
					description: "Clear",
					action: { type: "internal", handler: "session_clear" },
				},
			],
		},
		{
			name: "tools",
			children: [
				{
					name: "list",
					description: "List tools",
					action: { type: "internal", handler: "tools_list" },
				},
			],
		},
		{
			name: "no-action",
			description: "Command without action",
		},
		{
			name: "prompt-cmd",
			description: "Prompt command",
			action: { type: "prompt", template: "Test prompt" },
		},
		{
			name: "config-cmd",
			description: "Config command",
			action: { type: "config", key: "testKey" },
		},
	],
	clearCommandCache: vi.fn(),
}));

vi.mock("../../source/services/tools/registry.js", () => ({
	getToolRegistry: vi.fn(() => ({
		isDiscovered: true,
		discover: vi.fn(),
		formatToolList: vi.fn(() => "Tool list"),
		getStats: vi.fn(() => ({
			installed: 5,
			notInstalled: 2,
			byCategory: { shell: 2, ide: 1 },
		})),
	})),
}));

vi.mock("../../source/utils/config.js", () => ({
	getModelById: vi.fn((id) =>
		id === "test-model"
			? {
					model: "test-model",
					name: "Test Model",
					protocol: "openai",
					supportsTools: true,
				}
			: null,
	),
	setCurrentModelId: vi.fn(),
	setSuggestionModelId: vi.fn(),
	setSuggestionEnabled: vi.fn(),
	setThinkingEnabled: vi.fn(),
}));

vi.mock("../../source/i18n/index.js", () => ({
	t: vi.fn((key, params) => {
		if (params) {
			return `${key}: ${JSON.stringify(params)}`;
		}
		return key;
	}),
	setLocale: vi.fn(),
}));

vi.mock("../../source/services/ai/sessionStore.js", () => ({
	getSessionStore: vi.fn(() => ({
		listSessions: vi.fn(() => [
			{
				id: "session-1",
				name: "Session 1",
				updatedAt: Date.now(),
				messageCount: 5,
			},
		]),
		getActiveSessionId: vi.fn(() => "session-1"),
	})),
}));

import {
	findCommandByPath,
	getCommandAction,
	handleCommand,
	type CommandContext,
	type CommandCallbacks,
} from "../../source/services/commandHandler.js";

describe("commandHandler", () => {
	const context: CommandContext = {
		appName: "test-app",
		version: "1.0.0",
	};

	const createMockCallbacks = (): CommandCallbacks => ({
		showMessage: vi.fn(),
		sendToAI: vi.fn(),
		setConfig: vi.fn(),
		compact: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn(),
		recreateAIService: vi.fn(),
		exit: vi.fn(),
		sessionNew: vi.fn().mockResolvedValue(undefined),
		sessionSwitch: vi.fn().mockResolvedValue(undefined),
		sessionDelete: vi.fn(),
		sessionClear: vi.fn().mockResolvedValue(undefined),
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("findCommandByPath", () => {
		it("should find top-level command", () => {
			const cmd = findCommandByPath(["exit"]);
			expect(cmd).not.toBeNull();
			expect(cmd!.name).toBe("exit");
		});

		it("should find nested command", () => {
			const cmd = findCommandByPath(["language", "en"]);
			expect(cmd).not.toBeNull();
			expect(cmd!.name).toBe("en");
		});

		it("should return null for empty path", () => {
			const cmd = findCommandByPath([]);
			expect(cmd).toBeNull();
		});

		it("should return null for non-existent command", () => {
			const cmd = findCommandByPath(["nonexistent"]);
			expect(cmd).toBeNull();
		});

		it("should return null for invalid nested path", () => {
			const cmd = findCommandByPath(["exit", "invalid"]);
			expect(cmd).toBeNull();
		});
	});

	describe("getCommandAction", () => {
		it("should get action from command", () => {
			const action = getCommandAction(["exit"]);
			expect(action).not.toBeNull();
			expect(action!.type).toBe("internal");
		});

		it("should return null for command without action", () => {
			const action = getCommandAction(["no-action"]);
			expect(action).toBeNull();
		});

		it("should return null for non-existent command", () => {
			const action = getCommandAction(["nonexistent"]);
			expect(action).toBeNull();
		});
	});

	describe("handleCommand", () => {
		it("should handle exit command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["exit"], context, callbacks);

			expect(callbacks.exit).toHaveBeenCalled();
		});

		it("should handle compact command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["compact"], context, callbacks);

			expect(callbacks.compact).toHaveBeenCalled();
		});

		it("should handle stop command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["stop"], context, callbacks);

			expect(callbacks.stop).toHaveBeenCalled();
		});

		it("should handle language switch to English", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["language", "en"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle language switch to Chinese", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["language", "zh-CN"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle suggestion on command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["suggestion", "on"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle suggestion off command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["suggestion", "off"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle thinking on command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["thinking", "on"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle thinking off command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["thinking", "off"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle session list command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["session", "list"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle session new command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["session", "new"], context, callbacks);

			expect(callbacks.stop).toHaveBeenCalled();
			expect(callbacks.sessionNew).toHaveBeenCalled();
		});

		it("should handle session clear command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["session", "clear"], context, callbacks);

			expect(callbacks.stop).toHaveBeenCalled();
			expect(callbacks.sessionClear).toHaveBeenCalled();
		});

		it("should handle tools list command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["tools", "list"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle model selection", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["model", "test-model"], context, callbacks);

			expect(callbacks.recreateAIService).toHaveBeenCalled();
			expect(callbacks.showMessage).toHaveBeenCalled();
		});

		it("should handle prompt command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["prompt-cmd"], context, callbacks);

			expect(callbacks.sendToAI).toHaveBeenCalledWith("Test prompt");
		});

		it("should handle config command", async () => {
			const callbacks = createMockCallbacks();
			// Note: config-cmd needs to find its action through nested path
			// The path lookup requires exact path matching
			await handleCommand(["config-cmd"], context, callbacks);

			// Since this is a simple config command with just the root name,
			// value should be empty string (path.slice(1).join(" ") = "")
			expect(callbacks.setConfig).toHaveBeenCalledWith("testKey", "");
		});

		it("should show error for empty command", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand([], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalledWith(
				expect.stringContaining("Error"),
			);
		});

		it("should show error for command without action", async () => {
			const callbacks = createMockCallbacks();
			await handleCommand(["no-action"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalledWith(
				expect.stringContaining("Error"),
			);
		});

		it("should handle async command errors", async () => {
			const { getToolRegistry } = await import(
				"../../source/services/tools/registry.js"
			);
			vi.mocked(getToolRegistry).mockReturnValue({
				isDiscovered: false,
				discover: vi.fn().mockRejectedValue(new Error("Discovery failed")),
				formatToolList: vi.fn(),
				getStats: vi.fn(),
			} as any);

			const callbacks = createMockCallbacks();
			await handleCommand(["tools", "list"], context, callbacks);

			expect(callbacks.showMessage).toHaveBeenCalledWith(
				expect.stringContaining("Error"),
			);
		});
	});
});
