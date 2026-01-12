import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectNode,
	detectNvm,
	detectNpm,
} from "../../../../source/services/tools/discoverers/node.js";

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

describe("node discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectNode", () => {
		it("should return not installed tool when node is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectNode();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-node");
		});

		it("should return installed tool when node exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockResolvedValue("20.10.0");

			const result = await detectNode();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/node");
			expect(result.version).toBe("20.10.0");
		});

		it("should strip v prefix from version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("v20.10.0");
				}
				return "20.10.0";
			});

			const result = await detectNode();

			expect(result.version).toBe("20.10.0");
		});

		it("should have node actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockResolvedValue("20.10.0");

			const result = await detectNode();

			expect(result.actions.some((a) => a.name === "run")).toBe(true);
			expect(result.actions.some((a) => a.name === "eval")).toBe(true);
			expect(result.actions.some((a) => a.name === "version")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("20.10.0");

			const result = await detectNode();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("node");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/node");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectNode();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectNvm", () => {
		it("should return not installed tool when nvm is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectNvm();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-nvm");
		});

		it("should return installed tool when nvm exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/local/bin/nvm");
			vi.mocked(getVersion).mockResolvedValue("1.1.12");

			const result = await detectNvm();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/local/bin/nvm");
			expect(result.version).toBe("1.1.12");
		});

		it("should trim version output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/local/bin/nvm");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("  1.1.12  \n");
				}
				return "1.1.12";
			});

			const result = await detectNvm();

			expect(result.version).toBe("1.1.12");
		});

		it("should have nvm actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/local/bin/nvm");
			vi.mocked(getVersion).mockResolvedValue("1.1.12");

			const result = await detectNvm();

			expect(result.actions.some((a) => a.name === "list")).toBe(true);
			expect(result.actions.some((a) => a.name === "use")).toBe(true);
			expect(result.actions.some((a) => a.name === "install")).toBe(true);
			expect(result.actions.some((a) => a.name === "current")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("1.1.12");

			const result = await detectNvm();

			expect(result.executablePath).toBe("nvm");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/local/bin/nvm");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectNvm();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectNpm", () => {
		it("should return not installed tool when npm is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectNpm();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-npm");
		});

		it("should return installed tool when npm exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/npm");
			vi.mocked(getVersion).mockResolvedValue("10.2.5");

			const result = await detectNpm();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/npm");
			expect(result.version).toBe("10.2.5");
		});

		it("should have npm actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/npm");
			vi.mocked(getVersion).mockResolvedValue("10.2.5");

			const result = await detectNpm();

			expect(result.actions.some((a) => a.name === "install")).toBe(true);
			expect(result.actions.some((a) => a.name === "run")).toBe(true);
			expect(result.actions.some((a) => a.name === "list")).toBe(true);
			expect(result.actions.some((a) => a.name === "outdated")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("10.2.5");

			const result = await detectNpm();

			expect(result.executablePath).toBe("npm");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/npm");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectNpm();

			expect(result.version).toBeUndefined();
		});
	});
});
