import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectBash } from "../../../../source/services/tools/discoverers/bash.js";

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

describe("bash discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectBash", () => {
		it("should return not installed tool when bash is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectBash();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-bash");
		});

		it("should return installed tool when bash exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/bin/bash");
			vi.mocked(getVersion).mockResolvedValue("5.1.16");

			const result = await detectBash();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/bin/bash");
			expect(result.version).toBe("5.1.16");
		});

		it("should parse version from GNU bash output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/bin/bash");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"GNU bash, version 5.1.16(1)-release (x86_64-pc-linux-gnu)",
					);
				}
				return "5.1.16";
			});

			const result = await detectBash();

			expect(result.version).toBe("5.1.16");
		});

		it("should handle version output without version pattern", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/bin/bash");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Some unknown format\nSecond line");
				}
				return "unknown";
			});

			const result = await detectBash();

			expect(result.version).toBe("Some unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("5.1.16");

			const result = await detectBash();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("bash");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/bin/bash");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectBash();

			expect(result.installed).toBe(true);
			expect(result.version).toBeUndefined();
		});

		it("should have run_script_content action", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/bin/bash");
			vi.mocked(getVersion).mockResolvedValue("5.1.16");

			const result = await detectBash();

			expect(result.actions.some((a) => a.name === "run_script_content")).toBe(
				true,
			);
			expect(result.actions.some((a) => a.name === "version")).toBe(true);
		});
	});
});
