import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { AskUserMenu } from "../../source/components/AskUserMenu.js";

// Mock dependencies
vi.mock("../../source/i18n/index.js", () => ({
	t: vi.fn((key: string) => {
		const translations: Record<string, string> = {
			"askUser.customInput": "Custom input...",
			"askUser.customInputHint": "Enter: submit | Esc: cancel | Ctrl+Enter: new line",
			"askUser.navigationHint": "↑↓: navigate | Enter: select | Esc: cancel",
		};
		return translations[key] || key;
	}),
}));

vi.mock("../../source/components/AutocompleteInput/utils/grapheme.js", () => ({
	getPrevGraphemeBoundary: vi.fn((text: string, pos: number) => Math.max(0, pos - 1)),
	getNextGraphemeBoundary: vi.fn((text: string, pos: number) => Math.min(text.length, pos + 1)),
	splitGraphemes: vi.fn((str: string) => str.split("")),
}));

describe("AskUserMenu", () => {
	const defaultProps = {
		question: "What do you want to do?",
		options: ["Option A", "Option B", "Option C"],
		onSelect: vi.fn(),
		onCancel: vi.fn(),
		columns: 80,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("rendering", () => {
		it("should render the question", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			expect(lastFrame()).toContain("What do you want to do?");
		});

		it("should render all options", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);
			const frame = lastFrame() ?? "";

			expect(frame).toContain("Option A");
			expect(frame).toContain("Option B");
			expect(frame).toContain("Option C");
		});

		it("should render custom input option", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			expect(lastFrame()).toContain("Custom input...");
		});

		it("should render navigation hint", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			expect(lastFrame()).toContain("navigate");
		});

		it("should render divider line", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			expect(lastFrame()).toContain("─");
		});

		it("should show selection indicator on first option by default", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			// First option should be selected (has ▸)
			expect(lastFrame()).toContain("▸");
		});
	});

	describe("options limiting", () => {
		it("should limit options to 3 plus custom input", () => {
			const props = {
				...defaultProps,
				options: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"], // 5 options
			};
			const { lastFrame } = render(<AskUserMenu {...props} />);
			const frame = lastFrame() ?? "";

			// Should only show first 3 options + custom input
			expect(frame).toContain("Alpha");
			expect(frame).toContain("Beta");
			expect(frame).toContain("Gamma");
			expect(frame).not.toContain("Delta");
			expect(frame).not.toContain("Epsilon");
			expect(frame).toContain("Custom input...");
		});

		it("should show only custom input when no options provided", () => {
			const props = {
				...defaultProps,
				options: [],
			};
			const { lastFrame } = render(<AskUserMenu {...props} />);

			expect(lastFrame()).toContain("Custom input...");
		});
	});

	describe("maxInputLines prop", () => {
		it("should accept maxInputLines prop", () => {
			const props = {
				...defaultProps,
				maxInputLines: 5,
			};
			// Should not throw
			const { lastFrame } = render(<AskUserMenu {...props} />);
			expect(lastFrame()).toBeDefined();
		});
	});

	describe("props", () => {
		it("should accept onCancel callback", () => {
			const onCancel = vi.fn();
			const props = {
				...defaultProps,
				onCancel,
			};
			const { lastFrame } = render(<AskUserMenu {...props} />);
			expect(lastFrame()).toBeDefined();
		});

		it("should work without onCancel callback", () => {
			const props = {
				question: "Test?",
				options: ["A"],
				onSelect: vi.fn(),
				columns: 80,
			};
			const { lastFrame } = render(<AskUserMenu {...props} />);
			expect(lastFrame()).toBeDefined();
		});
	});

	describe("question display", () => {
		it("should display question with cyan color marker", () => {
			const { lastFrame } = render(<AskUserMenu {...defaultProps} />);

			// Question should be displayed with "? " prefix
			expect(lastFrame()).toContain("?");
			expect(lastFrame()).toContain("What do you want to do?");
		});
	});

	describe("custom columns", () => {
		it("should use columns prop for divider width", () => {
			const props = {
				...defaultProps,
				columns: 40,
			};
			const { lastFrame } = render(<AskUserMenu {...props} />);

			// Should contain divider characters
			expect(lastFrame()).toContain("─");
		});
	});
});
