import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectCmake,
	detectGradle,
	detectMaven,
} from "../../../../source/services/tools/discoverers/build.js";

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

describe("build discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectCmake", () => {
		it("should return not installed tool when cmake is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectCmake();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-cmake");
		});

		it("should return installed tool when cmake exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/cmake");
			vi.mocked(getVersion).mockResolvedValue("3.28.1");

			const result = await detectCmake();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/cmake");
			expect(result.version).toBe("3.28.1");
		});

		it("should parse version from cmake output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/cmake");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("cmake version 3.28.1\nCMake suite...");
				}
				return "3.28.1";
			});

			const result = await detectCmake();

			expect(result.version).toBe("3.28.1");
		});

		it("should use first line when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/cmake");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format\nSecond line");
				}
				return "Unknown";
			});

			const result = await detectCmake();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("3.28.1");

			const result = await detectCmake();

			expect(result.executablePath).toBe("cmake");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/cmake");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectCmake();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectGradle", () => {
		it("should return not installed tool when gradle is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectGradle();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-gradle");
		});

		it("should return installed tool when gradle exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/gradle");
			vi.mocked(getVersion).mockResolvedValue("8.5");

			const result = await detectGradle();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/gradle");
			expect(result.version).toBe("8.5");
		});

		it("should parse version from gradle output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/gradle");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"------------------------------------------------------------\nGradle 8.5\n------------------------------------------------------------",
					);
				}
				return "8.5";
			});

			const result = await detectGradle();

			expect(result.version).toBe("8.5");
		});

		it("should use first line when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/gradle");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format\nSecond line");
				}
				return "Unknown";
			});

			const result = await detectGradle();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("8.5");

			const result = await detectGradle();

			expect(result.executablePath).toBe("gradle");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/gradle");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectGradle();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectMaven", () => {
		it("should return not installed tool when mvn is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectMaven();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-maven");
		});

		it("should return installed tool when mvn exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mvn");
			vi.mocked(getVersion).mockResolvedValue("3.9.6");

			const result = await detectMaven();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/mvn");
			expect(result.version).toBe("3.9.6");
		});

		it("should parse version from mvn output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mvn");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"Apache Maven 3.9.6 (bc0240f3c744dd6b6ec2920b3cd08dcc295161ae)",
					);
				}
				return "3.9.6";
			});

			const result = await detectMaven();

			expect(result.version).toBe("3.9.6");
		});

		it("should use first line when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mvn");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format\nSecond line");
				}
				return "Unknown";
			});

			const result = await detectMaven();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("3.9.6");

			const result = await detectMaven();

			expect(result.executablePath).toBe("mvn");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mvn");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectMaven();

			expect(result.version).toBeUndefined();
		});
	});
});
