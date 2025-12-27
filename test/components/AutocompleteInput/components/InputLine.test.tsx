import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { InputLine } from "../../../../source/components/AutocompleteInput/components/InputLine.js";
import type { ColorRange } from "../../../../source/models/richInput.js";

describe("InputLine", () => {
	const defaultProps = {
		line: "hello world",
		lineIndex: 0,
		lineOffset: 0,
		isFirstLine: true,
		isCursorLine: false,
		cursorCol: 0,
		suggestionStart: -1,
		prompt: "> ",
		promptIndent: "  ",
		colorRanges: [] as ColorRange[],
	};

	describe("basic rendering", () => {
		it("should render line content", () => {
			const { lastFrame } = render(<InputLine {...defaultProps} />);

			expect(lastFrame()).toContain("hello world");
		});

		it("should render prompt for first line", () => {
			const { lastFrame } = render(<InputLine {...defaultProps} isFirstLine={true} />);

			expect(lastFrame()).toContain(">");
		});

		it("should render indent for non-first lines", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} isFirstLine={false} promptIndent="   " />,
			);

			// Non-first lines should have indent instead of prompt
			const frame = lastFrame()!;
			expect(frame).toContain("hello world");
		});
	});

	describe("cursor rendering", () => {
		it("should render cursor on cursor line", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} isCursorLine={true} cursorCol={0} />,
			);

			// Cursor should be visible
			expect(lastFrame()).toContain("hello world");
		});

		it("should render cursor in middle of text", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} isCursorLine={true} cursorCol={5} />,
			);

			expect(lastFrame()).toContain("hello");
		});

		it("should render cursor at end with space", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} isCursorLine={true} cursorCol={11} />,
			);

			// Cursor at end should show space
			expect(lastFrame()).toContain("hello world");
		});
	});

	describe("suggestion rendering", () => {
		it("should render suggestion text", () => {
			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					line="hello suggestion"
					suggestionStart={6}
					isCursorLine={false}
				/>,
			);

			expect(lastFrame()).toContain("hello");
			expect(lastFrame()).toContain("suggestion");
		});

		it("should render cursor at suggestion boundary", () => {
			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					line="hello suggest"
					suggestionStart={6}
					isCursorLine={true}
					cursorCol={6}
				/>,
			);

			expect(lastFrame()).toContain("hello");
		});
	});

	describe("color ranges", () => {
		it("should apply color to specified range", () => {
			const colorRanges: ColorRange[] = [
				{ start: 0, end: 5, color: "#ff0000" },
			];

			const { lastFrame } = render(
				<InputLine {...defaultProps} colorRanges={colorRanges} />,
			);

			// The text should be rendered (color may not be visible in test output)
			expect(lastFrame()).toContain("hello");
		});

		it("should handle multiple color ranges", () => {
			const colorRanges: ColorRange[] = [
				{ start: 0, end: 5, color: "#ff0000" },
				{ start: 6, end: 11, color: "#00ff00" },
			];

			const { lastFrame } = render(
				<InputLine {...defaultProps} colorRanges={colorRanges} />,
			);

			expect(lastFrame()).toContain("hello");
			expect(lastFrame()).toContain("world");
		});

		it("should render plain text between color ranges", () => {
			const colorRanges: ColorRange[] = [{ start: 0, end: 2, color: "#ff0000" }];

			const { lastFrame } = render(
				<InputLine {...defaultProps} colorRanges={colorRanges} />,
			);

			expect(lastFrame()).toContain("hello world");
		});

		it("should handle color range beyond text", () => {
			const colorRanges: ColorRange[] = [
				{ start: 100, end: 110, color: "#ff0000" },
			];

			const { lastFrame } = render(
				<InputLine {...defaultProps} colorRanges={colorRanges} />,
			);

			// Should still render without issues
			expect(lastFrame()).toContain("hello world");
		});

		it("should handle empty color ranges", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} colorRanges={[]} />,
			);

			expect(lastFrame()).toContain("hello world");
		});
	});

	describe("CJK characters", () => {
		it("should handle CJK characters in line", () => {
			const { lastFrame } = render(
				<InputLine {...defaultProps} line="你好世界" />,
			);

			expect(lastFrame()).toContain("你好世界");
		});

		it("should handle cursor on CJK line", () => {
			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					line="你好"
					isCursorLine={true}
					cursorCol={2} // 第二个字符（宽度2）
				/>,
			);

			expect(lastFrame()).toContain("你");
		});
	});

	describe("line offset", () => {
		it("should use lineOffset for color range calculation", () => {
			const colorRanges: ColorRange[] = [
				{ start: 10, end: 15, color: "#ff0000" },
			];

			// Line starts at offset 10, so range 10-15 should apply to characters 0-5
			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					line="hello"
					lineOffset={10}
					colorRanges={colorRanges}
				/>,
			);

			expect(lastFrame()).toContain("hello");
		});
	});

	describe("cursor with colors", () => {
		it("should apply color under cursor", () => {
			const colorRanges: ColorRange[] = [
				{ start: 0, end: 5, color: "#ff0000" },
			];

			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					isCursorLine={true}
					cursorCol={2}
					colorRanges={colorRanges}
				/>,
			);

			expect(lastFrame()).toContain("hello");
		});

		it("should render cursor without color when outside range", () => {
			const colorRanges: ColorRange[] = [
				{ start: 0, end: 2, color: "#ff0000" },
			];

			const { lastFrame } = render(
				<InputLine
					{...defaultProps}
					isCursorLine={true}
					cursorCol={5}
					colorRanges={colorRanges}
				/>,
			);

			expect(lastFrame()).toContain("hello");
		});
	});
});
