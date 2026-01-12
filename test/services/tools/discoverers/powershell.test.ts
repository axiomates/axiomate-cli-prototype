import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectPowershell,
	detectPwsh,
} from "../../../../source/services/tools/discoverers/powershell.js";

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

describe("powershell discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectPowershell", () => {
		it("should return not installed tool when powershell is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectPowershell();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-powershell");
		});

		it("should return installed tool when powershell exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(
				"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
			);
			vi.mocked(getVersion).mockResolvedValue("5.1.22621.4391");

			const result = await detectPowershell();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
			);
			expect(result.version).toBe("5.1.22621.4391");
		});

		it("should parse version from powershell output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("powershell");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("  5.1.22621.4391  ");
				}
				return "5.1.22621.4391";
			});

			const result = await detectPowershell();

			expect(result.version).toBe("5.1.22621.4391");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("5.1.22621.4391");

			const result = await detectPowershell();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("powershell");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("powershell");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectPowershell();

			expect(result.installed).toBe(true);
			expect(result.version).toBeUndefined();
		});

		it("should have run_script_content action", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("powershell");
			vi.mocked(getVersion).mockResolvedValue("5.1.22621.4391");

			const result = await detectPowershell();

			expect(result.actions.some((a) => a.name === "run_script_content")).toBe(
				true,
			);
			expect(result.actions.some((a) => a.name === "version")).toBe(true);
		});
	});

	describe("detectPwsh", () => {
		it("should return not installed tool when pwsh is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectPwsh();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-c-pwsh");
		});

		it("should return installed tool when pwsh exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(
				"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
			);
			vi.mocked(getVersion).mockResolvedValue("7.4.1");

			const result = await detectPwsh();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
			);
			expect(result.version).toBe("7.4.1");
		});

		it("should parse version from pwsh --version output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("pwsh");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("PowerShell 7.4.1");
				}
				return "7.4.1";
			});

			const result = await detectPwsh();

			expect(result.version).toBe("7.4.1");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("pwsh");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectPwsh();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("7.4.1");

			const result = await detectPwsh();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("pwsh");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("pwsh");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectPwsh();

			expect(result.installed).toBe(true);
			expect(result.version).toBeUndefined();
		});
	});
});
