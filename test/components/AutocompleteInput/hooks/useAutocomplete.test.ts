import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the suggestion client
const mockGetSuggestion = vi.fn();
const mockCancel = vi.fn();

vi.mock("../../../../source/services/ai/suggestionClient.js", () => ({
	getSuggestionClient: () => ({
		getSuggestion: mockGetSuggestion,
		cancel: mockCancel,
	}),
}));

vi.mock("../../../../source/constants/suggestion.js", () => ({
	SUGGESTION_DEBOUNCE_MS: 10,
	MIN_INPUT_LENGTH: 3,
}));

const mockIsSuggestionEnabled = vi.fn(() => true);
vi.mock("../../../../source/utils/config.js", () => ({
	isSuggestionEnabled: () => mockIsSuggestionEnabled(),
}));

// Mock React hooks
let effectCleanup: (() => void) | null = null;
let effectCallbacks: Array<() => (() => void) | void> = [];
const mockDispatch = vi.fn();

vi.mock("react", () => ({
	useCallback: (fn: unknown) => fn,
	useRef: (initial: unknown) => ({ current: initial }),
	useEffect: (callback: () => (() => void) | void) => {
		effectCallbacks.push(callback);
	},
	useMemo: (fn: () => unknown) => fn(),
}));

import { useAutocomplete } from "../../../../source/components/AutocompleteInput/hooks/useAutocomplete.js";
import type { EditorState, SlashCommand } from "../../../../source/components/AutocompleteInput/types.js";

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

const testCommands: SlashCommand[] = [
	{ name: "model", description: "Select model", children: [
		{ name: "gpt4", description: "GPT-4" },
		{ name: "claude", description: "Claude" },
	]},
	{ name: "session", description: "Session management" },
	{ name: "exit", description: "Exit app" },
];

