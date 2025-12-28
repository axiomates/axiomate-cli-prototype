import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockUseInput, mockExit } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
	mockExit: vi.fn(),
}));

vi.mock("ink", () => ({
	useInput: mockUseInput,
	useApp: () => ({ exit: mockExit }),
}));

// Mock React's useCallback to just return the callback directly
vi.mock("react", () => ({
	useCallback: (fn: any) => fn,
}));

// Import after mocking
import { useInputHandler } from "../../../../source/components/AutocompleteInput/hooks/useInputHandler.js";
import type { EditorState, HistoryEntry } from "../../../../source/components/AutocompleteInput/types.js";

// Helper to call hook (it just registers useInput, returns void)
function callHook(options: Parameters<typeof useInputHandler>[0]) {
	useInputHandler(options);
}

// Helper to create initial state
function createInitialState(overrides?: Partial<EditorState>): EditorState {
	return {
		instance: {
			text: "",
			cursor: 0,
			type: "message",
			segments: [{ text: "", color: undefined }],
			commandPath: [],
			filePath: [],
			selectedFiles: [],
		},
		uiMode: { type: "normal" },
		suggestion: null,
		...overrides,
	};
}

// Helper to simulate key press
function simulateKeyPress(
	inputChar: string,
	key: Partial<{
		return: boolean;
		escape: boolean;
		upArrow: boolean;
		downArrow: boolean;
		leftArrow: boolean;
		rightArrow: boolean;
		backspace: boolean;
		delete: boolean;
		tab: boolean;
		ctrl: boolean;
		meta: boolean;
		shift: boolean;
	}> = {},
) {
	const callback = mockUseInput.mock.calls[mockUseInput.mock.calls.length - 1]?.[0];
	if (callback) {
		callback(inputChar, {
			return: false,
			escape: false,
			upArrow: false,
			downArrow: false,
			leftArrow: false,
			rightArrow: false,
			backspace: false,
			delete: false,
			tab: false,
			ctrl: false,
			meta: false,
			shift: false,
			...key,
		});
	}
}

