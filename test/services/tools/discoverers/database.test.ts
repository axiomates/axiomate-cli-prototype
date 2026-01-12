import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectMysql,
	detectPsql,
	detectSqlite,
} from "../../../../source/services/tools/discoverers/database.js";

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

describe("database discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectMysql", () => {
		it("should return not installed tool when mysql is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectMysql();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-mysql");
		});

		it("should return installed tool when mysql exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mysql");
			vi.mocked(getVersion).mockResolvedValue("8.0.35");

			const result = await detectMysql();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/mysql");
			expect(result.version).toBe("8.0.35");
		});

		it("should parse version from mysql output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mysql");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"mysql  Ver 8.0.35 for Linux on x86_64 (MySQL Community Server - GPL)",
					);
				}
				return "8.0.35";
			});

			const result = await detectMysql();

			expect(result.version).toBe("8.0.35");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mysql");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectMysql();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("8.0.35");

			const result = await detectMysql();

			expect(result.executablePath).toBe("mysql");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/mysql");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectMysql();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectPsql", () => {
		it("should return not installed tool when psql is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectPsql();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-psql");
		});

		it("should return installed tool when psql exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/psql");
			vi.mocked(getVersion).mockResolvedValue("16.1");

			const result = await detectPsql();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/psql");
			expect(result.version).toBe("16.1");
		});

		it("should parse version from psql output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/psql");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("psql (PostgreSQL) 16.1");
				}
				return "16.1";
			});

			const result = await detectPsql();

			expect(result.version).toBe("16.1");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/psql");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectPsql();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("16.1");

			const result = await detectPsql();

			expect(result.executablePath).toBe("psql");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/psql");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectPsql();

			expect(result.version).toBeUndefined();
		});
	});

	describe("detectSqlite", () => {
		it("should return not installed tool when sqlite3 is not found", async () => {
			vi.mocked(commandExists).mockResolvedValue(false);

			const result = await detectSqlite();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-sqlite3");
		});

		it("should return installed tool when sqlite3 exists", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/sqlite3");
			vi.mocked(getVersion).mockResolvedValue("3.44.2");

			const result = await detectSqlite();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe("/usr/bin/sqlite3");
			expect(result.version).toBe("3.44.2");
		});

		it("should parse version from sqlite3 output", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/sqlite3");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"3.44.2 2023-11-24 11:41:44 ebead0e7230cd33bcec9f95d2183069565b9e709bf745c9b5db65cc0cbf92c0f",
					);
				}
				return "3.44.2";
			});

			const result = await detectSqlite();

			expect(result.version).toBe("3.44.2");
		});

		it("should return raw output when version pattern not matched", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/sqlite3");
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput("Unknown format");
				}
				return "Unknown";
			});

			const result = await detectSqlite();

			expect(result.version).toBe("Unknown format");
		});

		it("should handle null executable path", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue(null);
			vi.mocked(getVersion).mockResolvedValue("3.44.2");

			const result = await detectSqlite();

			expect(result.executablePath).toBe("sqlite3");
		});

		it("should handle null version", async () => {
			vi.mocked(commandExists).mockResolvedValue(true);
			vi.mocked(getExecutablePath).mockResolvedValue("/usr/bin/sqlite3");
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectSqlite();

			expect(result.version).toBeUndefined();
		});
	});
});
