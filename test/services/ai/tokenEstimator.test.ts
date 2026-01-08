import { describe, it, expect, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";
import {
	estimateTokens,
	fitsInContext,
	truncateToFit,
	truncateFilesProportionally,
} from "../../../source/services/ai/tokenEstimator.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

describe("tokenEstimator", () => {
	describe("estimateTokens", () => {
		it("should return 0 for empty string", () => {
			expect(estimateTokens("")).toBe(0);
		});

		it("should estimate tokens for ASCII text", () => {
			// ASCII ~4 chars/token, so "hello" (5 chars) ≈ 1.25 tokens → ceil = 2
			const tokens = estimateTokens("hello");
			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThanOrEqual(5);
		});

		it("should estimate more tokens for CJK text", () => {
			// CJK ~1.5 chars/token, so "你好世界" (4 chars) ≈ 2.67 tokens → ceil = 3
			const cjkTokens = estimateTokens("你好世界");
			// ASCII "abcd" (4 chars) ≈ 1 token → ceil = 1
			const asciiTokens = estimateTokens("abcd");
			expect(cjkTokens).toBeGreaterThan(asciiTokens);
		});

		it("should handle Japanese hiragana", () => {
			const tokens = estimateTokens("こんにちは"); // 5 hiragana chars
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle Japanese katakana", () => {
			const tokens = estimateTokens("カタカナ"); // 4 katakana chars
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle Korean hangul", () => {
			const tokens = estimateTokens("안녕하세요"); // 5 hangul chars
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle mixed ASCII and CJK", () => {
			const tokens = estimateTokens("Hello 你好 World 世界");
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle other Unicode characters", () => {
			// Non-CJK Unicode like emoji (≈ 2 chars/token)
			const tokens = estimateTokens("é è ü ö");
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle code with symbols", () => {
			const code = 'function test() { return "hello"; }';
			const tokens = estimateTokens(code);
			expect(tokens).toBeGreaterThan(0);
		});

		it("should handle newlines", () => {
			const text = "line1\nline2\nline3";
			const tokens = estimateTokens(text);
			expect(tokens).toBeGreaterThan(0);
		});
	});

	describe("fitsInContext", () => {
		it("should return true for short content", () => {
			const result = fitsInContext("hello", 10000);
			expect(result).toBe(true);
		});

		it("should return false for content exceeding context", () => {
			// 创建一个很长的字符串
			const longContent = "a".repeat(100000);
			const result = fitsInContext(longContent, 1000);
			expect(result).toBe(false);
		});

		it("should account for reserve tokens", () => {
			// 默认预留 4096 tokens
			const content = "a".repeat(1000); // ~250 tokens
			const result = fitsInContext(content, 5000, 4096);
			// 250 <= 5000 - 4096 = 904, 应该是 true
			expect(result).toBe(true);
		});

		it("should handle custom reserve tokens", () => {
			const content = "a".repeat(1000); // ~250 tokens
			const result = fitsInContext(content, 1000, 800);
			// 250 > 1000 - 800 = 200, 应该是 false
			expect(result).toBe(false);
		});

		it("should handle zero reserve tokens", () => {
			const content = "hello"; // ~2 tokens
			const result = fitsInContext(content, 10, 0);
			expect(result).toBe(true);
		});
	});

	describe("truncateToFit", () => {
		it("should not truncate content within limit", () => {
			const content = "line1\nline2\nline3";
			const result = truncateToFit(content, 1000);

			expect(result.wasTruncated).toBe(false);
			expect(result.content).toBe(content);
			expect(result.originalLines).toBe(3);
			expect(result.keptLines).toBe(3);
		});

		it("should truncate content exceeding limit", () => {
			// 创建多行内容
			const lines = Array.from(
				{ length: 100 },
				(_, i) => `This is line ${i + 1} with some content`,
			);
			const content = lines.join("\n");
			const result = truncateToFit(content, 50); // 很小的限制

			expect(result.wasTruncated).toBe(true);
			expect(result.keptLines).toBeLessThan(result.originalLines);
			expect(result.content).toContain("content truncated");
		});

		it("should include truncation notice", () => {
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`);
			const content = lines.join("\n");
			const result = truncateToFit(content, 20);

			expect(result.content).toContain("[...");
			expect(result.content).toContain("showing first");
		});

		it("should keep track of line counts", () => {
			const content = "a\nb\nc\nd\ne";
			const result = truncateToFit(content, 1000);

			expect(result.originalLines).toBe(5);
			expect(result.keptLines).toBe(5);
		});

		it("should handle single line content", () => {
			const content = "single line";
			const result = truncateToFit(content, 100);

			expect(result.wasTruncated).toBe(false);
			expect(result.originalLines).toBe(1);
			expect(result.keptLines).toBe(1);
		});

		it("should handle empty content", () => {
			const result = truncateToFit("", 100);

			expect(result.wasTruncated).toBe(false);
			expect(result.content).toBe("");
			expect(result.originalLines).toBe(1); // 空字符串 split("\n") 得到 [""]
			expect(result.keptLines).toBe(1);
		});
	});

	describe("truncateFilesProportionally", () => {
		it("should not truncate files within limit", () => {
			const files = [
				{ path: "file1.txt", content: "hello" },
				{ path: "file2.txt", content: "world" },
			];
			const result = truncateFilesProportionally(files, 10000);

			expect(result).toHaveLength(2);
			expect(result[0]!.wasTruncated).toBe(false);
			expect(result[1]!.wasTruncated).toBe(false);
			expect(result[0]!.content).toBe("hello");
			expect(result[1]!.content).toBe("world");
		});

		it("should truncate files proportionally when exceeding limit", () => {
			const files = [
				{ path: "file1.txt", content: "a".repeat(1000) },
				{ path: "file2.txt", content: "b".repeat(1000) },
			];
			const result = truncateFilesProportionally(files, 100);

			expect(result).toHaveLength(2);
			// 两个文件大小相同，应该都被截断
			expect(result[0]!.wasTruncated).toBe(true);
			expect(result[1]!.wasTruncated).toBe(true);
		});

		it("should preserve file paths", () => {
			const files = [
				{ path: "/path/to/file1.txt", content: "content1" },
				{ path: "/path/to/file2.txt", content: "content2" },
			];
			const result = truncateFilesProportionally(files, 10000);

			expect(result[0]!.path).toBe("/path/to/file1.txt");
			expect(result[1]!.path).toBe("/path/to/file2.txt");
		});

		it("should handle empty files array", () => {
			const result = truncateFilesProportionally([], 1000);
			expect(result).toEqual([]);
		});

		it("should handle single file", () => {
			const files = [{ path: "file.txt", content: "hello world" }];
			const result = truncateFilesProportionally(files, 10000);

			expect(result).toHaveLength(1);
			expect(result[0]!.wasTruncated).toBe(false);
		});

		it("should allocate more tokens to larger files proportionally", () => {
			const files = [
				{ path: "small.txt", content: "small" },
				{ path: "large.txt", content: "large ".repeat(100) },
			];
			const result = truncateFilesProportionally(files, 100);

			// 较大的文件应该分配更多的 token 配额
			expect(result).toHaveLength(2);
		});
	});
});
