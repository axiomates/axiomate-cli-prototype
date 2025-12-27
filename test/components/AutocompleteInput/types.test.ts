import { describe, it, expect } from "vitest";
import {
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isFileMode,
	isHelpMode,
	buildCommandText,
	type UIMode,
} from "../../../source/components/AutocompleteInput/types.js";

describe("AutocompleteInput types", () => {
	describe("isNormalMode", () => {
		it("should return true for normal mode", () => {
			const mode: UIMode = { type: "normal" };
			expect(isNormalMode(mode)).toBe(true);
		});

		it("should return false for other modes", () => {
			expect(isNormalMode({ type: "help" })).toBe(false);
			expect(isNormalMode({ type: "slash", selectedIndex: 0 })).toBe(false);
		});
	});

	describe("isHistoryMode", () => {
		it("should return true for history mode", () => {
			const mode: UIMode = {
				type: "history",
				index: 0,
				savedEntry: { text: "", commandPath: [], filePath: [], selectedFiles: [] },
			};
			expect(isHistoryMode(mode)).toBe(true);
		});

		it("should return false for other modes", () => {
			expect(isHistoryMode({ type: "normal" })).toBe(false);
		});

		it("should narrow type correctly", () => {
			const mode: UIMode = {
				type: "history",
				index: 5,
				savedEntry: { text: "test", commandPath: [], filePath: [], selectedFiles: [] },
			};
			if (isHistoryMode(mode)) {
				expect(mode.index).toBe(5);
				expect(mode.savedEntry.text).toBe("test");
			}
		});
	});

	describe("isSlashMode", () => {
		it("should return true for slash mode", () => {
			const mode: UIMode = { type: "slash", selectedIndex: 0 };
			expect(isSlashMode(mode)).toBe(true);
		});

		it("should return false for other modes", () => {
			expect(isSlashMode({ type: "normal" })).toBe(false);
			expect(isSlashMode({ type: "help" })).toBe(false);
		});

		it("should narrow type correctly", () => {
			const mode: UIMode = { type: "slash", selectedIndex: 3 };
			if (isSlashMode(mode)) {
				expect(mode.selectedIndex).toBe(3);
			}
		});
	});

	describe("isFileMode", () => {
		it("should return true for file mode", () => {
			const mode: UIMode = {
				type: "file",
				selectedIndex: 0,
				atPosition: 5,
				prefix: "hello ",
				suffix: "",
			};
			expect(isFileMode(mode)).toBe(true);
		});

		it("should return false for other modes", () => {
			expect(isFileMode({ type: "normal" })).toBe(false);
		});

		it("should narrow type correctly", () => {
			const mode: UIMode = {
				type: "file",
				selectedIndex: 2,
				atPosition: 10,
				prefix: "test ",
				suffix: " end",
			};
			if (isFileMode(mode)) {
				expect(mode.selectedIndex).toBe(2);
				expect(mode.atPosition).toBe(10);
				expect(mode.prefix).toBe("test ");
				expect(mode.suffix).toBe(" end");
			}
		});
	});

	describe("isHelpMode", () => {
		it("should return true for help mode", () => {
			const mode: UIMode = { type: "help" };
			expect(isHelpMode(mode)).toBe(true);
		});

		it("should return false for other modes", () => {
			expect(isHelpMode({ type: "normal" })).toBe(false);
			expect(isHelpMode({ type: "slash", selectedIndex: 0 })).toBe(false);
		});
	});

	describe("buildCommandText", () => {
		it("should build command text from empty path", () => {
			const result = buildCommandText([]);
			expect(result).toBe("/");
		});

		it("should build command text from single segment", () => {
			const result = buildCommandText(["model"]);
			expect(result).toBe("/model");
		});

		it("should build command text from multiple segments", () => {
			const result = buildCommandText(["session", "switch"]);
			expect(result).toBe("/session → switch");
		});

		it("should add trailing space when withTrailingSpace is true", () => {
			const result = buildCommandText(["model"], true);
			expect(result).toBe("/model → ");
		});

		it("should not add trailing space when withTrailingSpace is false", () => {
			const result = buildCommandText(["model"], false);
			expect(result).toBe("/model");
		});
	});
});
