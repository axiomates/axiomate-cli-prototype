import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectBeyondCompare } from "../../../../source/services/tools/discoverers/beyondcompare.js";

// Mock fs module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => false),
}));

// Mock os module
vi.mock("node:os", () => ({
	platform: vi.fn(() => "win32"),
}));

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	queryRegistry: vi.fn(),
	fileExists: vi.fn(),
	createInstalledTool: vi.fn((def, path, version) => ({
		...def,
		executablePath: path,
		version,
		installed: true,
	})),
	createNotInstalledTool: vi.fn((def) => ({
		...def,
		executablePath: "",
		installed: false,
	})),
}));

import * as os from "node:os";
import {
	queryRegistry,
	fileExists,
} from "../../../../source/services/tools/discoverers/base.js";

describe("beyondcompare discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(os.platform).mockReturnValue("win32");
		vi.mocked(fileExists).mockReturnValue(false);
	});

	describe("detectBeyondCompare", () => {
		it("should return not installed tool when not on Windows", async () => {
			vi.mocked(os.platform).mockReturnValue("linux");
			// Re-import to get updated isWindows
			vi.resetModules();
			const { detectBeyondCompare: detect } =
				await import("../../../../source/services/tools/discoverers/beyondcompare.js");

			const result = await detect();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-beyondcompare");
		});

		it("should detect from registry path BC4", async () => {
			vi.mocked(queryRegistry).mockImplementation(async (regPath) => {
				if (regPath.includes("Beyond Compare 4")) {
					return "C:\\Program Files\\Beyond Compare 4\\BComp.exe";
				}
				return null;
			});
			vi.mocked(fileExists).mockImplementation((p) => {
				return p === "C:\\Program Files\\Beyond Compare 4\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Beyond Compare 4\\BComp.exe",
			);
			expect(result.version).toBe("4");
		});

		it("should detect from registry path BC5", async () => {
			vi.mocked(queryRegistry).mockImplementation(async (regPath) => {
				if (regPath.includes("Beyond Compare 5")) {
					return "C:\\Program Files\\Beyond Compare 5\\BComp.exe";
				}
				return null;
			});
			vi.mocked(fileExists).mockImplementation((p) => {
				return p === "C:\\Program Files\\Beyond Compare 5\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Beyond Compare 5\\BComp.exe",
			);
			expect(result.version).toBe("5");
		});

		it("should fallback to default paths when registry fails", async () => {
			vi.mocked(queryRegistry).mockResolvedValue(null);
			vi.mocked(fileExists).mockImplementation((p) => {
				return p === "C:\\Program Files\\Beyond Compare 4\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Beyond Compare 4\\BComp.exe",
			);
			expect(result.version).toBe("4");
		});

		it("should find BC5 in default paths", async () => {
			vi.mocked(queryRegistry).mockResolvedValue(null);
			vi.mocked(fileExists).mockImplementation((p) => {
				return p === "C:\\Program Files\\Beyond Compare 5\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(true);
			expect(result.version).toBe("5");
		});

		it("should return not installed when not found anywhere", async () => {
			vi.mocked(queryRegistry).mockResolvedValue(null);
			vi.mocked(fileExists).mockReturnValue(false);

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(false);
		});

		it("should skip registry path if file does not exist", async () => {
			vi.mocked(queryRegistry).mockResolvedValue("C:\\NonExistent\\BComp.exe");
			vi.mocked(fileExists).mockImplementation((p) => {
				// Registry path doesn't exist, but default path does
				return p === "C:\\Program Files\\Beyond Compare 4\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Beyond Compare 4\\BComp.exe",
			);
		});

		it("should have diff, merge and folder_sync actions", async () => {
			vi.mocked(queryRegistry).mockResolvedValue(null);
			vi.mocked(fileExists).mockImplementation((p) => {
				return p === "C:\\Program Files\\Beyond Compare 4\\BComp.exe";
			});

			const result = await detectBeyondCompare();

			expect(result.actions.some((a) => a.name === "diff")).toBe(true);
			expect(result.actions.some((a) => a.name === "merge")).toBe(true);
			expect(result.actions.some((a) => a.name === "folder_sync")).toBe(true);
		});
	});
});