describe("useAutocomplete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		effectCallbacks = [];
		effectCleanup = null;
		mockGetSuggestion.mockResolvedValue({ suggestion: "suggested" });
		mockIsSuggestionEnabled.mockReturnValue(true);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("normal mode", () => {
		it("should return null suggestion for empty input", () => {
			const state = createInitialState();
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.effectiveSuggestion).toBeNull();
		});

		it("should return null suggestion for short input", () => {
			const state = createInitialState({
				instance: {
					text: "ab",
					cursor: 2,
					type: "message",
					segments: [{ text: "ab", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.effectiveSuggestion).toBeNull();
		});

		it("should not show suggestion in history mode", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
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
				suggestion: "suggestion",
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.effectiveSuggestion).toBeNull();
		});

		it("should use state suggestion in normal mode", () => {
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
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.effectiveSuggestion).toBe("world");
		});
	});

	describe("slash mode", () => {
		it("should filter commands based on input", () => {
			const state = createInitialState({
				instance: {
					text: "/mo",
					cursor: 3,
					type: "command",
					segments: [{ text: "/mo", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.filteredCommands.length).toBe(1);
			expect(result.filteredCommands[0]!.name).toBe("model");
		});

		it("should return all commands when no filter", () => {
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
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.filteredCommands.length).toBe(3);
		});

		it("should return children commands when in nested path", () => {
			const state = createInitialState({
				instance: {
					text: "/model ",
					cursor: 7,
					type: "command",
					segments: [{ text: "/model ", color: "cyan" }],
					commandPath: ["model"],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.currentLevelCommands.length).toBe(2);
			expect(result.currentLevelCommands[0]!.name).toBe("gpt4");
		});

		it("should return empty when path leads nowhere", () => {
			const state = createInitialState({
				instance: {
					text: "/exit ",
					cursor: 6,
					type: "command",
					segments: [{ text: "/exit ", color: "cyan" }],
					commandPath: ["exit"],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// exit has no children
			expect(result.currentLevelCommands.length).toBe(0);
		});

		it("should provide slash suggestion", () => {
			const state = createInitialState({
				instance: {
					text: "/mo",
					cursor: 3,
					type: "command",
					segments: [{ text: "/mo", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.slashSuggestion).toBe("del"); // "model" - "mo" = "del"
		});

		it("should return null slash suggestion when fully typed", () => {
			const state = createInitialState({
				instance: {
					text: "/model",
					cursor: 6,
					type: "command",
					segments: [{ text: "/model", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.slashSuggestion).toBeNull();
		});

		it("should use slash suggestion as effective suggestion", () => {
			const state = createInitialState({
				instance: {
					text: "/ses",
					cursor: 4,
					type: "command",
					segments: [{ text: "/ses", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
				suggestion: "something else", // This should be ignored
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.effectiveSuggestion).toBe("sion"); // "session" - "ses" = "sion"
		});
	});

	describe("not in slash mode", () => {
		it("should return empty arrays when not in slash mode", () => {
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
				uiMode: { type: "normal" },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.currentLevelCommands).toEqual([]);
			expect(result.filteredCommands).toEqual([]);
			expect(result.slashSuggestion).toBeNull();
		});
	});

	describe("triggerAutocomplete via effects", () => {
		it("should trigger effect when input changes", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effect
			for (const callback of effectCallbacks) {
				const cleanup = callback();
				if (cleanup) effectCleanup = cleanup;
			}

			// Advance timer past debounce
			vi.advanceTimersByTime(20);
		});

		it("should not trigger AI for slash commands", () => {
			const state = createInitialState({
				instance: {
					text: "/model",
					cursor: 6,
					type: "command",
					segments: [{ text: "/model", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effects
			for (const callback of effectCallbacks) {
				callback();
			}

			vi.advanceTimersByTime(20);

			// Should set suggestion to null for slash mode
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_SUGGESTION",
				suggestion: null,
			});
		});

		it("should not trigger AI for file selection", () => {
			const state = createInitialState({
				instance: {
					text: "@src",
					cursor: 4,
					type: "message",
					segments: [{ text: "@src", color: "cyan" }],
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

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effects
			for (const callback of effectCallbacks) {
				callback();
			}

			vi.advanceTimersByTime(20);

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_SUGGESTION",
				suggestion: null,
			});
		});

		it("should not trigger AI when suggestion disabled", () => {
			mockIsSuggestionEnabled.mockReturnValue(false);

			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effects
			for (const callback of effectCallbacks) {
				callback();
			}

			vi.advanceTimersByTime(20);

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "SET_SUGGESTION",
				suggestion: null,
			});
		});

		it("should cancel AI request for short input", () => {
			const state = createInitialState({
				instance: {
					text: "ab",
					cursor: 2,
					type: "message",
					segments: [{ text: "ab", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effects
			for (const callback of effectCallbacks) {
				callback();
			}

			expect(mockCancel).toHaveBeenCalled();
		});
	});

	describe("cleanup", () => {
		it("should cancel pending request on unmount", () => {
			const state = createInitialState();

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run effects and get cleanup function
			for (const callback of effectCallbacks) {
				const cleanup = callback();
				if (cleanup) {
					cleanup(); // Simulate unmount
				}
			}

			expect(mockCancel).toHaveBeenCalled();
		});

		it("should clear debounce timer on unmount", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the first effect to start a debounced request
			for (const callback of effectCallbacks) {
				callback();
			}

			// Don't advance timers - there's a pending debounce
			// Now simulate unmount by running cleanup
			effectCallbacks = [];
			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			for (const callback of effectCallbacks) {
				const cleanup = callback();
				if (cleanup) {
					cleanup(); // Should clear debounce timer
				}
			}

			// The cancel should have been called
			expect(mockCancel).toHaveBeenCalled();
		});
	});

	describe("AI suggestion error handling", () => {
		it("should set suggestion to null when AI request fails", async () => {
			mockGetSuggestion.mockRejectedValue(new Error("API error"));

			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
			});

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effects
			for (const callback of effectCallbacks) {
				callback();
			}

			// Advance timer past debounce
			vi.advanceTimersByTime(20);

			// Wait for the promise to reject
			await vi.waitFor(() => {
				expect(mockDispatch).toHaveBeenCalledWith({
					type: "SET_SUGGESTION",
					suggestion: null,
				});
			});
		});
	});

	describe("case-insensitive command matching", () => {
		it("should match commands case-insensitively", () => {
			const state = createInitialState({
				instance: {
					text: "/MO",
					cursor: 3,
					type: "command",
					segments: [{ text: "/MO", color: "cyan" }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.filteredCommands.length).toBe(1);
			expect(result.filteredCommands[0]!.name).toBe("model");
		});

		it("should match path segments case-insensitively", () => {
			const state = createInitialState({
				instance: {
					text: "/model → g",
					cursor: 10,
					type: "command",
					segments: [{ text: "/model → g", color: "cyan" }],
					commandPath: ["model"],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.currentLevelCommands.length).toBe(2);
			expect(result.filteredCommands.length).toBe(1);
			expect(result.filteredCommands[0]!.name).toBe("gpt4");
		});
	});

	describe("nested path navigation", () => {
		it("should return empty when path does not exist", () => {
			const state = createInitialState({
				instance: {
					text: "/nonexistent ",
					cursor: 13,
					type: "command",
					segments: [{ text: "/nonexistent ", color: "cyan" }],
					commandPath: ["nonexistent"],
					filePath: [],
					selectedFiles: [],
				},
				uiMode: { type: "slash", selectedIndex: 0 },
			});
			const result = useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			expect(result.currentLevelCommands.length).toBe(0);
		});
	});

	describe("debounce timer handling", () => {
		it("should not trigger autocomplete in history browsing mode", () => {
			const state = createInitialState({
				instance: {
					text: "hello world",
					cursor: 11,
					type: "message",
					segments: [{ text: "hello world", color: undefined }],
					commandPath: [],
					filePath: [],
					selectedFiles: [],
				},
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

			useAutocomplete({
				state,
				dispatch: mockDispatch,
				slashCommands: testCommands,
			});

			// Run the effect
			for (const callback of effectCallbacks) {
				callback();
			}

			// Advance timers
			vi.advanceTimersByTime(50);

			// Should not call getSuggestion because we're in history mode
			expect(mockGetSuggestion).not.toHaveBeenCalled();
		});
	});
});
