import { describe, it, expect, beforeAll } from "vitest";
import {
	groupMessages,
	countGroupLines,
	generateGroupHeaderParts,
	canCollapse,
	type MessageGroup,
} from "../../source/models/messageGroup.js";
import type { Message } from "../../source/components/MessageOutput.js";
import { initI18n, setLocale } from "../../source/i18n/index.js";

// 初始化 i18n 并设置为中文
beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

describe("messageGroup", () => {
	describe("groupMessages", () => {
		it("should return empty array for empty messages", () => {
			const groups = groupMessages([]);
			expect(groups).toEqual([]);
		});

		it("should create single group for one user message", () => {
			const messages: Message[] = [{ content: "Hello", type: "user" }];
			const groups = groupMessages(messages);

			expect(groups).toHaveLength(1);
			expect(groups[0]!.id).toBe("group-0");
			expect(groups[0]!.userMessage?.content).toBe("Hello");
			expect(groups[0]!.responses).toHaveLength(0);
			expect(groups[0]!.isLast).toBe(true);
		});

		it("should group user message with following responses", () => {
			const messages: Message[] = [
				{ content: "Hello", type: "user" },
				{ content: "Hi there!" },
				{ content: "How can I help?", type: "system" },
			];
			const groups = groupMessages(messages);

			expect(groups).toHaveLength(1);
			expect(groups[0]!.userMessage?.content).toBe("Hello");
			expect(groups[0]!.responses).toHaveLength(2);
			expect(groups[0]!.responses[0]!.content).toBe("Hi there!");
			expect(groups[0]!.responses[1]!.content).toBe("How can I help?");
		});

		it("should create multiple groups for multiple user messages", () => {
			const messages: Message[] = [
				{ content: "First question", type: "user" },
				{ content: "First answer" },
				{ content: "Second question", type: "user" },
				{ content: "Second answer" },
			];
			const groups = groupMessages(messages);

			expect(groups).toHaveLength(2);
			expect(groups[0]!.userMessage?.content).toBe("First question");
			expect(groups[0]!.responses[0]!.content).toBe("First answer");
			expect(groups[0]!.isLast).toBe(false);

			expect(groups[1]!.userMessage?.content).toBe("Second question");
			expect(groups[1]!.responses[0]!.content).toBe("Second answer");
			expect(groups[1]!.isLast).toBe(true);
		});

		it("should handle system messages without user message", () => {
			const messages: Message[] = [
				{ content: "Welcome!", type: "system" },
				{ content: "Question", type: "user" },
				{ content: "Answer" },
			];
			const groups = groupMessages(messages);

			expect(groups).toHaveLength(2);
			// First group: system message without user
			expect(groups[0]!.userMessage).toBeNull();
			expect(groups[0]!.responses[0]!.content).toBe("Welcome!");
			// Second group: user + answer
			expect(groups[1]!.userMessage?.content).toBe("Question");
		});

		it("should track streaming state in group", () => {
			const messages: Message[] = [
				{ content: "Question", type: "user" },
				{ content: "Answering...", streaming: true },
			];
			const groups = groupMessages(messages);

			expect(groups).toHaveLength(1);
			expect(groups[0]!.hasStreaming).toBe(true);
		});

		it("should set correct startIndex and endIndex", () => {
			const messages: Message[] = [
				{ content: "Q1", type: "user" },
				{ content: "A1" },
				{ content: "Q2", type: "user" },
				{ content: "A2" },
				{ content: "A2 continued" },
			];
			const groups = groupMessages(messages);

			expect(groups[0]!.startIndex).toBe(0);
			expect(groups[0]!.endIndex).toBe(2);

			expect(groups[1]!.startIndex).toBe(2);
			expect(groups[1]!.endIndex).toBe(5);
		});
	});

	describe("countGroupLines", () => {
		it("should count lines in group", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "Line 1\nLine 2", type: "user" },
				responses: [{ content: "Line 3\nLine 4\nLine 5" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(countGroupLines(group)).toBe(5);
		});

		it("should handle group without user message", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: null,
				responses: [{ content: "Single line" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(countGroupLines(group)).toBe(1);
		});
	});

	describe("generateGroupHeaderParts", () => {
		it("should show ▶ arrow when collapsed", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "What is TypeScript?", type: "user" },
				responses: [
					{ content: "TypeScript is a typed superset of JavaScript." },
				],
				isLast: false,
				hasStreaming: false,
			};

			const parts = generateGroupHeaderParts(group, 80, true);

			expect(parts.arrow).toBe("▶");
			expect(parts.userPreview).toContain("TypeScript");
			expect(parts.separator).toBe("→");
			expect(parts.responsePreview).toContain("TypeScript");
			expect(parts.lineCount).toBe("(2 行)");
		});

		it("should show ▼ arrow when expanded", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "What is TypeScript?", type: "user" },
				responses: [
					{ content: "TypeScript is a typed superset of JavaScript." },
				],
				isLast: false,
				hasStreaming: false,
			};

			const parts = generateGroupHeaderParts(group, 80, false);

			expect(parts.arrow).toBe("▼");
			expect(parts.userPreview).toContain("TypeScript");
			expect(parts.separator).toBe("→");
			expect(parts.responsePreview).toContain("TypeScript");
			expect(parts.lineCount).toBe("(2 行)");
		});

		it("should show (系统) for system message group", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: null,
				responses: [{ content: "System notification" }],
				isLast: false,
				hasStreaming: false,
			};

			const collapsedParts = generateGroupHeaderParts(group, 80, true);
			expect(collapsedParts.userPreview).toBe("(系统)");
			expect(collapsedParts.arrow).toBe("▶");

			const expandedParts = generateGroupHeaderParts(group, 80, false);
			expect(expandedParts.userPreview).toBe("(系统)");
			expect(expandedParts.arrow).toBe("▼");
		});

		it("should truncate long text", () => {
			const longText = "A".repeat(200);
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: longText, type: "user" },
				responses: [{ content: longText }],
				isLast: false,
				hasStreaming: false,
			};

			const parts = generateGroupHeaderParts(group, 80, true);
			expect(parts.userPreview.length).toBeLessThan(50);
			expect(parts.userPreview.endsWith("...")).toBe(true);
		});
	});

	describe("canCollapse", () => {
		it("should return true for last group when not streaming", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "Answer" }],
				isLast: true,
				hasStreaming: false,
			};

			// 最后一组只要不是流式生成中，也可以折叠
			expect(canCollapse(group)).toBe(true);
		});

		it("should return false for streaming group", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "...", streaming: true }],
				isLast: false,
				hasStreaming: true,
			};

			expect(canCollapse(group)).toBe(false);
		});

		it("should return false for last group when streaming", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "...", streaming: true }],
				isLast: true,
				hasStreaming: true,
			};

			expect(canCollapse(group)).toBe(false);
		});

		it("should return true for normal group", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "Answer" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(canCollapse(group)).toBe(true);
		});
	});
});
