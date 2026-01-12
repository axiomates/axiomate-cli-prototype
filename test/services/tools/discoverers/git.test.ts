import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectGit } from "../../../../source/services/tools/discoverers/git.js";

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

describe("git discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectGit", () => {
		it("should return not installed tool when git is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectGit();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-git");
		});

		it("should return installed tool when git exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/git");
			vi.mocked(getVersion).mockResolvedValue("2.43.0");

			const result = await detectGit();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/git");
			expect(result.version).toBe("2.43.0");
		});

		it("should parse version from git output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("C:\\Git\\bin\\git.exe");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("git version 2.43.0.windows.1");
				}
				return "git version 2.43.0.windows.1";
			});

			const result = await detectGit();

			expect(result.installed).toBe(true);
			expect(result.version).toBe("2.43.0");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("2.43.0");

			const result = await detectGit();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("git");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/git");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectGit();

			expect(result.installed).toBe(true);
			expect(result.version).toBeUndefined();
		});

		it("should have correct tool definition", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/git");
			vi.mocked(getVersion).mockResolvedValue("2.43.0");

			const result = await detectGit();

			expect(result.name).toBe("Git");
			expect(result.category).toBe("vcs");
			expect(result.actions.length).toBeGreaterThan(0);
			expect(result.actions.some((a) => a.name === "status")).toBe(true);
			expect(result.actions.some((a) => a.name === "commit")).toBe(true);
		});

		it("should return fallback version when parsing fails", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/git");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("unknown format");
				}
				return "unknown format";
			});

			const result = await detectGit();

			expect(result.installed).toBe(true);
			// When version parsing fails, it returns the original output
			expect(result.version).toBe("unknown format");
		});
	});
});
