import { describe, it, expect } from "vitest";
import {
	isWideChar,
	getCharWidth,
	getStringWidth,
	wrapLine,
	processLines,
	getInputEndInfo,
} from "../../../source/components/AutocompleteInput/utils/lineProcessor.js";

describe("lineProcessor", () => {
	describe("isWideChar", () => {
		it("should return true for CJK characters", () => {
			expect(isWideChar("中")).toBe(true);
			expect(isWideChar("文")).toBe(true);
			expect(isWideChar("字")).toBe(true);
		});

		it("should return true for Japanese hiragana", () => {
			expect(isWideChar("あ")).toBe(true);
			expect(isWideChar("い")).toBe(true);
		});

		it("should return true for Japanese katakana", () => {
			expect(isWideChar("ア")).toBe(true);
			expect(isWideChar("イ")).toBe(true);
		});

		it("should return true for Korean hangul", () => {
			expect(isWideChar("가")).toBe(true);
			expect(isWideChar("나")).toBe(true);
		});

		it("should return true for fullwidth characters", () => {
			expect(isWideChar("Ａ")).toBe(true);
			expect(isWideChar("１")).toBe(true);
		});

		it("should return true for Chinese punctuation", () => {
			expect(isWideChar("、")).toBe(true);
			expect(isWideChar("。")).toBe(true);
		});

		it("should return false for ASCII characters", () => {
			expect(isWideChar("a")).toBe(false);
			expect(isWideChar("A")).toBe(false);
			expect(isWideChar("1")).toBe(false);
			expect(isWideChar(" ")).toBe(false);
		});

		it("should return false for empty string", () => {
			expect(isWideChar("")).toBe(false);
		});
	});

	describe("getCharWidth", () => {
		it("should return 2 for wide characters", () => {
			expect(getCharWidth("中")).toBe(2);
			expect(getCharWidth("あ")).toBe(2);
		});

		it("should return 1 for ASCII characters", () => {
			expect(getCharWidth("a")).toBe(1);
			expect(getCharWidth(" ")).toBe(1);
		});
	});

	describe("getStringWidth", () => {
		it("should return 0 for empty string", () => {
			expect(getStringWidth("")).toBe(0);
		});

		it("should return correct width for ASCII string", () => {
			expect(getStringWidth("hello")).toBe(5);
			expect(getStringWidth("ab cd")).toBe(5);
		});

		it("should return correct width for CJK string", () => {
			expect(getStringWidth("中文")).toBe(4);
			expect(getStringWidth("日本語")).toBe(6);
		});

		it("should return correct width for mixed string", () => {
			expect(getStringWidth("Hello中文")).toBe(5 + 4); // 5 + 4 = 9
			expect(getStringWidth("a中b")).toBe(1 + 2 + 1); // 4
		});
	});

	describe("wrapLine", () => {
		it("should return original text if width is 0 or negative", () => {
			expect(wrapLine("hello", 0)).toEqual(["hello"]);
			expect(wrapLine("hello", -1)).toEqual(["hello"]);
		});

		it("should return original text if it fits", () => {
			expect(wrapLine("hello", 10)).toEqual(["hello"]);
		});

		it("should wrap long ASCII text", () => {
			const result = wrapLine("hello world", 5);
			expect(result).toEqual(["hello", " worl", "d"]);
		});

		it("should wrap CJK text correctly", () => {
			const result = wrapLine("中文测试", 4);
			// Each CJK char is 2 wide, so 4 width fits 2 chars
			expect(result).toEqual(["中文", "测试"]);
		});

		it("should handle empty string", () => {
			expect(wrapLine("", 10)).toEqual([""]);
		});

		it("should handle single character", () => {
			expect(wrapLine("a", 1)).toEqual(["a"]);
			expect(wrapLine("中", 2)).toEqual(["中"]);
		});

		it("should handle wide character that exceeds remaining width", () => {
			// width 3, first char 'a' (1), then '中' (2) fits
			// 'a中' = 3, then '文' (2) needs new line
			const result = wrapLine("a中文", 3);
			expect(result).toEqual(["a中", "文"]);
		});
	});

	describe("processLines", () => {
		it("should process single line without wrapping", () => {
			const result = processLines("hello", "", 5, 80, 2);

			expect(result.lines).toEqual(["hello"]);
			expect(result.cursorLine).toBe(0);
			expect(result.cursorCol).toBe(5);
		});

		it("should process text with manual newlines", () => {
			const result = processLines("line1\nline2", "", 6, 80, 2);

			expect(result.lines).toEqual(["line1", "line2"]);
			expect(result.cursorLine).toBe(1);
			expect(result.cursorCol).toBe(0); // cursor at start of line2
		});

		it("should include suggestion in display", () => {
			const result = processLines("hel", "lo", 3, 80, 2);

			expect(result.lines).toEqual(["hello"]);
		});

		it("should calculate cursor position correctly", () => {
			const result = processLines("hello", "", 2, 80, 2);

			expect(result.cursorLine).toBe(0);
			expect(result.cursorCol).toBe(2);
		});

		it("should handle cursor at end", () => {
			const result = processLines("hello", "", 5, 80, 2);

			expect(result.cursorLine).toBe(0);
			expect(result.cursorCol).toBe(5);
		});

		it("should handle cursor with wide characters", () => {
			const result = processLines("中文", "", 1, 80, 2);

			// cursor after first char "中", display width is 2
			expect(result.cursorCol).toBe(2);
		});

		it("should handle narrow column width", () => {
			const result = processLines("hello", "", 5, 7, 2);
			// lineWidth = 7 - 2 = 5, "hello" fits in one line
			expect(result.lines).toEqual(["hello"]);
			expect(result.lineWidth).toBe(5);
		});

		it("should track line offsets", () => {
			const result = processLines("ab\ncd", "", 0, 80, 2);

			// "ab" 从 0 开始，"cd" 从 3 开始（ab 的长度 2 + \n 的 1）
			expect(result.lineOffsets).toEqual([0, 3]);
		});
	});

	describe("getInputEndInfo", () => {
		it("should return end info for single line", () => {
			const result = getInputEndInfo("hello", 80);

			expect(result.endLine).toBe(0);
			expect(result.endCol).toBe(5);
		});

		it("should return end info for multiple lines", () => {
			const result = getInputEndInfo("line1\nline2", 80);

			expect(result.endLine).toBe(1);
			expect(result.endCol).toBe(5);
		});

		it("should handle wrapped lines", () => {
			const result = getInputEndInfo("hello world", 5);

			// "hello" (5), " worl" (5), "d" (1)
			expect(result.endLine).toBe(2);
			expect(result.endCol).toBe(1);
		});

		it("should handle empty string", () => {
			const result = getInputEndInfo("", 80);

			expect(result.endLine).toBe(0);
			expect(result.endCol).toBe(0);
		});

		it("should handle CJK characters", () => {
			const result = getInputEndInfo("中文", 80);

			expect(result.endLine).toBe(0);
			expect(result.endCol).toBe(4); // 2 CJK chars = 4 width
		});
	});
});
