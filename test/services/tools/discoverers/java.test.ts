import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectJava,
	detectJavac,
} from "../../../../source/services/tools/discoverers/java.js";

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

describe("java discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectJava", () => {
		it("should return not installed tool when java is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectJava();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-java");
		});

		it("should return installed tool when java exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/java");
			vi.mocked(getVersion).mockResolvedValue("21.0.1");

			const result = await detectJava();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/java");
			expect(result.version).toBe("21.0.1");
		});

		it("should parse version from openjdk output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/java");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput('openjdk version "21.0.1" 2023-10-17');
				}
				return "21.0.1";
			});

			const result = await detectJava();

			expect(result.version).toBe("21.0.1");
		});

		it("should parse version from java 1.8 output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/java");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput('java version "1.8.0_391"');
				}
				return "1.8.0_391";
			});

			const result = await detectJava();

			expect(result.version).toBe("1.8.0");
		});

		it("should use first line when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/java");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Some unknown format\nSecond line");
				}
				return "unknown";
			});

			const result = await detectJava();

			expect(result.version).toBe("Some unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("21.0.1");

			const result = await detectJava();

			expect(result.executablePath).toBe("java");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/java");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectJava();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectJavac", () => {
		it("should return not installed tool when javac is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectJavac();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-javac");
		});

		it("should return installed tool when javac exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/javac");
			vi.mocked(getVersion).mockResolvedValue("21.0.1");

			const result = await detectJavac();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/javac");
			expect(result.version).toBe("21.0.1");
		});

		it("should parse version from javac output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/javac");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("javac 21.0.1");
				}
				return "21.0.1";
			});

			const result = await detectJavac();

			expect(result.version).toBe("21.0.1");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/javac");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectJavac();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("21.0.1");

			const result = await detectJavac();

			expect(result.executablePath).toBe("javac");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/javac");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectJavac();

			expect(result.version).toBeUndefined();
		});
	});
});
