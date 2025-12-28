import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../source/utils/config.js", () => ({
	getAllModels: vi.fn(() => [
		{ model: "model1", name: "Model 1", description: "First model" },
		{ model: "model2", name: "Model 2", description: "" },
	]),
	getCurrentModelId: vi.fn(() => "model1"),
	getModelById: vi.fn((id) => {
		if (id === "model1") return { model: "model1", name: "Model 1" };
		if (id === "model2") return { model: "model2", name: "Model 2" };
		return null;
	}),
	isThinkingEnabled: vi.fn(() => false),
	isSuggestionEnabled: vi.fn(() => true),
	getSuggestionModelId: vi.fn(() => "model2"),
}));

vi.mock("../../source/i18n/index.js", () => ({
	t: vi.fn((key) => key),
	addLocaleChangeListener: vi.fn(),
}));

vi.mock("../../source/services/ai/sessionStore.js", () => ({
	getSessionStore: vi.fn(() => ({
		getActiveSession: vi.fn(() => ({ name: "Current Session" })),
		listSessions: vi.fn(() => [
			{ id: "session1", name: "Session 1", messageCount: 5 },
			{ id: "session2", name: "Session 2", messageCount: 10 },
		]),
		getActiveSessionId: vi.fn(() => "session1"),
	})),
}));

import {
	getSlashCommands,
	clearCommandCache,
	SLASH_COMMANDS,
} from "../../source/constants/commands.js";
import {
	isThinkingEnabled,
	isSuggestionEnabled,
	getCurrentModelId,
} from "../../source/utils/config.js";
import { getSessionStore } from "../../source/services/ai/sessionStore.js";

