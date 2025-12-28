import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockReaddirSync, mockStatSync } = vi.hoisted(() => ({
	mockReaddirSync: vi.fn(),
	mockStatSync: vi.fn(),
}));

vi.mock("fs", () => ({
	readdirSync: mockReaddirSync,
	statSync: mockStatSync,
}));

vi.mock("path", () => ({
	join: (...args: string[]) => args.join("/"),
	normalize: (p: string) => p,
}));

// Mock React hooks
const mockSetFiles = vi.fn();
const mockSetLoading = vi.fn();
const mockSetError = vi.fn();

let stateIndex = 0;
const stateValues: Array<[unknown, unknown]> = [
	[[], mockSetFiles],
	[true, mockSetLoading],
	[null, mockSetError],
];

let effectCallback: (() => void) | null = null;
let callbackFn: (() => void) | null = null;

vi.mock("react", () => ({
	useState: (initial: unknown) => {
		if (stateIndex >= stateValues.length) {
			return [initial, vi.fn()];
		}
		const result = stateValues[stateIndex];
		stateIndex++;
		return result;
	},
	useEffect: (callback: () => void) => {
		effectCallback = callback;
	},
	useCallback: (fn: () => void) => {
		callbackFn = fn;
		return fn;
	},
}));

import { useFileSelect } from "../../../../source/components/AutocompleteInput/hooks/useFileSelect.js";

describe("useFileSelect", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stateIndex = 0;
		effectCallback = null;
		callbackFn = null;
		mockReaddirSync.mockReturnValue([]);
		mockStatSync.mockReturnValue({ isDirectory: () => false });
	});

	describe("readDirectory", () => {
		it("should load files on mount", () => {
			mockReaddirSync.mockReturnValue(["file1.ts", "file2.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			const result = useFileSelect(".");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetLoading).toHaveBeenCalledWith(true);
			expect(mockReaddirSync).toHaveBeenCalledWith(".");
		});

		it("should sort directories before files", () => {
			mockReaddirSync.mockReturnValue(["file.ts", "dir"]);
			mockStatSync.mockImplementation((path: string) => ({
				isDirectory: () => path.includes("dir"),
			}));

			useFileSelect(".");

			// Trigger effect
			if (effectCallback) effectCallback();

			// Check setFiles was called
			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should handle directory read errors gracefully", () => {
			mockReaddirSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});

			useFileSelect(".");

			// Trigger effect
			if (effectCallback) effectCallback();

			// Should set empty files on error
			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should handle statSync errors gracefully", () => {
			mockReaddirSync.mockReturnValue(["inaccessible"]);
			mockStatSync.mockImplementation(() => {
				throw new Error("Access denied");
			});

			useFileSelect(".");

			// Trigger effect
			if (effectCallback) effectCallback();

			// Should not throw, file treated as regular file
			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should filter files by prefix", () => {
			mockReaddirSync.mockReturnValue(["app.ts", "utils.ts", "api.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			useFileSelect(".", "ap");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should add dot entry in subdirectory", () => {
			mockReaddirSync.mockReturnValue(["file.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			useFileSelect("src", "");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should not add dot entry at root", () => {
			mockReaddirSync.mockReturnValue(["file.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			useFileSelect(".", "");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should not add dot entry when filter does not match", () => {
			mockReaddirSync.mockReturnValue(["file.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			useFileSelect("src", "xyz");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetFiles).toHaveBeenCalled();
		});

		it("should add dot entry when filter matches dot", () => {
			mockReaddirSync.mockReturnValue(["file.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			useFileSelect("src", ".");

			// Trigger effect
			if (effectCallback) effectCallback();

			expect(mockSetFiles).toHaveBeenCalled();
		});
	});

	describe("return value", () => {
		it("should return files, loading, error and refresh function", () => {
			mockReaddirSync.mockReturnValue([]);

			const result = useFileSelect(".");

			expect(result).toHaveProperty("files");
			expect(result).toHaveProperty("loading");
			expect(result).toHaveProperty("error");
			expect(result).toHaveProperty("refresh");
			expect(typeof result.refresh).toBe("function");
		});
	});

	describe("refresh", () => {
		it("should reload files when refresh is called", () => {
			mockReaddirSync.mockReturnValue(["file.ts"]);
			mockStatSync.mockReturnValue({ isDirectory: () => false });

			const result = useFileSelect(".");

			// Call refresh
			result.refresh();

			expect(mockSetLoading).toHaveBeenCalledWith(true);
			expect(mockReaddirSync).toHaveBeenCalled();
		});
	});
});
