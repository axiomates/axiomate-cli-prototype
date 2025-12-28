import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "child_process";

// Mock dependencies
vi.mock("child_process", () => ({
	execSync: vi.fn(),
	spawn: vi.fn(() => ({
		on: vi.fn((event, callback) => {
			if (event === "close") {
				setTimeout(callback, 0);
			}
		}),
	})),
}));

vi.mock("fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	copyFileSync: vi.fn(),
}));

vi.mock("os", () => ({
	platform: vi.fn(() => "win32"),
}));

import * as fs from "fs";
import * as os from "os";
import { initPlatform, restartApp } from "../../source/utils/platform.js";

describe("platform", () => {
	const originalExecPath = process.execPath;
	const originalArgv = process.argv;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset process properties
		Object.defineProperty(process, "execPath", {
			value: "C:\\Program Files\\axiomate\\axiomate.exe",
			writable: true,
		});
		Object.defineProperty(process, "argv", {
			value: ["node", "script.js"],
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(process, "execPath", {
			value: originalExecPath,
			writable: true,
		});
		Object.defineProperty(process, "argv", {
			value: originalArgv,
			writable: true,
		});
	});

	describe("initPlatform", () => {
		it("should return false on non-Windows platform", () => {
			vi.mocked(os.platform).mockReturnValue("linux");

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when running under node (not packaged)", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			Object.defineProperty(process, "execPath", {
				value: "C:\\Program Files\\nodejs\\node.exe",
				writable: true,
			});

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when settings file not found", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should return false when profile already up to date", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{a010a7e0-c110-4a99-b07b-9f0f11e00000}",
								name: "axiomate",
								commandline: "C:\\Program Files\\axiomate\\axiomate.exe",
								icon: "C:\\Program Files\\axiomate\\axiomate.exe",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(false);
			expect(fs.writeFileSync).not.toHaveBeenCalled();
		});

		it("should update settings when profile needs update", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
			expect(fs.copyFileSync).toHaveBeenCalled(); // Backup
			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it("should handle JSON with comments", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				// This is a comment
				"profiles": {
					"list": [] // Trailing comment
				}
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle settings without profiles section", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("{}");

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should update existing profile with legacy GUID", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{a]x1om4te-c1i0-4app-b0th-pr0f1leguid0}",
								name: "axiomate",
								commandline: "old-path",
								icon: "old-icon",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should return false on parse error", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json {");

			const result = initPlatform();

			expect(result).toBe(false);
		});

		it("should handle profiles with null list", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle multi-line comments in JSON", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				/* Multi-line
				   comment */
				"profiles": {
					"list": []
				}
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should handle trailing commas in JSON", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`{
				"profiles": {
					"list": [],
				},
			}`);

			const result = initPlatform();

			expect(result).toBe(true);
		});

		it("should update existing profile found by name", () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					profiles: {
						list: [
							{
								guid: "{some-other-guid}",
								name: "axiomate",
								commandline: "old-path",
								icon: "old-icon",
							},
						],
					},
				}),
			);

			const result = initPlatform();

			expect(result).toBe(true);
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("restartApp", () => {
		const originalExit = process.exit;
		let exitMock: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			exitMock = vi.fn();
			process.exit = exitMock as unknown as typeof process.exit;
		});

		afterEach(() => {
			process.exit = originalExit;
		});

		it("should spawn wt.exe on Windows when available", async () => {
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("wt.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			const promise = restartApp();

			// Allow spawn callback to execute
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"wt.exe",
				expect.arrayContaining(["-d"]),
				expect.any(Object),
			);
		});

		it("should spawn powershell on Windows when wt not available", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("powershell.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			// Import fresh to reset restartPromise
			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"powershell.exe",
				expect.arrayContaining(["-Command"]),
				expect.any(Object),
			);
		});

		it("should spawn cmd.exe on Windows when neither wt nor powershell available", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			// All commands throw - falls back to cmd
			vi.mocked(childProcess.execSync).mockImplementation(() => {
				throw new Error("not found");
			});

			// Import fresh to reset restartPromise
			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"cmd.exe",
				expect.arrayContaining(["/C"]),
				expect.any(Object),
			);
		});

		it("should use execPath with args on Unix", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("linux");

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				expect.objectContaining({
					stdio: "inherit",
					detached: true,
				}),
			);
		});

		it("should handle Bun packaged exe args", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("wt.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			Object.defineProperty(process, "argv", {
				value: ["bun", "B:/~BUN/root/test.exe", "--flag", "value"],
				writable: true,
			});

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			// Should use args from slice(2) for Bun packaged exe
			expect(childProcess.spawn).toHaveBeenCalledWith(
				"wt.exe",
				expect.arrayContaining(["--flag", "value"]),
				expect.any(Object),
			);
		});

		it("should return same promise on multiple calls", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("wt.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise1 = freshRestartApp();
			const promise2 = freshRestartApp();

			expect(promise1).toBe(promise2);
		});

		it("should handle spawn error", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("wt.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			// Create spawn mock that triggers error
			const errorSpawnMock = vi.fn(() => ({
				on: vi.fn((event, callback) => {
					if (event === "error") {
						setTimeout(() => callback(new Error("spawn error")), 0);
					}
				}),
			}));
			vi.mocked(childProcess.spawn).mockImplementation(errorSpawnMock as unknown as typeof childProcess.spawn);

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();

			// Should reject on error
			await expect(promise).rejects.toThrow("spawn error");

			// Restore spawn mock
			vi.mocked(childProcess.spawn).mockImplementation(() => ({
				on: vi.fn((event, callback) => {
					if (event === "close") {
						setTimeout(callback, 0);
					}
				}),
			}) as unknown as ReturnType<typeof childProcess.spawn>);
		});

		it("should escape PowerShell args with single quotes", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation((cmd) => {
				if (cmd.includes("powershell.exe")) return Buffer.from("");
				throw new Error("not found");
			});

			Object.defineProperty(process, "argv", {
				value: ["node", "script.js", "arg with 'quotes'"],
				writable: true,
			});

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"powershell.exe",
				expect.arrayContaining([
					"-Command",
					expect.stringContaining("''"), // Escaped single quotes
				]),
				expect.any(Object),
			);
		});

		it("should escape CMD args with spaces", async () => {
			vi.resetModules();
			vi.mocked(os.platform).mockReturnValue("win32");
			vi.mocked(childProcess.execSync).mockImplementation(() => {
				throw new Error("not found");
			});

			Object.defineProperty(process, "argv", {
				value: ["node", "script.js", "arg with spaces"],
				writable: true,
			});

			const { restartApp: freshRestartApp } = await import(
				"../../source/utils/platform.js"
			);

			const promise = freshRestartApp();
			await new Promise((r) => setTimeout(r, 10));

			expect(childProcess.spawn).toHaveBeenCalledWith(
				"cmd.exe",
				expect.arrayContaining([
					"/C",
					expect.stringContaining('"arg with spaces"'), // Quoted spaces
				]),
				expect.any(Object),
			);
		});
	});
});
