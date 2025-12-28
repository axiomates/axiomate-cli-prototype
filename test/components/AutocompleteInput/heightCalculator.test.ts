import { describe, it, expect } from "vitest";
import { calculateInputAreaHeight } from "../../../source/components/AutocompleteInput/utils/heightCalculator.js";
import type { UIMode, SlashCommand } from "../../../source/components/AutocompleteInput/types.js";
import type { FileItem } from "../../../source/components/AutocompleteInput/hooks/useFileSelect.js";

describe("heightCalculator", () => {
	describe("calculateInputAreaHeight", () => {
		const mockCommands: SlashCommand[] = [
			{ name: "cmd1", description: "Command 1" },
			{ name: "cmd2", description: "Command 2" },
			{ name: "cmd3", description: "Command 3" },
		];

		const mockFiles: FileItem[] = [
			{ name: "file1.txt", isDirectory: false, path: "file1.txt" },
			{ name: "file2.txt", isDirectory: false, path: "file2.txt" },
		];

		it("should return inputLines for normal mode", () => {
			const result = calculateInputAreaHeight({
				inputLines: 3,
				uiMode: { type: "normal" },
				filteredCommands: [],
				filteredFiles: [],
				commandPath: [],
				filePath: [],
				filesLoading: false,
			});

			expect(result).toBe(3);
		});

		it("should return inputLines for history mode", () => {
			const result = calculateInputAreaHeight({
				inputLines: 2,
				uiMode: { type: "history" },
				filteredCommands: [],
				filteredFiles: [],
				commandPath: [],
				filePath: [],
				filesLoading: false,
			});

			expect(result).toBe(2);
		});

		describe("slash mode", () => {
			it("should add divider and commands for slash mode", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "slash", selectedIndex: 0 },
					filteredCommands: mockCommands,
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 3 (commands)
				expect(result).toBe(5);
			});

			it("should add breadcrumb for nested commands", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "slash", selectedIndex: 0 },
					filteredCommands: mockCommands,
					filteredFiles: [],
					commandPath: ["parent"],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (breadcrumb) + 3 (commands)
				expect(result).toBe(6);
			});

			it("should add more indicators for long lists", () => {
				const manyCommands: SlashCommand[] = Array.from({ length: 15 }, (_, i) => ({
					name: `cmd${i}`,
					description: `Command ${i}`,
				}));

				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "slash", selectedIndex: 5 },
					filteredCommands: manyCommands,
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 9 (visible) + 1 (more after)
				expect(result).toBe(12);
			});

			it("should show more before when scrolled", () => {
				const manyCommands: SlashCommand[] = Array.from({ length: 15 }, (_, i) => ({
					name: `cmd${i}`,
					description: `Command ${i}`,
				}));

				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "slash", selectedIndex: 12 },
					filteredCommands: manyCommands,
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (more before) + 9 (visible) + 1 (more after)
				expect(result).toBe(13);
			});

			it("should return inputLines when no commands match", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "slash", selectedIndex: 0 },
					filteredCommands: [],
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				expect(result).toBe(1);
			});
		});

		describe("file mode", () => {
			it("should add divider and files for file mode", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 0 },
					filteredCommands: [],
					filteredFiles: mockFiles,
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 2 (files)
				expect(result).toBe(4);
			});

			it("should add breadcrumb for nested paths", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 0 },
					filteredCommands: [],
					filteredFiles: mockFiles,
					commandPath: [],
					filePath: ["src"],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (breadcrumb) + 2 (files)
				expect(result).toBe(5);
			});

			it("should show loading state", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 0 },
					filteredCommands: [],
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: true,
				});

				// 1 (input) + 1 (divider) + 1 (loading)
				expect(result).toBe(3);
			});

			it("should show empty state", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 0 },
					filteredCommands: [],
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (empty message)
				expect(result).toBe(3);
			});

			it("should add more indicators for long file lists", () => {
				const manyFiles: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
					name: `file${i}.txt`,
					isDirectory: false,
					path: `file${i}.txt`,
				}));

				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 5 },
					filteredCommands: [],
					filteredFiles: manyFiles,
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 9 (visible) + 1 (more after)
				expect(result).toBe(12);
			});

			it("should show more before when scrolled in file mode", () => {
				const manyFiles: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
					name: `file${i}.txt`,
					isDirectory: false,
					path: `file${i}.txt`,
				}));

				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 12 },
					filteredCommands: [],
					filteredFiles: manyFiles,
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (more before) + 9 (visible) + 1 (more after)
				expect(result).toBe(13);
			});

			it("should handle file selection at end of list", () => {
				const manyFiles: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
					name: `file${i}.txt`,
					isDirectory: false,
					path: `file${i}.txt`,
				}));

				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "file", selectedIndex: 14 },
					filteredCommands: [],
					filteredFiles: manyFiles,
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 1 (more before) + 9 (visible, no more after)
				expect(result).toBe(12);
			});
		});

		describe("help mode", () => {
			it("should add divider and help content", () => {
				const result = calculateInputAreaHeight({
					inputLines: 1,
					uiMode: { type: "help" },
					filteredCommands: [],
					filteredFiles: [],
					commandPath: [],
					filePath: [],
					filesLoading: false,
				});

				// 1 (input) + 1 (divider) + 8 (help content)
				expect(result).toBe(10);
			});
		});

		it("should handle multiple input lines", () => {
			const result = calculateInputAreaHeight({
				inputLines: 5,
				uiMode: { type: "normal" },
				filteredCommands: [],
				filteredFiles: [],
				commandPath: [],
				filePath: [],
				filesLoading: false,
			});

			expect(result).toBe(5);
		});
	});
});