describe("useInputHandler", () => {
	let mockDispatch: ReturnType<typeof vi.fn>;
	let mockOnSubmit: ReturnType<typeof vi.fn>;
	let mockOnExit: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDispatch = vi.fn();
		mockOnSubmit = vi.fn();
		mockOnExit = vi.fn();
	});

	describe("basic input", () => {
		it("should handle character input", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("a");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "a",
				cursor: 1,
			});
		});

		it("should handle return key for submit", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockOnSubmit).toHaveBeenCalledWith(state.instance);
		});

		it("should handle Ctrl+Enter for newline", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true, ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello\n",
				cursor: 6,
			});
		});

		it("should handle backspace", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hell",
				cursor: 4,
			});
		});

		it("should handle delete key", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 0,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("\x1b[3~", { delete: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "ello",
				cursor: 0,
			});
		});
	});

	describe("cursor movement", () => {
		it("should handle left arrow", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { leftArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 2,
			});
		});

		it("should handle right arrow", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { rightArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 4,
			});
		});

		it("should handle Ctrl+A to go to beginning", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 3,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("a", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 0,
			});
		});

		it("should handle Ctrl+E to go to end", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 0,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("e", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 5,
			});
		});

		it("should handle Ctrl+U to clear before cursor", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("u", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "world",
				cursor: 0,
			});
		});

		it("should handle Ctrl+K to clear after cursor", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("k", { ctrl: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello ",
				cursor: 6,
			});
		});
	});

	describe("suggestion handling", () => {
		it("should accept suggestion on Tab", () => {
			const state = createInitialState({
				instance: {
					text: "hel",
					cursor: 3,
					type: "message",
					segments: [{ text: "hel", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: "lo",
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { tab: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello",
				cursor: 5,
			});
		});

		it("should accept one character on right arrow at end with suggestion", () => {
			const state = createInitialState({
				instance: {
					text: "hel",
					cursor: 3,
					type: "message",
					segments: [{ text: "hel", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: "lo",
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { rightArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hell",
				cursor: 4,
			});
		});
	});

	describe("slash command mode", () => {
		it("should navigate commands with up arrow", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 1 },
			});
			const commands = [
				{ name: "cmd1", description: "Command 1" },
				{ name: "cmd2", description: "Command 2" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_SLASH",
				index: 0,
			});
		});

		it("should navigate commands with down arrow", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const commands = [
				{ name: "cmd1", description: "Command 1" },
				{ name: "cmd2", description: "Command 2" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_SLASH",
				index: 1,
			});
		});

		it("should submit on return for leaf command", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const commands = [{ name: "leaf", description: "Leaf command" }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_FINAL_COMMAND",
				name: "leaf",
			});
			expect(mockOnSubmit).toHaveBeenCalled();
		});

		it("should exit slash mode on escape", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [{ name: "cmd", description: "Command" }],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_SLASH_LEVEL",
			});
		});
	});

	describe("history navigation", () => {
		it("should enter history mode on up arrow", () => {
			const state = createInitialState();
			const history: HistoryEntry[] = [
				{
					text: "previous command",
					type: "message",
					segments: [{ text: "previous command", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_HISTORY",
				index: 0,
				entry: history[0],
			});
		});

		it("should exit history on down arrow at end", () => {
			const state = createInitialState({
				uiMode: {
					type: "history",
					index: 0,
					savedEntry: {
						text: "",
						type: "message",
						segments: [],
						commandPath: [],
						filePath: [],
						selectedFiles: [],
					},
				},
			});
			const history: HistoryEntry[] = [
				{
					text: "only",
					type: "message",
					segments: [{ text: "only", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_HISTORY",
			});
		});

		it("should navigate down through history", () => {
			const state = createInitialState({
				uiMode: {
					type: "history",
					index: 0,
					savedEntry: {
						text: "",
						type: "message",
						segments: [],
						commandPath: [],
						filePath: [],
						selectedFiles: [],
					},
				},
			});
			const history: HistoryEntry[] = [
				{
					text: "first",
					type: "message",
					segments: [{ text: "first", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				{
					text: "second",
					type: "message",
					segments: [{ text: "second", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "NAVIGATE_HISTORY",
				index: 1,
				entry: history[1],
			});
		});

		it("should not enter history mode on down arrow when not in history mode", () => {
			const state = createInitialState();
			const history: HistoryEntry[] = [
				{
					text: "first",
					type: "message",
					segments: [{ text: "first", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			// Should not dispatch anything - down arrow in normal mode does nothing
			expect(mockDispatch).not.toHaveBeenCalled();
		});

		it("should not navigate history with empty history", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).not.toHaveBeenCalled();
		});

		it("should continue navigating up through history", () => {
			const state = createInitialState({
				uiMode: {
					type: "history",
					index: 1,
					savedEntry: {
						text: "",
						type: "message",
						segments: [],
						commandPath: [],
						filePath: [],
						selectedFiles: [],
					},
				},
			});
			const history: HistoryEntry[] = [
				{
					text: "first",
					type: "message",
					segments: [{ text: "first", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				{
					text: "second",
					type: "message",
					segments: [{ text: "second", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history,
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "NAVIGATE_HISTORY",
				index: 0,
				entry: history[0],
			});
		});
	});

	describe("file selection mode", () => {
		it("should enter file mode on @", () => {
			const state = createInitialState({
				instance: {
					text: "hello ",
					cursor: 6,
					type: "message",
					segments: [{ text: "hello ", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("@");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_FILE",
				atPosition: 6,
				prefix: "hello ",
				suffix: "",
			});
		});

		it("should navigate files with up arrow", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 1,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [
				{ name: "file1.ts", isDirectory: false, path: "file1.ts" },
				{ name: "file2.ts", isDirectory: false, path: "file2.ts" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { upArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_FILE",
				index: 0,
			});
		});

		it("should confirm file selection on return", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [{ name: "file.ts", isDirectory: false, path: "file.ts" }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "CONFIRM_FILE",
				fileName: "file.ts",
			});
		});

		it("should exit file mode on escape", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_FILE",
			});
		});

		it("should navigate files with down arrow", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [
				{ name: "file1.ts", isDirectory: false, path: "file1.ts" },
				{ name: "file2.ts", isDirectory: false, path: "file2.ts" },
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { downArrow: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SELECT_FILE",
				index: 1,
			});
		});

		it("should enter directory on return", () => {
			const state = createInitialState({
				instance: {
					text: "@",
					cursor: 1,
					type: "message",
					segments: [{ text: "@", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [{ name: "src", isDirectory: true, path: "src" }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_FILE_DIR",
				dirName: "src",
			});
		});

		it("should confirm folder selection on return for . entry", () => {
			const state = createInitialState({
				instance: {
					text: "@src/",
					cursor: 5,
					type: "message",
					segments: [{ text: "@src/", color: "cyan" }],
					commandPath: [],
					filePath: ["src"],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 0,
					prefix: "",
					suffix: "",
				},
			});
			const files = [{ name: ".", isDirectory: false, path: "." }];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: files,
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "CONFIRM_FOLDER",
			});
		});
	});

	describe("help mode", () => {
		it("should toggle help on ? when input is empty", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("?");

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "TOGGLE_HELP",
			});
		});

		it("should exit help mode on escape", () => {
			const state = createInitialState({
				uiMode: { type: "help" },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledTimes(1);
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "TOGGLE_HELP",
			});
		});

		it("should continue processing after exiting help mode on non-escape key", () => {
			const state = createInitialState({
				uiMode: { type: "help" },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("a");

			// Should toggle help first, then process character input
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "TOGGLE_HELP",
			});
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "a",
				cursor: 1,
			});
		});
	});

	describe("escape handling", () => {
		it("should clear suggestion on escape in normal mode", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5,
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				suggestion: "world",
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: "world",
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_SUGGESTION",
				suggestion: null,
			});
		});
	});

	describe("exit handling", () => {
		it("should call onExit on Ctrl+C", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
				onExit: mockOnExit,
			});

			simulateKeyPress("c", { ctrl: true });

			expect(mockOnExit).toHaveBeenCalled();
		});

		it("should call exit from useApp if no onExit provided", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("c", { ctrl: true });

			expect(mockExit).toHaveBeenCalled();
		});
	});

	describe("isActive", () => {
		it("should pass isActive to useInput", () => {
			const state = createInitialState();
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
				isActive: false,
			});

			expect(mockUseInput).toHaveBeenCalledWith(expect.any(Function), {
				isActive: false,
			});
		});
	});

	describe("right arrow with selected files", () => {
		it("should skip over file region when moving right", () => {
			// Text is "hello @file.ts world" with file at position 6-14 (@ + file.ts = 8 chars)
			// Position 6 is @, positions 7-13 are "file.ts", position 14 is end
			const state = createInitialState({
				instance: {
					text: "hello @file.ts world",
					cursor: 7, // Inside the file region (after @)
					type: "message",
					segments: [{ text: "hello @file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 6,
							endPosition: 14,  // 6 + "@file.ts".length = 6 + 8 = 14
						},
					],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { rightArrow: true });

			// Should jump to end of file region
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 14,
			});
		});
	});

	describe("escape in slash mode", () => {
		it("should exit slash level on escape in slash mode", () => {
			const state = createInitialState({
				instance: {
					text: "/model",
					cursor: 6,
					type: "command",
					segments: [{ text: "/model", color: "cyan" }],
					commandPath: ["model"],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [
					{ name: "gpt4", description: "GPT-4" },
				],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_SLASH_LEVEL",
			});
		});

		it("should exit slash mode on escape when no filtered commands", () => {
			const state = createInitialState({
				instance: {
					text: "/xyz",
					cursor: 4,
					type: "command",
					segments: [{ text: "/xyz", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [], // No matching commands
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { escape: true });

			// Should still dispatch EXIT_SLASH_LEVEL (via the general escape handler)
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_SLASH_LEVEL",
			});
		});
	});

	describe("left arrow with selected files", () => {
		it("should skip to file start when moving left into file region", () => {
			// Text is "hello @file.ts world"
			// Position 14 is right after the file region
			const state = createInitialState({
				instance: {
					text: "hello @file.ts world",
					cursor: 13, // Inside the file region
					type: "message",
					segments: [{ text: "hello @file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 6,
							endPosition: 14,
						},
					],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { leftArrow: true });

			// Should jump to start of file region
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_CURSOR",
				cursor: 6,
			});
		});
	});

	describe("slash command with children", () => {
		it("should enter next level on return for command with children", () => {
			const state = createInitialState({
				instance: {
					text: "/",
					cursor: 1,
					type: "command",
					segments: [{ text: "/", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const commands = [
				{
					name: "model",
					description: "Select model",
					children: [
						{ name: "gpt4", description: "GPT-4" },
						{ name: "claude", description: "Claude" },
					],
				},
			];
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: commands,
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { return: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "ENTER_SLASH_LEVEL",
				name: "model",
			});
			// Should NOT call onSubmit since it has children
			expect(mockOnSubmit).not.toHaveBeenCalled();
		});
	});

	describe("backspace with selected files", () => {
		it("should remove file when backspace at file end position", () => {
			// Text is "x@file.ts world", file ends at position 9
			// Cursor at 9 (right after the file region)
			const state = createInitialState({
				instance: {
					text: "x@file.ts world",
					cursor: 9, // Right at end of file region
					type: "message",
					segments: [{ text: "x@file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 1,
							endPosition: 9,
						},
					],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate backspace
			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "REMOVE_SELECTED_FILE",
				file: expect.objectContaining({ path: "file.ts" }),
			});
		});

		it("should remove file when backspace inside file region (defensive)", () => {
			// Text is "x@file.ts world", cursor inside file region
			// This is a defensive case that shouldn't normally happen
			const state = createInitialState({
				instance: {
					text: "x@file.ts world",
					cursor: 5, // Inside file region (after @fil)
					type: "message",
					segments: [{ text: "x@file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 1,
							endPosition: 9,
						},
					],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate backspace
			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "REMOVE_SELECTED_FILE",
				file: expect.objectContaining({ path: "file.ts" }),
			});
		});
	});

	describe("delete key with selected files", () => {
		it("should remove file when delete key pressed at file region start", () => {
			// Text is "hello @file.ts world"
			// Position 6 is @, the start of file region
			const state = createInitialState({
				instance: {
					text: "hello @file.ts world",
					cursor: 6, // At start of file region
					type: "message",
					segments: [{ text: "hello @file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 6,
							endPosition: 14,
						},
					],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate delete key (not backspace)
			simulateKeyPress("\x1b[3~", { delete: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "REMOVE_SELECTED_FILE",
				file: expect.objectContaining({ path: "file.ts" }),
			});
		});

		it("should remove file when delete key next char is inside file region", () => {
			// Text is "x@file.ts world" - file starts at position 1
			// Cursor at 1, cursor+1=2 which is > 1 (atPosition) and < 9 (endPosition)
			const state = createInitialState({
				instance: {
					text: "x@file.ts world",
					cursor: 1, // At @, but findSelectedFileStartingAt returns null for this position
					          // because findSelectedFileStartingAt checks if cursor == atPosition
					          // and here cursor=1, atPosition=1, so it matches fileAtStart first
					          // Let me use cursor=0 instead
					type: "message",
					segments: [{ text: "x@file.ts world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [
						{
							path: "file.ts",
							atPosition: 1,
							endPosition: 9, // 1 + "@file.ts".length = 1 + 8 = 9
						},
					],
				},
			});
			// Actually, for cursor=0, cursor+1=1, and 1 > 1 is false, so it won't match
			// We need cursor such that cursor+1 is strictly between atPosition and endPosition
			// Let's say cursor=1, cursor+1=2, and atPosition=1, endPosition=9
			// 2 > 1 && 2 < 9 is true, so it should match
			// But first it checks findSelectedFileStartingAt(1) which returns the file
			// So we need a position where fileAtStart returns null but fileAtNext returns the file
			// This happens when cursor is not at atPosition, but cursor+1 is inside the file
			// With text "ab@file.ts", atPosition=2, endPosition=10
			// cursor=1 -> cursor+1=2, but 2 > 2 is false
			// cursor=2 -> this is atPosition, fileAtStart matches
			// Actually the condition is cursor > atPosition, not >=
			// So we need: cursor != atPosition AND cursor+1 > atPosition AND cursor+1 < endPosition
			// That means: cursor >= atPosition AND cursor < endPosition - 1
			// But if cursor == atPosition, fileAtStart matches first
			// So effectively fileAtNext only matches when cursor is NOT at atPosition but cursor+1 is inside
			// This is actually impossible because:
			// - If cursor+1 > atPosition, then cursor >= atPosition
			// - If cursor > atPosition, then cursor is inside (if cursor < endPosition), but that's handled by fileAtCursor earlier
			// Wait, there's no fileAtCursor check for delete key, only fileAtStart and fileAtNext

			// Let me reconsider: for delete key at cursor, we check:
			// 1. fileAtStart(cursor) - cursor == file.atPosition
			// 2. fileAtNext(cursor+1) - cursor+1 > file.atPosition && cursor+1 < file.endPosition

			// For fileAtNext to match but not fileAtStart:
			// cursor != atPosition AND (cursor+1 > atPosition AND cursor+1 < endPosition)
			// => cursor != atPosition AND cursor >= atPosition AND cursor < endPosition - 1
			// => cursor > atPosition AND cursor < endPosition - 1 (since cursor != atPosition)

			// This means cursor must be inside the file region (but not at start)
			// Wait, but then the original code would have cursor inside the file, which seems like an edge case

			// Actually I think line 311-315 can only be reached if:
			// - fileAtStart didn't match (cursor != atPosition of any file)
			// - but cursor+1 is inside a file region
			// This can happen if there are multiple files or if cursor is between files

			// Simpler approach: cursor just before @ where there's a space
			// "x @file.ts" with cursor=1 (at space), cursor+1=2 which is @ position
			// atPosition=2, so cursor+1=2, and 2 > 2 is false, doesn't match

			// The only way fileAtNext matches is if cursor+1 is STRICTLY inside the file region
			// i.e., cursor+1 > atPosition
			// So cursor > atPosition - 1, i.e., cursor >= atPosition
			// But if cursor == atPosition, fileAtStart matches first
			// So cursor > atPosition, meaning cursor is inside the file (after @)
			// But wait, in that case we're deleting from inside the file region which seems weird

			// Let me re-read the code context - this is for DELETE key (not backspace)
			// When you press delete inside a file region, it should remove the whole file
			// So cursor could be at position 7 (inside @file.ts), cursor+1=8, still inside
			// findSelectedFileStartingAt(7) returns null (7 != atPosition=1)
			// findSelectedFileAtCursor(8) checks if 8 > 1 && 8 < 9, which is true

			callHook({
				state: createInitialState({
					instance: {
						text: "x@file.ts world",
						cursor: 3, // Inside file region (after @fi)
						type: "message",
						segments: [{ text: "x@file.ts world", color: undefined }],
						commandPath: [],
						filePath: [],
						selectedFiles: [
							{
								path: "file.ts",
								atPosition: 1,
								endPosition: 9,
							},
						],
					},
				}),
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate delete key (not backspace)
			simulateKeyPress("\x1b[3~", { delete: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "REMOVE_SELECTED_FILE",
				file: expect.objectContaining({ path: "file.ts" }),
			});
		});

		it("should delete character normally when not at file region", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 5, // At "o" before space
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate delete key
			simulateKeyPress("\x1b[3~", { delete: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "helloworld",
				cursor: 5,
			});
		});

		it("should do nothing when delete key pressed at end of input", () => {
			const state = createInitialState({
				instance: {
					text: "hello",
					cursor: 5, // At end
					type: "message",
					segments: [{ text: "hello", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate delete key at end
			simulateKeyPress("\x1b[3~", { delete: true });

			// Should not dispatch anything
			expect(mockDispatch).not.toHaveBeenCalled();
		});
	});

	describe("file mode backspace handling", () => {
		it("should delete filter text character when backspace with filter text", () => {
			// Text is "hello @src/fil" with filter text "fil"
			// prefix = "hello ", atPosition = 6, filePath = ["src"]
			// fullPrefixLength = 6 + "@src/".length = 6 + 5 = 11
			// cursor = 14 > 11, so hasFilterText = true
			const state = createInitialState({
				instance: {
					text: "hello @src/fil",
					cursor: 14, // At end of filter text
					type: "message",
					segments: [{ text: "hello @src/fil", color: undefined }],
					commandPath: [],
					filePath: ["src"],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 6,
					prefix: "hello ",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [{ name: "file.ts", isDirectory: false, path: "src/file.ts" }],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_TEXT",
				text: "hello @src/fi",
				cursor: 13,
			});
		});

		it("should exit file mode at root level when backspace without filter text", () => {
			// Text is "hello @" with cursor at 7
			// prefix = "hello ", atPosition = 6, filePath = []
			// fullPrefixLength = 6 + "@".length = 7
			// cursor = 7, so hasFilterText = false
			// filePath.length === 0, so should exit file mode
			const state = createInitialState({
				instance: {
					text: "hello @",
					cursor: 7,
					type: "message",
					segments: [{ text: "hello @", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 6,
					prefix: "hello ",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_FILE_KEEP_AT",
			});
		});

		it("should navigate to parent directory when backspace in subdirectory", () => {
			// Text is "hello @src/" with cursor at 11
			// prefix = "hello ", atPosition = 6, filePath = ["src"]
			// fullPrefixLength = 6 + "@src/".length = 11
			// cursor = 11, so hasFilterText = false
			// filePath.length > 0, so should exit to parent
			const state = createInitialState({
				instance: {
					text: "hello @src/",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello @src/", color: undefined }],
					commandPath: [],
					filePath: ["src"],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 6,
					prefix: "hello ",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			simulateKeyPress("", { backspace: true });

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "EXIT_FILE",
			});
		});

		it("should ignore delete key in file mode (not backspace)", () => {
			// In file mode, only backspace should be processed, not delete key
			const state = createInitialState({
				instance: {
					text: "hello @src/",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello @src/", color: undefined }],
					commandPath: [],
					filePath: ["src"],
					selectedFiles: [],
				},
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: 6,
					prefix: "hello ",
					suffix: "",
				},
			});
			callHook({
				state,
				dispatch: mockDispatch,
				history: [],
				filteredCommands: [],
				filteredFiles: [],
				effectiveSuggestion: null,
				onSubmit: mockOnSubmit,
			});

			// Simulate delete key (not backspace) with delete sequence
			simulateKeyPress("\x1b[3~", { delete: true });

			// Should not dispatch anything - delete key is ignored in file mode
			expect(mockDispatch).not.toHaveBeenCalled();
		});
	});
});
