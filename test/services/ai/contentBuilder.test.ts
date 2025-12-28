import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

// Mock dependencies
vi.mock("../../../source/services/ai/fileReader.js", () => ({
	readFileContents: vi.fn(),
	formatFilesAsXml: vi.fn((files) => {
		return files
			.map((f: any) => `<file path="${f.path}">${f.content}</file>`)
			.join("\n");
	}),
}));

vi.mock("../../../source/services/ai/tokenEstimator.js", () => ({
	estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
	truncateFilesProportionally: vi.fn((files, limit) => {
		return files.map((f: any) => ({
			...f,
			wasTruncated: f.content.length > limit / files.length,
			content: f.content.substring(0, Math.floor(limit / files.length)),
		}));
	}),
}));

import {
	buildMessageContent,
	transformUserMessage,
} from "../../../source/services/ai/contentBuilder.js";
import { readFileContents } from "../../../source/services/ai/fileReader.js";

describe("contentBuilder", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("transformUserMessage", () => {
		it("should transform file references to text", () => {
			const message = "看看 @src/app.tsx 这个文件";
			const files = [{ path: "src/app.tsx", isDirectory: false }];

			const result = transformUserMessage(message, files);

			expect(result).toBe("看看 文件 src/app.tsx 这个文件");
		});

		it("should transform directory references to text", () => {
			const message = "检查 @src/components 目录";
			const files = [{ path: "src/components", isDirectory: true }];

			const result = transformUserMessage(message, files);

			expect(result).toBe("检查 目录 src/components 目录");
		});

		it("should handle multiple file references", () => {
			const message = "比较 @file1.ts 和 @file2.ts";
			const files = [
				{ path: "file1.ts", isDirectory: false },
				{ path: "file2.ts", isDirectory: false },
			];

			const result = transformUserMessage(message, files);

			expect(result).toBe("比较 文件 file1.ts 和 文件 file2.ts");
		});

		it("should return original message when no files", () => {
			const message = "Hello world";
			const files: any[] = [];

			const result = transformUserMessage(message, files);

			expect(result).toBe("Hello world");
		});

		it("should handle message without @ references", () => {
			const message = "Just a message";
			const files = [{ path: "file.ts", isDirectory: false }];

			const result = transformUserMessage(message, files);

			expect(result).toBe("Just a message");
		});
	});

	describe("buildMessageContent", () => {
		it("should return user message when no files", async () => {
			const result = await buildMessageContent({
				userMessage: "Hello",
				files: [],
				cwd: "/project",
				availableTokens: 1000,
			});

			expect(result.content).toBe("Hello");
			expect(result.wasTruncated).toBe(false);
			expect(result.fileSummary).toBe("");
		});

		it("should build content with files", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{
						path: "app.ts",
						content: "const x = 1;",
						isDirectory: false,
					},
				],
				totalSize: 12,
			});

			const result = await buildMessageContent({
				userMessage: "Check @app.ts",
				files: [{ path: "app.ts", isDirectory: false }],
				cwd: "/project",
				availableTokens: 10000,
			});

			expect(result.content).toContain("app.ts");
			expect(result.fileSummary).toContain("1 个文件");
		});

		it("should handle file read errors", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{
						path: "missing.ts",
						content: "",
						isDirectory: false,
						error: "File not found",
					},
				],
				totalSize: 0,
			});

			const result = await buildMessageContent({
				userMessage: "Check @missing.ts",
				files: [{ path: "missing.ts", isDirectory: false }],
				cwd: "/project",
				availableTokens: 10000,
			});

			expect(result.content).toContain("missing.ts");
		});

		it("should truncate files when exceeding limit", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{
						path: "large.ts",
						content: "x".repeat(10000),
						isDirectory: false,
					},
				],
				totalSize: 10000,
			});

			const result = await buildMessageContent({
				userMessage: "Check @large.ts",
				files: [{ path: "large.ts", isDirectory: false }],
				cwd: "/project",
				availableTokens: 100, // Very small limit
			});

			expect(result.wasTruncated).toBe(true);
			expect(result.truncationNotice).toBeTruthy();
		});

		it("should handle no available space for files", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{
						path: "file.ts",
						content: "content",
						isDirectory: false,
					},
				],
				totalSize: 7,
			});

			const result = await buildMessageContent({
				userMessage: "x".repeat(1000), // Large message
				files: [{ path: "file.ts", isDirectory: false }],
				cwd: "/project",
				availableTokens: 100, // Small limit
			});

			expect(result.wasTruncated).toBe(true);
			expect(result.truncationNotice).toContain("省略");
		});

		it("should indicate when content exceeds available tokens", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [],
				totalSize: 0,
			});

			const result = await buildMessageContent({
				userMessage: "x".repeat(10000),
				files: [],
				cwd: "/project",
				availableTokens: 10, // Very small limit
			});

			expect(result.exceedsAvailable).toBe(true);
		});

		it("should generate file summary", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{ path: "a.ts", content: "a", isDirectory: false },
					{ path: "b.ts", content: "b", isDirectory: false },
				],
				totalSize: 2,
			});

			const result = await buildMessageContent({
				userMessage: "Check files",
				files: [
					{ path: "a.ts", isDirectory: false },
					{ path: "b.ts", isDirectory: false },
				],
				cwd: "/project",
				availableTokens: 10000,
			});

			expect(result.fileSummary).toContain("2 个文件");
			expect(result.fileSummary).toContain("a.ts");
			expect(result.fileSummary).toContain("b.ts");
		});

		it("should truncate multiple files proportionally", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{ path: "file1.ts", content: "x".repeat(5000), isDirectory: false },
					{ path: "file2.ts", content: "y".repeat(3000), isDirectory: false },
				],
				totalSize: 8000,
			});

			const result = await buildMessageContent({
				userMessage: "Check files",
				files: [
					{ path: "file1.ts", isDirectory: false },
					{ path: "file2.ts", isDirectory: false },
				],
				cwd: "/project",
				availableTokens: 2000, // Enough for message but files need truncation
			});

			expect(result.wasTruncated).toBe(true);
			expect(result.truncationNotice).toContain("截断");
		});

		it("should merge truncated files with error files", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{ path: "good.ts", content: "x".repeat(5000), isDirectory: false },
					{
						path: "bad.ts",
						content: "",
						isDirectory: false,
						error: "Cannot read",
					},
				],
				totalSize: 5000,
			});

			const result = await buildMessageContent({
				userMessage: "Check files",
				files: [
					{ path: "good.ts", isDirectory: false },
					{ path: "bad.ts", isDirectory: false },
				],
				cwd: "/project",
				availableTokens: 500, // Small limit
			});

			// The result should contain both files
			expect(result.content).toContain("good.ts");
			expect(result.content).toContain("bad.ts");
		});

		it("should handle files without truncation when within limit", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{ path: "small.ts", content: "const x = 1;", isDirectory: false },
				],
				totalSize: 12,
			});

			const result = await buildMessageContent({
				userMessage: "Check file",
				files: [{ path: "small.ts", isDirectory: false }],
				cwd: "/project",
				availableTokens: 100000, // Large limit
			});

			expect(result.wasTruncated).toBe(false);
			expect(result.truncationNotice).toBe("");
		});

		it("should handle directory references in file summary", async () => {
			vi.mocked(readFileContents).mockResolvedValue({
				files: [
					{
						path: "src/components",
						content: "Directory contents",
						isDirectory: true,
					},
				],
				totalSize: 100,
			});

			const result = await buildMessageContent({
				userMessage: "Check @src/components",
				files: [{ path: "src/components", isDirectory: true }],
				cwd: "/project",
				availableTokens: 10000,
			});

			expect(result.fileSummary).toContain("1 个文件");
			expect(result.fileSummary).toContain("components");
		});
	});
});
