import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectPython } from "../../../../source/services/tools/discoverers/python.js";

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

describe("python discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectPython", () => {
		it("should return not installed tool when python is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectPython();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("python");
		});

		it("should detect python3 first if available", async () => {
			vi.mocked(commandExists).mockImplementation(async (cmd) => cmd === "python3");
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python3");
			vi.mocked(getVersion).mockResolvedValue("Python 3.11.0");

			const result = await detectPython();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/python3");
		});

		it("should fallback to python if python3 not found", async () => {
			vi.mocked(commandExists).mockImplementation(async (cmd) => cmd === "python");
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python");
			vi.mocked(getVersion).mockResolvedValue("Python 3.9.0");

			const result = await detectPython();

			expect(result.installed).toBe(true);
		});

		it("should have run_script_content action", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python3");
			vi.mocked(getVersion).mockResolvedValue("Python 3.11.0");

			const result = await detectPython();

			expect(result.actions.some((a) => a.name === "run_script_content")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("3.11.0");

			const result = await detectPython();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("python");
		});

		it("should parse version from python output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python3");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Python 3.11.5");
				}
				return "3.11.5";
			});

			const result = await detectPython();

			expect(result.version).toBe("3.11.5");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python3");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectPython();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/python3");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectPython();

			expect(result.version).toBeUndefined();
		});
	});
});
