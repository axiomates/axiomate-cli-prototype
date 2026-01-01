import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import MessageOutput, {
	type Message,
	type AskUserQA,
} from "../../source/components/MessageOutput.js";

// Mock dependencies
vi.mock("../../source/hooks/useTerminalWidth.js", () => ({
	default: vi.fn(() => 80),
}));

vi.mock("../../source/constants/colors.js", () => ({
	THEME_PINK: "magenta",
	THEME_LIGHT_YELLOW: "yellow",
}));

vi.mock("../../source/hooks/useTranslation.js", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"messageOutput.thinking": "Thinking",
				"messageOutput.thinkingCollapsed": "Thinking (collapsed)",
				"messageOutput.askUser": "Question",
				"messageOutput.askUserCollapsed": "Question (collapsed)",
				"messageOutput.lines": "lines",
			};
			return translations[key] || key;
		},
	}),
}));

// Let actual groupMessages run to get proper structure
// vi.mock is removed to use actual implementation

describe("MessageOutput", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("rendering", () => {
		it("should render without errors when no messages", () => {
			const { lastFrame } = render(<MessageOutput messages={[]} />);
			expect(lastFrame()).toBeDefined();
		});

		it("should render without throwing for simple message", () => {
			const messages: Message[] = [
				{ content: "Hello, world!", type: "system" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should render without throwing for user message", () => {
			const messages: Message[] = [{ content: "User input", type: "user" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should render without throwing for multiple messages", () => {
			const messages: Message[] = [
				{ content: "First message", type: "system" },
				{ content: "Second message", type: "user" },
				{ content: "Third message", type: "system" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("message types", () => {
		it("should handle system messages without throwing", () => {
			const messages: Message[] = [{ content: "System output", type: "system" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle welcome messages without throwing", () => {
			const messages: Message[] = [
				{ content: "Welcome!", type: "welcome" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle user-answer messages without throwing", () => {
			const messages: Message[] = [
				{ content: "User answer", type: "user-answer" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle undefined type (defaults to system)", () => {
			const messages: Message[] = [{ content: "No type specified" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("streaming messages", () => {
		it("should render streaming message without throwing", () => {
			const messages: Message[] = [
				{ content: "Loading...", type: "system", streaming: true },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should render queued message without throwing", () => {
			const messages: Message[] = [
				{
					content: "Waiting...",
					type: "user",
					queued: true,
					queuedMessageId: "msg-1",
				},
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("reasoning content", () => {
		it("should render message with reasoning without throwing", () => {
			const messages: Message[] = [
				{
					content: "Final answer",
					type: "system",
					reasoning: "Let me think about this...",
				},
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle collapsed reasoning without throwing", () => {
			const messages: Message[] = [
				{
					content: "Answer",
					type: "system",
					reasoning: "Thinking...",
					reasoningCollapsed: true,
				},
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("ask user QA", () => {
		it("should render message with askUserQA without throwing", () => {
			const askUserQA: AskUserQA = {
				question: "Which option?",
				options: ["A", "B", "C"],
				answer: "B",
			};
			const messages: Message[] = [
				{ content: "Here is my question", type: "system", askUserQA },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle collapsed askUser without throwing", () => {
			const askUserQA: AskUserQA = {
				question: "Pick one",
				options: ["X", "Y"],
				answer: "X",
			};
			const messages: Message[] = [
				{
					content: "Question",
					type: "system",
					askUserQA,
					askUserCollapsed: true,
				},
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("markdown rendering", () => {
		it("should render markdown content without throwing", () => {
			const messages: Message[] = [
				{ content: "**bold** text", type: "system" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle disabled markdown without throwing", () => {
			const messages: Message[] = [
				{ content: "**bold** text", type: "system", markdown: false },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("focus mode", () => {
		it("should accept input focus mode", () => {
			const messages: Message[] = [{ content: "Test", type: "system" }];
			expect(() =>
				render(<MessageOutput messages={messages} focusMode="input" />),
			).not.toThrow();
		});

		it("should accept output focus mode", () => {
			const messages: Message[] = [{ content: "Test", type: "system" }];
			expect(() =>
				render(<MessageOutput messages={messages} focusMode="output" />),
			).not.toThrow();
		});
	});

	describe("collapse functionality", () => {
		it("should accept collapsedGroups prop", () => {
			const messages: Message[] = [{ content: "Test", type: "system" }];
			const collapsedGroups = new Set(["group-0"]);
			expect(() =>
				render(
					<MessageOutput messages={messages} collapsedGroups={collapsedGroups} />,
				),
			).not.toThrow();
		});

		it("should accept onToggleCollapse callback", () => {
			const onToggleCollapse = vi.fn();
			const messages: Message[] = [{ content: "Test", type: "system" }];
			expect(() =>
				render(
					<MessageOutput
						messages={messages}
						onToggleCollapse={onToggleCollapse}
					/>,
				),
			).not.toThrow();
		});

		it("should accept onExpandAll callback", () => {
			const onExpandAll = vi.fn();
			const messages: Message[] = [{ content: "Test", type: "system" }];
			expect(() =>
				render(<MessageOutput messages={messages} onExpandAll={onExpandAll} />),
			).not.toThrow();
		});

		it("should accept onCollapseAll callback", () => {
			const onCollapseAll = vi.fn();
			const messages: Message[] = [{ content: "Test", type: "system" }];
			expect(() =>
				render(
					<MessageOutput messages={messages} onCollapseAll={onCollapseAll} />,
				),
			).not.toThrow();
		});
	});

	describe("reasoning collapse callbacks", () => {
		it("should accept onToggleReasoningCollapse callback", () => {
			const onToggleReasoningCollapse = vi.fn();
			const messages: Message[] = [
				{ content: "Test", type: "system", reasoning: "Thinking..." },
			];
			expect(() =>
				render(
					<MessageOutput
						messages={messages}
						onToggleReasoningCollapse={onToggleReasoningCollapse}
					/>,
				),
			).not.toThrow();
		});
	});

	describe("askUser collapse callbacks", () => {
		it("should accept onToggleAskUserCollapse callback", () => {
			const onToggleAskUserCollapse = vi.fn();
			const askUserQA: AskUserQA = {
				question: "Pick?",
				options: ["A"],
				answer: "A",
			};
			const messages: Message[] = [
				{ content: "Test", type: "system", askUserQA },
			];
			expect(() =>
				render(
					<MessageOutput
						messages={messages}
						onToggleAskUserCollapse={onToggleAskUserCollapse}
					/>,
				),
			).not.toThrow();
		});
	});

	describe("multiline content", () => {
		it("should handle multiline messages without throwing", () => {
			const messages: Message[] = [
				{ content: "Line 1\nLine 2\nLine 3", type: "system" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("empty content", () => {
		it("should handle empty message content without throwing", () => {
			const messages: Message[] = [{ content: "", type: "system" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("special characters", () => {
		it("should handle messages with special characters without throwing", () => {
			const messages: Message[] = [
				{ content: "Hello 你好 こんにちは 🎉", type: "system" },
			];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("long messages", () => {
		it("should handle very long single-line message without throwing", () => {
			const longContent = "x".repeat(500);
			const messages: Message[] = [{ content: longContent, type: "system" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle many lines of content without throwing", () => {
			const manyLines = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join(
				"\n",
			);
			const messages: Message[] = [{ content: manyLines, type: "system" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});

	describe("edge cases", () => {
		it("should handle null-like content", () => {
			// Content is required, but test with minimal content
			const messages: Message[] = [{ content: " ", type: "system" }];
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});

		it("should handle many messages", () => {
			const messages: Message[] = Array.from({ length: 50 }, (_, i) => ({
				content: `Message ${i}`,
				type: i % 2 === 0 ? ("user" as const) : ("system" as const),
			}));
			expect(() => render(<MessageOutput messages={messages} />)).not.toThrow();
		});
	});
});
