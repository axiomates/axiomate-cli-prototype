import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../../source/services/ai/tokenEstimator.js", () => ({
	estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

vi.mock("../../../source/utils/logger.js", () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

import {
	Session,
	createSession,
	type SessionConfig,
	type TokenUsage,
} from "../../../source/services/ai/session.js";

describe("Session", () => {
	const defaultConfig: SessionConfig = {
		contextWindow: 4096,
		reserveRatio: 0,
		nearLimitThreshold: 0.8,
		fullThreshold: 0.95,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create session with default values", () => {
			const session = new Session({ contextWindow: 4096 });
			const config = session.getConfig();

			expect(config.contextWindow).toBe(4096);
			expect(config.reserveRatio).toBe(0);
			expect(config.nearLimitThreshold).toBe(0.8);
			expect(config.fullThreshold).toBe(0.95);
		});

		it("should create session with custom values", () => {
			const session = new Session({
				contextWindow: 8192,
				reserveRatio: 0.2,
				nearLimitThreshold: 0.7,
				fullThreshold: 0.9,
			});
			const config = session.getConfig();

			expect(config.contextWindow).toBe(8192);
			expect(config.reserveRatio).toBe(0.2);
			expect(config.nearLimitThreshold).toBe(0.7);
			expect(config.fullThreshold).toBe(0.9);
		});
	});

	describe("setSystemPrompt", () => {
		it("should set system prompt", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("You are a helpful assistant");

			const messages = session.getMessages();
			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual({
				role: "system",
				content: "You are a helpful assistant",
			});
		});

		it("should clear system prompt when empty string", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("You are a helpful assistant");
			session.setSystemPrompt("");

			const messages = session.getMessages();
			expect(messages).toHaveLength(0);
		});
	});

	describe("addUserMessage", () => {
		it("should add user message", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");

			const messages = session.getMessages();
			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual({ role: "user", content: "Hello" });
		});

		it("should add multiple user messages", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addUserMessage("How are you?");

			const messages = session.getMessages();
			expect(messages).toHaveLength(2);
		});
	});

	describe("addAssistantMessage", () => {
		it("should add assistant message without usage", () => {
			const session = new Session(defaultConfig);
			session.addAssistantMessage({ role: "assistant", content: "Hi there!" });

			const messages = session.getMessages();
			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual({ role: "assistant", content: "Hi there!" });
		});

		it("should add assistant message with usage", () => {
			const session = new Session(defaultConfig);
			const usage: TokenUsage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			};
			session.addAssistantMessage(
				{ role: "assistant", content: "Response" },
				usage,
			);

			const status = session.getStatus();
			expect(status.usedTokens).toBe(150);
		});
	});

	describe("addToolMessage", () => {
		it("should add tool message", () => {
			const session = new Session(defaultConfig);
			session.addToolMessage({
				role: "tool",
				content: "Tool result",
				tool_call_id: "call_123",
			});

			const messages = session.getMessages();
			expect(messages).toHaveLength(1);
			expect(messages[0]).toEqual({
				role: "tool",
				content: "Tool result",
				tool_call_id: "call_123",
			});
		});
	});

	describe("getUsedTokens", () => {
		it("should return estimated tokens when no actual usage", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello world"); // ~3 tokens (11 chars / 4)

			const usedTokens = session.getUsedTokens();
			expect(usedTokens).toBeGreaterThan(0);
		});

		it("should return actual tokens when usage provided", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage(
				{ role: "assistant", content: "Hi" },
				{ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			);

			expect(session.getUsedTokens()).toBe(15);
		});
	});

	describe("getAvailableTokens", () => {
		it("should return full context window when empty", () => {
			const session = new Session(defaultConfig);
			expect(session.getAvailableTokens()).toBe(4096);
		});

		it("should subtract used tokens", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage(
				{ role: "assistant", content: "Hi" },
				{ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
			);

			expect(session.getAvailableTokens()).toBe(4096 - 150);
		});

		it("should account for reserve ratio", () => {
			const session = new Session({
				contextWindow: 4096,
				reserveRatio: 0.25,
			});

			expect(session.getAvailableTokens()).toBe(4096 - 1024);
		});
	});

	describe("getStatus", () => {
		it("should return correct initial status", () => {
			const session = new Session(defaultConfig);
			const status = session.getStatus();

			expect(status.usedTokens).toBe(0);
			expect(status.availableTokens).toBe(4096);
			expect(status.usagePercent).toBe(0);
			expect(status.isNearLimit).toBe(false);
			expect(status.isFull).toBe(false);
			expect(status.messageCount).toBe(0);
		});

		it("should indicate near limit when threshold reached", () => {
			const session = new Session(defaultConfig);
			// Add messages to reach 80%+ usage
			session.addUserMessage("Hello");
			session.addAssistantMessage(
				{ role: "assistant", content: "Hi" },
				{ prompt_tokens: 3500, completion_tokens: 0, total_tokens: 3500 },
			);

			const status = session.getStatus();
			expect(status.isNearLimit).toBe(true);
		});

		it("should indicate full when threshold reached", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage(
				{ role: "assistant", content: "Hi" },
				{ prompt_tokens: 3900, completion_tokens: 0, total_tokens: 3900 },
			);

			const status = session.getStatus();
			expect(status.isFull).toBe(true);
		});
	});

	describe("getMessages", () => {
		it("should return messages with system prompt first", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("System prompt");
			session.addUserMessage("User message");
			session.addAssistantMessage({
				role: "assistant",
				content: "Assistant message",
			});

			const messages = session.getMessages();
			expect(messages).toHaveLength(3);
			expect(messages[0]!.role).toBe("system");
			expect(messages[1]!.role).toBe("user");
			expect(messages[2]!.role).toBe("assistant");
		});
	});

	describe("getHistory", () => {
		it("should return messages without system prompt", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("System prompt");
			session.addUserMessage("User message");

			const history = session.getHistory();
			expect(history).toHaveLength(1);
			expect(history[0]!.role).toBe("user");
		});
	});

	describe("clear", () => {
		it("should clear all messages including system prompt", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("System");
			session.addUserMessage("User");
			session.addAssistantMessage({ role: "assistant", content: "Assistant" });

			session.clear();

			const messages = session.getMessages();
			expect(messages).toHaveLength(0);
		});
	});

	describe("shouldCompact", () => {
		it("should not compact when usage is low", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage({ role: "assistant", content: "Hi" });

			const result = session.shouldCompact(0, 0.85);
			expect(result.shouldCompact).toBe(false);
		});

		it("should not compact when only one message", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");

			const result = session.shouldCompact(4000, 0.85);
			expect(result.shouldCompact).toBe(false);
			expect(result.realMessageCount).toBe(1);
		});

		it("should compact when projected usage exceeds threshold", () => {
			const session = new Session({ contextWindow: 100 });
			// 4条消息 ~每条4 tokens (14 chars / 4)
			session.addUserMessage("User message 1"); // ~4 tokens
			session.addAssistantMessage({
				role: "assistant",
				content: "Response 1",
			}); // ~3 tokens
			session.addUserMessage("User message 2"); // ~4 tokens
			session.addAssistantMessage({
				role: "assistant",
				content: "Response 2",
			}); // ~3 tokens
			// Total ~14 tokens

			// 要使 projected 超过 85%，需要 (14 + X) / 100 >= 85%
			// 14 + X >= 85 -> X >= 71
			const result = session.shouldCompact(75, 0.85);
			expect(result.shouldCompact).toBe(true);
			expect(result.realMessageCount).toBe(4);
		});

		it("should indicate context full", () => {
			const session = new Session({ contextWindow: 100 });
			session.addUserMessage("Hello");
			session.addAssistantMessage({ role: "assistant", content: "Hi" });

			const result = session.shouldCompact(200);
			expect(result.isContextFull).toBe(true);
		});
	});

	describe("compactWith", () => {
		it("should replace all messages with summary", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Message 1");
			session.addAssistantMessage({ role: "assistant", content: "Response 1" });
			session.addUserMessage("Message 2");
			session.addAssistantMessage({ role: "assistant", content: "Response 2" });

			session.compactWith("This is a summary of the conversation");

			const messages = session.getMessages();
			expect(messages).toHaveLength(1);
			expect(messages[0]!.role).toBe("assistant");
			expect(messages[0]!.content).toContain("[Previous conversation summary]");
			expect(messages[0]!.content).toContain(
				"This is a summary of the conversation",
			);
		});
	});

	describe("updateContextWindow", () => {
		it("should update context window", () => {
			const session = new Session(defaultConfig);
			session.updateContextWindow(8192);

			const config = session.getConfig();
			expect(config.contextWindow).toBe(8192);
		});
	});

	describe("checkpoint and rollback", () => {
		it("should create checkpoint", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Message 1");
			session.addAssistantMessage({ role: "assistant", content: "Response 1" });

			const checkpoint = session.checkpoint();
			expect(checkpoint.messageCount).toBe(2);
		});

		it("should rollback to checkpoint", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Message 1");
			session.addAssistantMessage({ role: "assistant", content: "Response 1" });

			const checkpoint = session.checkpoint();

			session.addUserMessage("Message 2");
			session.addAssistantMessage({ role: "assistant", content: "Response 2" });

			expect(session.getStatus().messageCount).toBe(4);

			session.rollback(checkpoint);

			expect(session.getStatus().messageCount).toBe(2);
		});
	});

	describe("validateMessages", () => {
		it("should validate valid message sequence", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage({
				role: "assistant",
				content: "Let me check",
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } },
				],
			});
			session.addToolMessage({
				role: "tool",
				content: "Result",
				tool_call_id: "call_1",
			});
			session.addAssistantMessage({ role: "assistant", content: "Done" });

			const result = session.validateMessages();
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should detect orphan tool_call", () => {
			const session = new Session(defaultConfig);
			session.addAssistantMessage({
				role: "assistant",
				content: "Calling tool",
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } },
				],
			});
			// No tool result

			const result = session.validateMessages();
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Orphan tool_call"))).toBe(
				true,
			);
		});

		it("should detect orphan tool result", () => {
			const session = new Session(defaultConfig);
			session.addToolMessage({
				role: "tool",
				content: "Result",
				tool_call_id: "call_nonexistent",
			});

			const result = session.validateMessages();
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("Orphan tool result"))).toBe(
				true,
			);
		});
	});

	describe("repairMessages", () => {
		it("should return 0 when no repair needed", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addAssistantMessage({ role: "assistant", content: "Hi" });

			const removed = session.repairMessages();
			expect(removed).toBe(0);
		});

		it("should remove orphan tool results", () => {
			const session = new Session(defaultConfig);
			session.addUserMessage("Hello");
			session.addToolMessage({
				role: "tool",
				content: "Orphan result",
				tool_call_id: "call_nonexistent",
			});

			const removed = session.repairMessages();
			expect(removed).toBe(1);
			expect(session.getStatus().messageCount).toBe(1);
		});

		it("should clean up orphan tool_calls", () => {
			const session = new Session(defaultConfig);
			session.addAssistantMessage({
				role: "assistant",
				content: "Calling",
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } },
				],
			});

			session.repairMessages();

			const messages = session.getMessages();
			const assistantMsg = messages[0];
			expect(assistantMsg?.tool_calls).toBeUndefined();
		});

		it("should keep tool_calls with matching tool results", () => {
			const session = new Session(defaultConfig);
			session.addAssistantMessage({
				role: "assistant",
				content: "Calling",
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } },
				],
			});
			session.addToolMessage({
				role: "tool",
				content: "Tool result",
				tool_call_id: "call_1",
			});

			const removed = session.repairMessages();
			expect(removed).toBe(0);

			const messages = session.getMessages();
			const assistantMsg = messages[0];
			expect(assistantMsg?.tool_calls).toHaveLength(1);
		});

		it("should remove only orphan tool_calls and keep valid ones", () => {
			const session = new Session(defaultConfig);
			session.addAssistantMessage({
				role: "assistant",
				content: "Calling two",
				tool_calls: [
					{ id: "call_1", type: "function", function: { name: "test1", arguments: "{}" } },
					{ id: "call_2", type: "function", function: { name: "test2", arguments: "{}" } },
				],
			});
			// Only provide result for call_1, not call_2
			session.addToolMessage({
				role: "tool",
				content: "Result 1",
				tool_call_id: "call_1",
			});

			const removed = session.repairMessages();
			expect(removed).toBe(0); // No messages removed, just tool_calls cleaned

			const messages = session.getMessages();
			const assistantMsg = messages[0];
			// Only call_1 should remain
			expect(assistantMsg?.tool_calls).toHaveLength(1);
			expect(assistantMsg?.tool_calls?.[0]?.id).toBe("call_1");
		});
	});

	describe("getInternalState and restoreFromState", () => {
		it("should serialize and restore state", () => {
			const session = new Session(defaultConfig);
			session.setSystemPrompt("System");
			session.addUserMessage("Hello");
			session.addAssistantMessage(
				{ role: "assistant", content: "Hi" },
				{ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
			);

			const state = session.getInternalState();

			const newSession = new Session(defaultConfig);
			newSession.restoreFromState(state);

			expect(newSession.getStatus().messageCount).toBe(2);
			expect(newSession.getMessages()).toHaveLength(3); // Including system
		});
	});

	describe("createSession", () => {
		it("should create session instance", () => {
			const session = createSession({ contextWindow: 4096 });
			expect(session).toBeInstanceOf(Session);
		});
	});
});
