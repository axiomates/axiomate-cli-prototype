import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectCmd } from "../../../../source/services/tools/discoverers/cmd.js";

// Mock os module
vi.mock("node:os", () => ({
	platform: vi.fn(() => "win32"),
}));

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	commandExists: vi.fn(),
	getExecutablePath: vi.fn(),
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

import { platform } from "node:os";
import {
	commandExists,
	getExecutablePath,
} from "../../../../source/services/tools/discoverers/base.js";

describe("cmd discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(platform).mockReturnValue("win32");
	});

	describe("detectCmd", () => {
		it("should return not installed tool when not on Windows", async () => {
			vi.mocked(platform).mockReturnValue("linux");

			const result = await detectCmd();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-cmd");
		});

		it("should return not installed tool when cmd is not found on Windows", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectCmd();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-cmd");
		});

		it("should return installed tool when cmd exists on Windows", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(
				"C:\\Windows\\System32\\cmd.exe",
			);

			const result = await detectCmd();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("C:\\Windows\\System32\\cmd.exe");
		});

		it("should handle null executable path", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);

			const result = await detectCmd();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("cmd");
		});

		it("should have run_script_content and version actions", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("cmd");

			const result = await detectCmd();

			expect(result.actions.some((a) => a.name === "run_script_content")).toBe(
				true,
			);
			expect(result.actions.some((a) => a.name === "version")).toBe(true);
		});

		it("should not set version (CMD version not easily retrievable)", async () => {
			vi.mocked(platform).mockReturnValue("win32");
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("cmd");

			const result = await detectCmd();

			expect(result.version).toBeUndefined();
		});
	});
});
