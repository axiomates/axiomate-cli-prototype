import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectVscode } from "../../../../source/services/tools/discoverers/vscode.js";

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	commandExists: vi.fn(),
	getExecutablePath: vi.fn(),
	getVersion: vi.fn(),
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

import {
	commandExists,
	getExecutablePath,
	getVersion,
} from "../../../../source/services/tools/discoverers/base.js";

describe("vscode discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectVscode", () => {
		it("should return not installed tool when code is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectVscode();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-vscode");
		});

		it("should return installed tool when code exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/code");
			vi.mocked(getVersion).mockResolvedValue("1.85.2");

			const result = await detectVscode();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/code");
			expect(result.version).toBe("1.85.2");
		});

		it("should parse version from first line of output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/code");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"1.85.2\n2ccd690cbff1569e4a83d7c43d45101f817401dc\nx64",
					);
				}
				return "1.85.2";
			});

			const result = await detectVscode();

			expect(result.version).toBe("1.85.2");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("1.85.2");

			const result = await detectVscode();

			expect(result.executablePath).toBe("code");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/code");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectVscode();

			expect(result.version).toBeUndefined();
		});

		it("should have open and diff actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/code");
			vi.mocked(getVersion).mockResolvedValue("1.85.2");

			const result = await detectVscode();

			expect(result.actions.some((a) => a.name === "open")).toBe(true);
			expect(result.actions.some((a) => a.name === "diff")).toBe(true);
		});
	});
});
