import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectDocker,
	detectDockerCompose,
} from "../../../../source/services/tools/discoverers/docker.js";

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

describe("docker discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectDocker", () => {
		it("should return not installed tool when docker is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectDocker();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-docker");
		});

		it("should return installed tool when docker exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockResolvedValue("24.0.7");

			const result = await detectDocker();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/docker");
			expect(result.version).toBe("24.0.7");
		});

		it("should parse version from docker output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Docker version 24.0.7, build afdd53b");
				}
				return "24.0.7";
			});

			const result = await detectDocker();

			expect(result.version).toBe("24.0.7");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectDocker();

			expect(result.version).toBe("Unknown format");
		});

		it("should have container management actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockResolvedValue("24.0.7");

			const result = await detectDocker();

			expect(result.actions.some((a) => a.name === "ps")).toBe(true);
			expect(result.actions.some((a) => a.name === "images")).toBe(true);
			expect(result.actions.some((a) => a.name === "run")).toBe(true);
			expect(result.actions.some((a) => a.name === "build")).toBe(true);
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("24.0.7");

			const result = await detectDocker();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("docker");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/docker");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectDocker();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectDockerCompose", () => {
		it("should return not installed tool when docker is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectDockerCompose();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-dockercompose");
		});

		it("should return installed tool when docker compose exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockResolvedValue("2.23.0");

			const result = await detectDockerCompose();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("docker compose");
			expect(result.version).toBe("2.23.0");
		});

		it("should parse version from docker compose output with v prefix", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Docker Compose version v2.23.0");
				}
				return "2.23.0";
			});

			const result = await detectDockerCompose();

			expect(result.version).toBe("2.23.0");
		});

		it("should parse version without v prefix", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Docker Compose version 2.24.1");
				}
				return "2.24.1";
			});

			const result = await detectDockerCompose();

			expect(result.version).toBe("2.24.1");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectDockerCompose();

			expect(result.version).toBe("Unknown format");
		});

		it("should return not installed when version is null", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectDockerCompose();

			expect(result.installed).toBe(false);
		});

		it("should have compose service actions", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getVersion).mockResolvedValue("2.23.0");

			const result = await detectDockerCompose();

			expect(result.actions.some((a) => a.name === "up")).toBe(true);
			expect(result.actions.some((a) => a.name === "down")).toBe(true);
			expect(result.actions.some((a) => a.name === "logs")).toBe(true);
		});
	});
});
