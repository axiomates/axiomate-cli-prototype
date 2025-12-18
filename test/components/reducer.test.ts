import { describe, expect, it } from "vitest";
import {
	editorReducer,
	initialState,
} from "../../source/components/AutocompleteInput/reducer.js";
import {
	type EditorState,
	type EditorAction,
	type HistoryEntry,
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isFileMode,
	isHelpMode,
	createMessageInstance,
} from "../../source/components/AutocompleteInput/types.js";

import { PATH_SEPARATOR } from "../../source/constants/platform.js";

describe("editorReducer", () => {
	// ============================================================================
	// Initial State
	// ============================================================================

	describe("initialState", () => {
		it("has empty instance and normal mode", () => {
			expect(initialState.instance.text).toBe("");
			expect(initialState.instance.cursor).toBe(0);
			expect(initialState.uiMode.type).toBe("normal");
			expect(initialState.suggestion).toBeNull();
		});
	});

	// ============================================================================
	// Normal Mode (Autocomplete Input)
	// ============================================================================

	describe("normal mode", () => {
		it("SET_TEXT updates text and cursor", () => {
			const state = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
			expect(state.instance.text).toBe("hello");
			expect(state.instance.cursor).toBe(5);
			expect(state.instance.type).toBe("message");
		});

		it("SET_TEXT creates message segments for regular text", () => {
			const state = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "hello world",
				cursor: 11,
			});
			expect(state.instance.segments).toEqual([{ text: "hello world" }]);
		});

		it("SET_TEXT creates empty segments for empty text", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
			const state = editorReducer(stateWithText, {
				type: "SET_TEXT",
				text: "",
				cursor: 0,
			});
			expect(state.instance.segments).toEqual([]);
		});

		it("SET_CURSOR updates cursor position only", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
			const state = editorReducer(stateWithText, {
				type: "SET_CURSOR",
				cursor: 2,
			});
			expect(state.instance.cursor).toBe(2);
			expect(state.instance.text).toBe("hello");
		});

		it("SET_SUGGESTION updates suggestion", () => {
			const state = editorReducer(initialState, {
				type: "SET_SUGGESTION",
				suggestion: "hello world",
			});
			expect(state.suggestion).toBe("hello world");
		});

		it("SET_SUGGESTION can clear suggestion", () => {
			const stateWithSuggestion = editorReducer(initialState, {
				type: "SET_SUGGESTION",
				suggestion: "hello",
			});
			const state = editorReducer(stateWithSuggestion, {
				type: "SET_SUGGESTION",
				suggestion: null,
			});
			expect(state.suggestion).toBeNull();
		});

		it("preserves selectedFiles positions when text changes", () => {
			// Setup state with selected file
			const instance = createMessageInstance("hello @file.ts world");
			instance.selectedFiles = [
				{ path: "file.ts", isDirectory: false, atPosition: 6, endPosition: 14 },
			];
			const stateWithFile: EditorState = {
				...initialState,
				instance,
			};

			// Add text at beginning
			const state = editorReducer(stateWithFile, {
				type: "SET_TEXT",
				text: "say hello @file.ts world",
				cursor: 24,
			});

			// File position should be updated
			expect(state.instance.selectedFiles[0]?.atPosition).toBe(10);
		});
	});

	// ============================================================================
	// Help Mode (? trigger)
	// ============================================================================

	describe("help mode", () => {
		it("TOGGLE_HELP enters help mode from normal", () => {
			const state = editorReducer(initialState, { type: "TOGGLE_HELP" });
			expect(isHelpMode(state.uiMode)).toBe(true);
		});

		it("TOGGLE_HELP exits help mode", () => {
			const helpState: EditorState = {
				...initialState,
				uiMode: { type: "help" },
			};
			const state = editorReducer(helpState, { type: "TOGGLE_HELP" });
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("TOGGLE_HELP can be toggled multiple times", () => {
			let state = initialState;
			state = editorReducer(state, { type: "TOGGLE_HELP" });
			expect(isHelpMode(state.uiMode)).toBe(true);
			state = editorReducer(state, { type: "TOGGLE_HELP" });
			expect(isNormalMode(state.uiMode)).toBe(true);
			state = editorReducer(state, { type: "TOGGLE_HELP" });
			expect(isHelpMode(state.uiMode)).toBe(true);
		});
	});

	// ============================================================================
	// History Mode (Up/Down Navigation)
	// ============================================================================

	describe("history mode", () => {
		const sampleHistory: HistoryEntry[] = [
			{
				text: "first entry",
				type: "message",
				segments: [{ text: "first entry" }],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			},
			{
				text: "second entry",
				type: "message",
				segments: [{ text: "second entry" }],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			},
		];

		it("ENTER_HISTORY enters history mode with first entry", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			expect(isHistoryMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("first entry");
			if (isHistoryMode(state.uiMode)) {
				expect(state.uiMode.index).toBe(0);
				// savedEntry should contain the previous state
				expect(state.uiMode.savedEntry.text).toBe("");
			}
		});

		it("ENTER_HISTORY saves current entry for restoration", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "current typing",
				cursor: 14,
			});
			const state = editorReducer(stateWithText, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			if (isHistoryMode(state.uiMode)) {
				expect(state.uiMode.savedEntry.text).toBe("current typing");
			}
		});

		it("NAVIGATE_HISTORY changes history entry", () => {
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			const state = editorReducer(historyState, {
				type: "NAVIGATE_HISTORY",
				index: 1,
				entry: sampleHistory[1]!,
			});
			expect(state.instance.text).toBe("second entry");
			if (isHistoryMode(state.uiMode)) {
				expect(state.uiMode.index).toBe(1);
			}
		});

		it("NAVIGATE_HISTORY preserves savedEntry", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "saved text",
				cursor: 10,
			});
			const historyState = editorReducer(stateWithText, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			const state = editorReducer(historyState, {
				type: "NAVIGATE_HISTORY",
				index: 1,
				entry: sampleHistory[1]!,
			});
			if (isHistoryMode(state.uiMode)) {
				expect(state.uiMode.savedEntry.text).toBe("saved text");
			}
		});

		it("EXIT_HISTORY restores savedEntry", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "my current text",
				cursor: 15,
			});
			const historyState = editorReducer(stateWithText, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			const state = editorReducer(historyState, { type: "EXIT_HISTORY" });
			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("my current text");
		});

		it("EXIT_HISTORY does nothing in normal mode", () => {
			const state = editorReducer(initialState, { type: "EXIT_HISTORY" });
			expect(state).toBe(initialState);
		});

		it("SET_TEXT in history mode exits to appropriate mode", () => {
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			const state = editorReducer(historyState, {
				type: "SET_TEXT",
				text: "new input",
				cursor: 9,
			});
			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("new input");
		});

		it("SET_TEXT with / in history mode transitions to slash mode", () => {
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: sampleHistory[0]!,
			});
			const state = editorReducer(historyState, {
				type: "SET_TEXT",
				text: "/",
				cursor: 1,
			});
			expect(isSlashMode(state.uiMode)).toBe(true);
		});

		it("history mode restores command type entries", () => {
			const commandEntry: HistoryEntry = {
				text: "/help",
				type: "command",
				segments: [
					{ text: "/", color: "#ffd700" },
					{ text: "help", color: "#ffd700" },
				],
				commandPath: ["help"],
				filePath: [],
				selectedFiles: [],
			};
			const state = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: commandEntry,
			});
			expect(state.instance.type).toBe("command");
			expect(state.instance.commandPath).toEqual(["help"]);
		});

		it("history mode restores selectedFiles", () => {
			const entryWithFiles: HistoryEntry = {
				text: "@file.ts",
				type: "message",
				segments: [
					{ text: "@", color: "#87ceeb" },
					{ text: "file.ts", color: "#87ceeb" },
				],
				commandPath: [],
				filePath: [],
				selectedFiles: [
					{
						path: "file.ts",
						isDirectory: false,
						atPosition: 0,
						endPosition: 8,
					},
				],
			};
			const state = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry: entryWithFiles,
			});
			expect(state.instance.selectedFiles).toHaveLength(1);
			expect(state.instance.selectedFiles[0]?.path).toBe("file.ts");
		});
	});

	// ============================================================================
	// Slash Command Mode
	// ============================================================================

	describe("slash mode", () => {
		it("SET_TEXT with / transitions to slash mode", () => {
			const state = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "/",
				cursor: 1,
			});
			expect(isSlashMode(state.uiMode)).toBe(true);
			if (isSlashMode(state.uiMode)) {
				expect(state.uiMode.selectedIndex).toBe(0);
			}
		});

		it("ENTER_SLASH enters slash mode explicitly", () => {
			const state = editorReducer(initialState, { type: "ENTER_SLASH" });
			expect(isSlashMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("/");
		});

		it("SELECT_SLASH changes selected index", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, {
				type: "SELECT_SLASH",
				index: 2,
			});
			if (isSlashMode(state.uiMode)) {
				expect(state.uiMode.selectedIndex).toBe(2);
			}
		});

		it("SELECT_SLASH does nothing in normal mode", () => {
			const state = editorReducer(initialState, {
				type: "SELECT_SLASH",
				index: 2,
			});
			expect(state).toBe(initialState);
		});

		it("ENTER_SLASH_LEVEL adds command to path", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, {
				type: "ENTER_SLASH_LEVEL",
				name: "model",
			});
			expect(state.instance.commandPath).toEqual(["model"]);
			expect(state.instance.text).toBe("/model → ");
			if (isSlashMode(state.uiMode)) {
				expect(state.uiMode.selectedIndex).toBe(0);
			}
		});

		it("ENTER_SLASH_LEVEL chains multiple levels", () => {
			let state = editorReducer(initialState, { type: "ENTER_SLASH" });
			state = editorReducer(state, {
				type: "ENTER_SLASH_LEVEL",
				name: "model",
			});
			state = editorReducer(state, {
				type: "ENTER_SLASH_LEVEL",
				name: "openai",
			});
			expect(state.instance.commandPath).toEqual(["model", "openai"]);
			expect(state.instance.text).toBe("/model → openai → ");
		});

		it("SELECT_FINAL_COMMAND updates instance with final path", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, {
				type: "SELECT_FINAL_COMMAND",
				name: "help",
			});
			expect(state.instance.commandPath).toEqual(["help"]);
			expect(state.instance.text).toBe("/help");
			// No trailing arrow
			expect(state.instance.text.endsWith(" → ")).toBe(false);
		});

		it("EXIT_SLASH_LEVEL goes back one level", () => {
			let state = editorReducer(initialState, { type: "ENTER_SLASH" });
			state = editorReducer(state, {
				type: "ENTER_SLASH_LEVEL",
				name: "model",
			});
			state = editorReducer(state, {
				type: "ENTER_SLASH_LEVEL",
				name: "openai",
			});
			state = editorReducer(state, { type: "EXIT_SLASH_LEVEL" });
			expect(state.instance.commandPath).toEqual(["model"]);
		});

		it("EXIT_SLASH_LEVEL at root exits slash mode", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, { type: "EXIT_SLASH_LEVEL" });
			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("");
		});

		it("SET_TEXT deleting / exits slash mode", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, {
				type: "SET_TEXT",
				text: "",
				cursor: 0,
			});
			expect(isNormalMode(state.uiMode)).toBe(true);
		});
	});

	// ============================================================================
	// File Selection Mode (@ trigger)
	// ============================================================================

	describe("file mode", () => {
		it("ENTER_FILE enters file mode", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			expect(isFileMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("@");
			if (isFileMode(state.uiMode)) {
				expect(state.uiMode.selectedIndex).toBe(0);
				expect(state.uiMode.prefix).toBe("");
				expect(state.uiMode.suffix).toBe("");
			}
		});

		it("ENTER_FILE preserves prefix", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "see file ",
				cursor: 9,
			});
			const state = editorReducer(stateWithText, {
				type: "ENTER_FILE",
				atPosition: 9,
				prefix: "see file ",
				suffix: "",
			});
			expect(state.instance.text).toBe("see file @");
			if (isFileMode(state.uiMode)) {
				expect(state.uiMode.prefix).toBe("see file ");
			}
		});

		it("ENTER_FILE preserves suffix", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: " is great",
			});
			if (isFileMode(state.uiMode)) {
				expect(state.uiMode.suffix).toBe(" is great");
			}
			// Note: suffix is not in text during file mode, restored on exit/confirm
		});

		it("SELECT_FILE changes selected index", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, {
				type: "SELECT_FILE",
				index: 3,
			});
			if (isFileMode(state.uiMode)) {
				expect(state.uiMode.selectedIndex).toBe(3);
			}
		});

		it("ENTER_FILE_DIR enters subdirectory", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, {
				type: "ENTER_FILE_DIR",
				dirName: "src",
			});
			expect(state.instance.filePath).toEqual(["src"]);
			expect(state.instance.text).toBe("@src" + PATH_SEPARATOR);
		});

		it("ENTER_FILE_DIR chains multiple directories", () => {
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			state = editorReducer(state, { type: "ENTER_FILE_DIR", dirName: "src" });
			state = editorReducer(state, {
				type: "ENTER_FILE_DIR",
				dirName: "components",
			});
			expect(state.instance.filePath).toEqual(["src", "components"]);
		});

		it("CONFIRM_FILE selects file and exits file mode", () => {
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			state = editorReducer(state, { type: "ENTER_FILE_DIR", dirName: "src" });
			state = editorReducer(state, {
				type: "CONFIRM_FILE",
				fileName: "app.tsx",
			});

			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.filePath).toEqual([]);
			expect(state.instance.selectedFiles).toHaveLength(1);
			expect(state.instance.selectedFiles[0]?.path).toBe(
				"src" + PATH_SEPARATOR + "app.tsx",
			);
		});

		it("CONFIRM_FILE restores suffix", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: " is good",
			});
			const finalState = editorReducer(state, {
				type: "CONFIRM_FILE",
				fileName: "file.ts",
			});
			expect(finalState.instance.text).toBe("@file.ts is good");
		});

		it("CONFIRM_FILE preserves prefix", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 5,
				prefix: "read ",
				suffix: "",
			});
			const finalState = editorReducer(state, {
				type: "CONFIRM_FILE",
				fileName: "file.ts",
			});
			expect(finalState.instance.text).toBe("read @file.ts");
		});

		it("CONFIRM_FOLDER selects current folder", () => {
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			state = editorReducer(state, { type: "ENTER_FILE_DIR", dirName: "src" });
			state = editorReducer(state, { type: "CONFIRM_FOLDER" });

			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.selectedFiles).toHaveLength(1);
			expect(state.instance.selectedFiles[0]?.isDirectory).toBe(true);
			expect(state.instance.selectedFiles[0]?.path).toBe("src");
		});

		it("EXIT_FILE goes back one directory level", () => {
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			state = editorReducer(state, { type: "ENTER_FILE_DIR", dirName: "src" });
			state = editorReducer(state, {
				type: "ENTER_FILE_DIR",
				dirName: "components",
			});
			state = editorReducer(state, { type: "EXIT_FILE" });
			expect(state.instance.filePath).toEqual(["src"]);
			expect(isFileMode(state.uiMode)).toBe(true);
		});

		it("EXIT_FILE at root exits file mode", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, { type: "EXIT_FILE" });
			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("");
		});

		it("EXIT_FILE at root restores prefix and suffix", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 5,
				prefix: "read ",
				suffix: " please",
			});
			const state = editorReducer(fileState, { type: "EXIT_FILE" });
			expect(state.instance.text).toBe("read  please");
			expect(state.instance.cursor).toBe(5);
		});

		it("EXIT_FILE_KEEP_AT keeps current text", () => {
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: " world",
			});
			state = editorReducer(state, { type: "ENTER_FILE_DIR", dirName: "src" });
			state = editorReducer(state, { type: "EXIT_FILE_KEEP_AT" });
			expect(isNormalMode(state.uiMode)).toBe(true);
			expect(state.instance.text).toBe("@src" + PATH_SEPARATOR + " world");
		});

		it("multiple file selection works", () => {
			// First file
			let state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			state = editorReducer(state, { type: "CONFIRM_FILE", fileName: "a.ts" });

			// Second file
			state = editorReducer(state, {
				type: "ENTER_FILE",
				atPosition: 6,
				prefix: "@a.ts ",
				suffix: "",
			});
			state = editorReducer(state, { type: "CONFIRM_FILE", fileName: "b.ts" });

			expect(state.instance.selectedFiles).toHaveLength(2);
			expect(state.instance.text).toBe("@a.ts @b.ts");
		});

		it("REMOVE_SELECTED_FILE removes file from text and list", () => {
			// Setup state with selected file
			const instance = createMessageInstance("hello @file.ts world");
			instance.selectedFiles = [
				{ path: "file.ts", isDirectory: false, atPosition: 6, endPosition: 14 },
			];
			const stateWithFile: EditorState = {
				...initialState,
				instance,
			};

			const state = editorReducer(stateWithFile, {
				type: "REMOVE_SELECTED_FILE",
				file: instance.selectedFiles[0]!,
			});

			expect(state.instance.text).toBe("hello  world");
			expect(state.instance.selectedFiles).toHaveLength(0);
			expect(state.instance.cursor).toBe(6);
		});
	});

	// ============================================================================
	// Mode Transitions and ESC Logic
	// ============================================================================

	describe("mode transitions", () => {
		it("normal -> slash via SET_TEXT /", () => {
			const state = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "/",
				cursor: 1,
			});
			expect(isSlashMode(state.uiMode)).toBe(true);
		});

		it("slash -> normal via deleting /", () => {
			const slashState = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "/",
				cursor: 1,
			});
			const state = editorReducer(slashState, {
				type: "SET_TEXT",
				text: "",
				cursor: 0,
			});
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("normal -> help via TOGGLE_HELP", () => {
			const state = editorReducer(initialState, { type: "TOGGLE_HELP" });
			expect(isHelpMode(state.uiMode)).toBe(true);
		});

		it("help -> normal via TOGGLE_HELP", () => {
			const helpState: EditorState = {
				...initialState,
				uiMode: { type: "help" },
			};
			const state = editorReducer(helpState, { type: "TOGGLE_HELP" });
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("normal -> history via ENTER_HISTORY", () => {
			const entry: HistoryEntry = {
				text: "history",
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const state = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry,
			});
			expect(isHistoryMode(state.uiMode)).toBe(true);
		});

		it("history -> normal via EXIT_HISTORY (ESC)", () => {
			const entry: HistoryEntry = {
				text: "history",
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry,
			});
			const state = editorReducer(historyState, { type: "EXIT_HISTORY" });
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("history -> slash via SET_TEXT /", () => {
			const entry: HistoryEntry = {
				text: "history",
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry,
			});
			const state = editorReducer(historyState, {
				type: "SET_TEXT",
				text: "/",
				cursor: 1,
			});
			expect(isSlashMode(state.uiMode)).toBe(true);
		});

		it("normal -> file via ENTER_FILE", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			expect(isFileMode(state.uiMode)).toBe(true);
		});

		it("file -> normal via EXIT_FILE at root (ESC)", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, { type: "EXIT_FILE" });
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("file -> normal via CONFIRM_FILE", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, {
				type: "CONFIRM_FILE",
				fileName: "test.ts",
			});
			expect(isNormalMode(state.uiMode)).toBe(true);
		});

		it("slash -> normal via EXIT_SLASH_LEVEL at root (ESC)", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, { type: "EXIT_SLASH_LEVEL" });
			expect(isNormalMode(state.uiMode)).toBe(true);
		});
	});

	// ============================================================================
	// RESET Action
	// ============================================================================

	describe("RESET action", () => {
		it("resets to initial state from normal mode", () => {
			const stateWithText = editorReducer(initialState, {
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
			const state = editorReducer(stateWithText, { type: "RESET" });
			expect(state).toEqual(initialState);
		});

		it("resets to initial state from slash mode", () => {
			const slashState = editorReducer(initialState, { type: "ENTER_SLASH" });
			const state = editorReducer(slashState, { type: "RESET" });
			expect(state).toEqual(initialState);
		});

		it("resets to initial state from file mode", () => {
			const fileState = editorReducer(initialState, {
				type: "ENTER_FILE",
				atPosition: 0,
				prefix: "",
				suffix: "",
			});
			const state = editorReducer(fileState, { type: "RESET" });
			expect(state).toEqual(initialState);
		});

		it("resets to initial state from history mode", () => {
			const entry: HistoryEntry = {
				text: "history",
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const historyState = editorReducer(initialState, {
				type: "ENTER_HISTORY",
				index: 0,
				entry,
			});
			const state = editorReducer(historyState, { type: "RESET" });
			expect(state).toEqual(initialState);
		});

		it("resets to initial state from help mode", () => {
			const helpState: EditorState = {
				...initialState,
				uiMode: { type: "help" },
			};
			const state = editorReducer(helpState, { type: "RESET" });
			expect(state).toEqual(initialState);
		});
	});

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe("edge cases", () => {
		it("unknown action returns same state", () => {
			const state = editorReducer(initialState, {
				type: "UNKNOWN",
			} as unknown as EditorAction);
			expect(state).toBe(initialState);
		});

		it("NAVIGATE_HISTORY in normal mode does nothing", () => {
			const entry: HistoryEntry = {
				text: "entry",
				type: "message",
				segments: [],
				commandPath: [],
				filePath: [],
				selectedFiles: [],
			};
			const state = editorReducer(initialState, {
				type: "NAVIGATE_HISTORY",
				index: 0,
				entry,
			});
			expect(state).toBe(initialState);
		});

		it("ENTER_SLASH_LEVEL in normal mode does nothing", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_SLASH_LEVEL",
				name: "test",
			});
			expect(state).toBe(initialState);
		});

		it("ENTER_FILE_DIR in normal mode does nothing", () => {
			const state = editorReducer(initialState, {
				type: "ENTER_FILE_DIR",
				dirName: "src",
			});
			expect(state).toBe(initialState);
		});

		it("CONFIRM_FILE in normal mode does nothing", () => {
			const state = editorReducer(initialState, {
				type: "CONFIRM_FILE",
				fileName: "test.ts",
			});
			expect(state).toBe(initialState);
		});
	});
});
