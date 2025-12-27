import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
	promises: {
		readFile: vi.fn(),
		readdir: vi.fn(),
		stat: vi.fn(),
	},
}));

import * as fs from "node:fs";
import {
	readFileContents,
	formatFilesAsXml,
	formatDirectoryListing,
	type FileContent,
} from "../../../source/services/ai/fileReader.js";

describe("fileReader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("readFileContents", () => {
		it("should read file content", async () => {
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 12 } as any);
			vi.mocked(fs.promises.readFile).mockResolvedValue("const x = 1;");

			const result = await readFileContents(
				[{ path: "app.ts", isDirectory: false }],
				"/project",
			);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]!.content).toBe("const x = 1;");
			expect(result.files[0]!.size).toBe(12);
			expect(result.files[0]!.isDirectory).toBe(false);
		});

		it("should read directory contents", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"file1.ts",
				"file2.ts",
			] as any);

			const result = await readFileContents(
				[{ path: "src", isDirectory: true }],
				"/project",
			);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]!.content).toBe("file1.ts, file2.ts");
			expect(result.files[0]!.isDirectory).toBe(true);
		});

		it("should handle read errors", async () => {
			vi.mocked(fs.promises.stat).mockRejectedValue(
				new Error("File not found"),
			);

			const result = await readFileContents(
				[{ path: "missing.ts", isDirectory: false }],
				"/project",
			);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]!.error).toBe("File not found");
			expect(result.errors).toHaveLength(1);
		});

		it("should handle multiple files", async () => {
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 5 } as any);
			vi.mocked(fs.promises.readFile).mockResolvedValue("hello");

			const result = await readFileContents(
				[
					{ path: "a.ts", isDirectory: false },
					{ path: "b.ts", isDirectory: false },
				],
				"/project",
			);

			expect(result.files).toHaveLength(2);
			expect(result.totalSize).toBe(10);
		});

		it("should handle absolute paths", async () => {
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 5 } as any);
			vi.mocked(fs.promises.readFile).mockResolvedValue("hello");

			const result = await readFileContents(
				[{ path: "/absolute/path/file.ts", isDirectory: false }],
				"/project",
			);

			expect(result.files).toHaveLength(1);
			expect(vi.mocked(fs.promises.readFile)).toHaveBeenCalledWith(
				"/absolute/path/file.ts",
				"utf-8",
			);
		});

		it("should handle non-Error exceptions", async () => {
			vi.mocked(fs.promises.stat).mockRejectedValue("String error");

			const result = await readFileContents(
				[{ path: "file.ts", isDirectory: false }],
				"/project",
			);

			expect(result.files[0]!.error).toBe("Unknown error");
		});
	});

	describe("formatFilesAsXml", () => {
		it("should format file as XML", () => {
			const files: FileContent[] = [
				{
					path: "app.ts",
					content: "const x = 1;",
					size: 12,
					isDirectory: false,
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain('<file path="app.ts">');
			expect(result).toContain("const x = 1;");
			expect(result).toContain("</file>");
		});

		it("should format directory as XML", () => {
			const files: FileContent[] = [
				{
					path: "src",
					content: "file1.ts, file2.ts",
					size: 18,
					isDirectory: true,
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain('<directory path="src">');
			expect(result).toContain("file1.ts, file2.ts");
			expect(result).toContain("</directory>");
		});

		it("should format error as XML", () => {
			const files: FileContent[] = [
				{
					path: "missing.ts",
					content: "",
					size: 0,
					isDirectory: false,
					error: "File not found",
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain('<file path="missing.ts" error="true">');
			expect(result).toContain("File not found");
		});

		it("should escape XML attributes", () => {
			const files: FileContent[] = [
				{
					path: 'file"with"quotes.ts',
					content: "content",
					size: 7,
					isDirectory: false,
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain("&quot;");
			expect(result).not.toContain('"with"');
		});

		it("should escape XML content", () => {
			const files: FileContent[] = [
				{
					path: "file.ts",
					content: "",
					size: 0,
					isDirectory: false,
					error: "<script>alert('xss')</script>",
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain("&lt;script&gt;");
			expect(result).not.toContain("<script>");
		});

		it("should format multiple files", () => {
			const files: FileContent[] = [
				{
					path: "a.ts",
					content: "a",
					size: 1,
					isDirectory: false,
				},
				{
					path: "b.ts",
					content: "b",
					size: 1,
					isDirectory: false,
				},
			];

			const result = formatFilesAsXml(files);

			expect(result).toContain('<file path="a.ts">');
			expect(result).toContain('<file path="b.ts">');
		});
	});

	describe("formatDirectoryListing", () => {
		it("should format directory listing", () => {
			const result = formatDirectoryListing("src", [
				"file1.ts",
				"file2.ts",
			]);

			expect(result).toBe(
				'<directory path="src">file1.ts, file2.ts</directory>',
			);
		});

		it("should escape special characters in path", () => {
			const result = formatDirectoryListing('dir"name', ["file.ts"]);

			expect(result).toContain("&quot;");
		});
	});
});
