import { describe, expect, it } from "vitest";
import {
	createEmptyInstance,
	createMessageInstance,
	createCommandInstance,
	updateInstanceFromText,
	updateInstanceCursor,
	enterCommandLevel,
	exitCommandLevel,
	buildCommandText,
	buildCommandSegments,
	buildFileText,
	buildFileSegments,
	toHistoryEntry,
	fromHistoryEntry,
	toUserInput,
	updateSelectedFilesPositions,
	rebuildSegmentsWithFiles,
	findSelectedFileAtCursor,
	findSelectedFileEndingAt,
	findSelectedFileStartingAt,
	removeSelectedFile,
	isMessageInstance,
	isCommandInstance,
	getInstanceText,
	type InputInstance,
	type SelectedFile,
} from "../../source/models/inputInstance.js";
import {
	PATH_COLOR,
	ARROW_COLOR,
	FILE_AT_COLOR,
	FILE_COLOR,
} from "../../source/constants/colors.js";
import { PATH_SEPARATOR } from "../../source/constants/platform.js";

describe("models/inputInstance", () => {
	// ============================================================================
	// Factory Functions
	// ============================================================================

	describe("createEmptyInstance", () => {
		it("creates an empty input instance", () => {
			const instance = createEmptyInstance();
			expect(instance).toEqual({
				text: "",
				cursor: 0,
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			});
		});
	});

	describe("createMessageInstance", () => {
		it("creates a message instance with text", () => {
			const instance = createMessageInstance("hello world");
			expect(instance).toEqual({
				text: "hello world",
				cursor: 11,
				type: "message",
				segments: [{ text: "hello world" }],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			});
		});

		it("creates an empty message instance", () => {
			const instance = createMessageInstance("");
			expect(instance).toEqual({
				text: "",
				cursor: 0,
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			});
		});

		it("creates a message instance with custom cursor position", () => {
			const instance = createMessageInstance("hello", 3);
			expect(instance.cursor).toBe(3);
			expect(instance.text).toBe("hello");
		});
	});

	describe("createCommandInstance", () => {
		it("creates a command instance with single path", () => {
			const instance = createCommandInstance(["help"], true);
			expect(instance.text).toBe("/help → ");
			expect(instance.type).toBe("command");
			expect(instance.commandPath).toEqual(["help"]);
			expect(instance.segments).toEqual([
				{ text: "/", color: PATH_COLOR },
				{ text: "help", color: PATH_COLOR },
				{ text: " → ", color: ARROW_COLOR },
			]);
		});

		it("creates a command instance with nested path", () => {
			const instance = createCommandInstance(["model", "openai"], true);
			expect(instance.text).toBe("/model → openai → ");
			expect(instance.commandPath).toEqual(["model", "openai"]);
		});

		it("creates a command instance without trailing arrow", () => {
			const instance = createCommandInstance(["help"], false);
			expect(instance.text).toBe("/help");
			expect(instance.segments).toEqual([
				{ text: "/", color: PATH_COLOR },
				{ text: "help", color: PATH_COLOR },
			]);
		});

		it("creates a command instance with empty path", () => {
			const instance = createCommandInstance([], true);
			expect(instance.text).toBe("/");
			expect(instance.segments).toEqual([{ text: "/", color: PATH_COLOR }]);
		});
	});

	// ============================================================================
	// Update Functions
	// ============================================================================

	describe("updateInstanceFromText", () => {
		it("updates to message type for regular text", () => {
			const instance = updateInstanceFromText("hello", 5);
			expect(instance.type).toBe("message");
			expect(instance.text).toBe("hello");
			expect(instance.cursor).toBe(5);
			expect(instance.segments).toEqual([{ text: "hello" }]);
		});

		it("updates to command type for text starting with /", () => {
			const instance = updateInstanceFromText("/help", 5, ["help"]);
			expect(instance.type).toBe("command");
			expect(instance.commandPath).toEqual(["help"]);
		});

		it("preserves file path in file mode", () => {
			const instance = updateInstanceFromText("@src/", 5, [], ["src"]);
			expect(instance.filePath).toEqual(["src"]);
		});

		it("creates empty segments for empty text", () => {
			const instance = updateInstanceFromText("", 0);
			expect(instance.segments).toEqual([]);
		});
	});

	describe("updateInstanceCursor", () => {
		it("updates cursor position only", () => {
			const original = createMessageInstance("hello world");
			const updated = updateInstanceCursor(original, 5);
			expect(updated.cursor).toBe(5);
			expect(updated.text).toBe("hello world");
			expect(updated.segments).toEqual(original.segments);
		});
	});

	describe("enterCommandLevel", () => {
		it("adds command to path", () => {
			const instance = createCommandInstance(["model"], true);
			const next = enterCommandLevel(instance, "openai");
			expect(next.commandPath).toEqual(["model", "openai"]);
			expect(next.text).toBe("/model → openai → ");
		});
	});

	describe("exitCommandLevel", () => {
		it("removes last command from path", () => {
			const instance = createCommandInstance(["model", "openai"], true);
			const prev = exitCommandLevel(instance);
			expect(prev.commandPath).toEqual(["model"]);
		});

		it("returns empty instance when at root", () => {
			const instance = createCommandInstance([], true);
			const empty = exitCommandLevel(instance);
			expect(empty.text).toBe("");
			expect(empty.commandPath).toEqual([]);
		});
	});

	// ============================================================================
	// Build Functions
	// ============================================================================

	describe("buildCommandText", () => {
		it("builds text with trailing arrow", () => {
			expect(buildCommandText(["help"], true)).toBe("/help → ");
		});

		it("builds text without trailing arrow", () => {
			expect(buildCommandText(["help"], false)).toBe("/help");
		});

		it("builds nested command text", () => {
			expect(buildCommandText(["model", "openai", "gpt-4"], false)).toBe(
				"/model → openai → gpt-4",
			);
		});

		it("builds root text for empty path", () => {
			expect(buildCommandText([], true)).toBe("/");
			expect(buildCommandText([], false)).toBe("/");
		});
	});

	describe("buildCommandSegments", () => {
		it("builds segments with colors", () => {
			const segments = buildCommandSegments(["help"], true);
			expect(segments).toEqual([
				{ text: "/", color: PATH_COLOR },
				{ text: "help", color: PATH_COLOR },
				{ text: " → ", color: ARROW_COLOR },
			]);
		});

		it("builds segments without trailing arrow", () => {
			const segments = buildCommandSegments(["help"], false);
			expect(segments).toEqual([
				{ text: "/", color: PATH_COLOR },
				{ text: "help", color: PATH_COLOR },
			]);
		});

		it("builds empty segments for empty path without trailing", () => {
			const segments = buildCommandSegments([], false);
			expect(segments).toEqual([]);
		});

		it("builds / segment for empty path with trailing", () => {
			const segments = buildCommandSegments([], true);
			expect(segments).toEqual([{ text: "/", color: PATH_COLOR }]);
		});
	});

	describe("buildFileText", () => {
		it("builds @ for empty path", () => {
			expect(buildFileText([], true)).toBe("@");
		});

		it("builds path with separator", () => {
			const expected = "@src" + PATH_SEPARATOR;
			expect(buildFileText(["src"], true)).toBe(expected);
		});

		it("builds nested path without trailing separator", () => {
			const expected = "@src" + PATH_SEPARATOR + "components";
			expect(buildFileText(["src", "components"], false)).toBe(expected);
		});
	});

	describe("buildFileSegments", () => {
		it("builds @ segment for empty path", () => {
			const segments = buildFileSegments([], true);
			expect(segments).toEqual([{ text: "@", color: FILE_AT_COLOR }]);
		});

		it("builds segments with path and filter text", () => {
			const segments = buildFileSegments(["src"], true, "app");
			expect(segments[0]).toEqual({ text: "@", color: FILE_AT_COLOR });
			expect(segments[1]).toEqual({ text: "src", color: PATH_COLOR });
			expect(segments[2]).toEqual({ text: PATH_SEPARATOR, color: ARROW_COLOR });
			expect(segments[3]).toEqual({ text: "app" });
		});
	});

	// ============================================================================
	// History Functions
	// ============================================================================

	describe("toHistoryEntry", () => {
		it("converts instance to history entry (removes cursor)", () => {
			const instance = createMessageInstance("hello", 3);
			const entry = toHistoryEntry(instance);
			expect(entry).not.toHaveProperty("cursor");
			expect(entry.text).toBe("hello");
			expect(entry.type).toBe("message");
			expect(entry.segments).toEqual([{ text: "hello" }]);
		});
	});

	describe("fromHistoryEntry", () => {
		it("converts history entry to instance (cursor at end)", () => {
			const entry = {
				text: "hello",
				type: "message" as const,
				segments: [{ text: "hello" }],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const instance = fromHistoryEntry(entry);
			expect(instance.cursor).toBe(5);
			expect(instance.text).toBe("hello");
		});
	});

	// ============================================================================
	// UserInput Conversion
	// ============================================================================

	describe("toUserInput", () => {
		it("converts message instance to MessageInput", () => {
			const instance = createMessageInstance("hello");
			const userInput = toUserInput(instance);
			expect(userInput.type).toBe("message");
			if (userInput.type === "message") {
				expect(userInput.text).toBe("hello");
				expect(userInput.files).toEqual([]);
			}
		});

		it("converts command instance to CommandInput", () => {
			const instance = createCommandInstance(["help"], false);
			const userInput = toUserInput(instance);
			expect(userInput.type).toBe("command");
			if (userInput.type === "command") {
				expect(userInput.commandPath).toEqual(["help"]);
			}
		});

		it("includes selected files in message input", () => {
			const instance: InputInstance = {
				...createMessageInstance("@file.ts"),
				selectedFiles: [
					{
						path: "file.ts",
						isDirectory: false,
						atPosition: 0,
						endPosition: 8,
					},
				],
			};
			const userInput = toUserInput(instance);
			if (userInput.type === "message") {
				expect(userInput.files).toEqual([
					{ path: "file.ts", isDirectory: false },
				]);
			}
		});
	});

	// ============================================================================
	// Selected Files Functions
	// ============================================================================

	describe("updateSelectedFilesPositions", () => {
		it("updates positions when file path exists in new text", () => {
			const oldFiles: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const newFiles = updateSelectedFilesPositions("hello @file.ts", oldFiles);
			expect(newFiles[0]?.atPosition).toBe(6);
			expect(newFiles[0]?.endPosition).toBe(14);
		});

		it("removes file when path no longer exists", () => {
			const oldFiles: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const newFiles = updateSelectedFilesPositions("hello world", oldFiles);
			expect(newFiles).toEqual([]);
		});
	});

	describe("rebuildSegmentsWithFiles", () => {
		it("returns plain text segment when no files", () => {
			const segments = rebuildSegmentsWithFiles("hello world", []);
			expect(segments).toEqual([{ text: "hello world" }]);
		});

		it("returns empty array for empty text", () => {
			const segments = rebuildSegmentsWithFiles("", []);
			expect(segments).toEqual([]);
		});

		it("builds colored segments for files", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const segments = rebuildSegmentsWithFiles("@file.ts", files);
			expect(segments).toEqual([
				{ text: "@", color: FILE_AT_COLOR },
				{ text: "file.ts", color: FILE_COLOR },
			]);
		});

		it("uses PATH_COLOR for directories", () => {
			const files: SelectedFile[] = [
				{ path: "src", isDirectory: true, atPosition: 0, endPosition: 4 },
			];
			const segments = rebuildSegmentsWithFiles("@src", files);
			expect(segments[1]).toEqual({ text: "src", color: PATH_COLOR });
		});

		it("handles text before and after files", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 6, endPosition: 14 },
			];
			const segments = rebuildSegmentsWithFiles("hello @file.ts world", files);
			expect(segments[0]).toEqual({ text: "hello " });
			expect(segments[1]).toEqual({ text: "@", color: FILE_AT_COLOR });
			expect(segments[2]).toEqual({ text: "file.ts", color: FILE_COLOR });
			expect(segments[3]).toEqual({ text: " world" });
		});
	});

	describe("findSelectedFileAtCursor", () => {
		it("returns file when cursor is inside", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const file = findSelectedFileAtCursor(3, files, "@file.ts");
			expect(file).toEqual(files[0]);
		});

		it("returns null when cursor is at boundary", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			expect(findSelectedFileAtCursor(0, files, "@file.ts")).toBeNull();
			expect(findSelectedFileAtCursor(8, files, "@file.ts")).toBeNull();
		});

		it("returns null when text doesn't match", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const file = findSelectedFileAtCursor(3, files, "wrongtext");
			expect(file).toBeNull();
		});
	});

	describe("findSelectedFileEndingAt", () => {
		it("returns file when cursor is at end", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const file = findSelectedFileEndingAt(8, files, "@file.ts");
			expect(file).toEqual(files[0]);
		});

		it("returns null when cursor not at end", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			expect(findSelectedFileEndingAt(7, files, "@file.ts")).toBeNull();
		});
	});

	describe("findSelectedFileStartingAt", () => {
		it("returns file when cursor is at start", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			const file = findSelectedFileStartingAt(0, files, "@file.ts");
			expect(file).toEqual(files[0]);
		});

		it("returns null when cursor not at start", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 0, endPosition: 8 },
			];
			expect(findSelectedFileStartingAt(1, files, "@file.ts")).toBeNull();
		});
	});

	describe("removeSelectedFile", () => {
		it("removes file and updates text", () => {
			const files: SelectedFile[] = [
				{ path: "file.ts", isDirectory: false, atPosition: 6, endPosition: 14 },
			];
			const result = removeSelectedFile(
				"hello @file.ts world",
				files[0]!,
				files,
			);
			expect(result.text).toBe("hello  world");
			expect(result.cursor).toBe(6);
			expect(result.selectedFiles).toEqual([]);
		});

		it("updates positions of other files", () => {
			// @a.ts = 5 chars (pos 0-5), space, @b.ts = 5 chars (pos 6-11)
			const files: SelectedFile[] = [
				{ path: "a.ts", isDirectory: false, atPosition: 0, endPosition: 5 },
				{ path: "b.ts", isDirectory: false, atPosition: 6, endPosition: 11 },
			];
			const result = removeSelectedFile("@a.ts @b.ts", files[0]!, files);
			expect(result.text).toBe(" @b.ts");
			expect(result.selectedFiles[0]?.atPosition).toBe(1);
			expect(result.selectedFiles[0]?.endPosition).toBe(6);
		});
	});

	// ============================================================================
	// Type Guards
	// ============================================================================

	describe("isMessageInstance", () => {
		it("returns true for message type", () => {
			const instance = createMessageInstance("hello");
			expect(isMessageInstance(instance)).toBe(true);
		});

		it("returns false for command type", () => {
			const instance = createCommandInstance(["help"], false);
			expect(isMessageInstance(instance)).toBe(false);
		});
	});

	describe("isCommandInstance", () => {
		it("returns true for command type", () => {
			const instance = createCommandInstance(["help"], false);
			expect(isCommandInstance(instance)).toBe(true);
		});

		it("returns false for message type", () => {
			const instance = createMessageInstance("hello");
			expect(isCommandInstance(instance)).toBe(false);
		});
	});

	// ============================================================================
	// Utility Functions
	// ============================================================================

	describe("getInstanceText", () => {
		it("returns text from instance", () => {
			const instance = createMessageInstance("hello world");
			expect(getInstanceText(instance)).toBe("hello world");
		});

		it("returns empty string for empty instance", () => {
			const instance = createEmptyInstance();
			expect(getInstanceText(instance)).toBe("");
		});

		it("returns text from command instance", () => {
			const instance = createCommandInstance(["model"], false);
			expect(getInstanceText(instance)).toBe("/model");
		});
	});
});