describe("commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearCommandCache();
	});

	describe("getSlashCommands", () => {
		it("should return array of commands", () => {
			const commands = getSlashCommands();

			expect(Array.isArray(commands)).toBe(true);
			expect(commands.length).toBeGreaterThan(0);
		});

		it("should include model command", () => {
			const commands = getSlashCommands();
			const modelCmd = commands.find((c) => c.name === "model");

			expect(modelCmd).toBeDefined();
			expect(modelCmd!.children).toBeDefined();
			expect(modelCmd!.description).toContain("Model 1");
		});

		it("should include model children with current model marked", () => {
			const commands = getSlashCommands();
			const modelCmd = commands.find((c) => c.name === "model");

			const model1Child = modelCmd!.children!.find((c) => c.name === "model1");
			expect(model1Child!.prefix).toBe("▸ ");
		});

		it("should include thinking command", () => {
			const commands = getSlashCommands();
			const thinkingCmd = commands.find((c) => c.name === "thinking");

			expect(thinkingCmd).toBeDefined();
			expect(thinkingCmd!.children).toHaveLength(2);
		});

		it("should mark correct thinking status", () => {
			vi.mocked(isThinkingEnabled).mockReturnValue(true);
			clearCommandCache();

			const commands = getSlashCommands();
			const thinkingCmd = commands.find((c) => c.name === "thinking");
			const onChild = thinkingCmd!.children!.find((c) => c.name === "on");

			expect(onChild!.prefix).toBe("▸ ");
		});

		it("should include session command", () => {
			const commands = getSlashCommands();
			const sessionCmd = commands.find((c) => c.name === "session");

			expect(sessionCmd).toBeDefined();
			expect(sessionCmd!.description).toContain("Current Session");
		});

		it("should generate session switch commands", () => {
			const commands = getSlashCommands();
			const sessionCmd = commands.find((c) => c.name === "session");
			const switchCmd = sessionCmd!.children!.find((c) => c.name === "switch");

			// Should only include non-active sessions
			expect(switchCmd!.children).toHaveLength(1);
			expect(switchCmd!.children![0]!.name).toBe("Session 2");
		});

		it("should include compact command", () => {
			const commands = getSlashCommands();
			const compactCmd = commands.find((c) => c.name === "compact");

			expect(compactCmd).toBeDefined();
			expect(compactCmd!.action).toEqual({
				type: "internal",
				handler: "compact",
			});
		});

		it("should include stop command", () => {
			const commands = getSlashCommands();
			const stopCmd = commands.find((c) => c.name === "stop");

			expect(stopCmd).toBeDefined();
		});

		it("should include tools command with children", () => {
			const commands = getSlashCommands();
			const toolsCmd = commands.find((c) => c.name === "tools");

			expect(toolsCmd).toBeDefined();
			expect(toolsCmd!.children).toHaveLength(3);
		});

		it("should include suggestion command", () => {
			const commands = getSlashCommands();
			const suggestionCmd = commands.find((c) => c.name === "suggestion");

			expect(suggestionCmd).toBeDefined();
			expect(suggestionCmd!.description).toContain("common.on");
		});

		it("should mark correct suggestion status", () => {
			vi.mocked(isSuggestionEnabled).mockReturnValue(false);
			clearCommandCache();

			const commands = getSlashCommands();
			const suggestionCmd = commands.find((c) => c.name === "suggestion");
			const offChild = suggestionCmd!.children!.find((c) => c.name === "off");

			expect(offChild!.prefix).toBe("▸ ");
		});

		it("should include language command with children", () => {
			const commands = getSlashCommands();
			const langCmd = commands.find((c) => c.name === "language");

			expect(langCmd).toBeDefined();
			expect(langCmd!.children).toHaveLength(3);
			expect(langCmd!.children!.map((c) => c.name)).toContain("en");
			expect(langCmd!.children!.map((c) => c.name)).toContain("zh-CN");
			expect(langCmd!.children!.map((c) => c.name)).toContain("ja");
		});

		it("should include exit command", () => {
			const commands = getSlashCommands();
			const exitCmd = commands.find((c) => c.name === "exit");

			expect(exitCmd).toBeDefined();
			expect(exitCmd!.action).toEqual({
				type: "internal",
				handler: "exit",
			});
		});

		it("should handle null session store", () => {
			vi.mocked(getSessionStore).mockReturnValue(null);
			clearCommandCache();

			const commands = getSlashCommands();
			const sessionCmd = commands.find((c) => c.name === "session");

			expect(sessionCmd).toBeDefined();
			expect(sessionCmd!.description).not.toContain("[");
		});

		it("should handle null current model", () => {
			vi.mocked(getCurrentModelId).mockReturnValue("");
			clearCommandCache();

			const commands = getSlashCommands();
			const modelCmd = commands.find((c) => c.name === "model");

			expect(modelCmd!.description).not.toContain("[");
		});
	});

	describe("clearCommandCache", () => {
		it("should regenerate commands with updated values after clearing cache", () => {
			// First call - thinking is off
			vi.mocked(isThinkingEnabled).mockReturnValue(false);
			clearCommandCache();
			const commands1 = getSlashCommands();
			const thinking1 = commands1.find((c) => c.name === "thinking");
			expect(thinking1!.description).toContain("common.off");

			// Change mock return value
			vi.mocked(isThinkingEnabled).mockReturnValue(true);

			// Clear cache and regenerate
			clearCommandCache();
			const commands2 = getSlashCommands();
			const thinking2 = commands2.find((c) => c.name === "thinking");
			expect(thinking2!.description).toContain("common.on");
		});
	});

	describe("SLASH_COMMANDS proxy", () => {
		it("should return commands through proxy", () => {
			expect(SLASH_COMMANDS.length).toBeGreaterThan(0);
		});

		it("should support array methods through proxy", () => {
			const modelCmd = SLASH_COMMANDS.find((c) => c.name === "model");
			expect(modelCmd).toBeDefined();
		});

		it("should support 'in' operator through proxy", () => {
			expect(0 in SLASH_COMMANDS).toBe(true);
		});

		it("should support Object.keys through proxy (ownKeys)", () => {
			const keys = Object.keys(SLASH_COMMANDS);
			expect(keys.length).toBeGreaterThan(0);
			expect(keys).toContain("0");
		});

		it("should support Object.getOwnPropertyDescriptor through proxy", () => {
			const descriptor = Object.getOwnPropertyDescriptor(SLASH_COMMANDS, "0");
			expect(descriptor).toBeDefined();
			expect(descriptor!.value).toBeDefined();
		});

		it("should support spread operator through proxy", () => {
			const spread = [...SLASH_COMMANDS];
			expect(spread.length).toBeGreaterThan(0);
			expect(spread[0]).toHaveProperty("name");
		});
	});
});
