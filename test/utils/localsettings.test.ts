import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
}));

import * as fs from "node:fs";

describe("localsettings", () => {
	const originalCwd = process.cwd;

	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset module to clear singleton state
		vi.resetModules();

		// Mock process.cwd
		Object.defineProperty(process, "cwd", {
			value: () => "/test/project",
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(process, "cwd", {
			value: originalCwd,
			writable: true,
		});
	});

	describe("initLocalSettings", () => {
		it("should initialize with default settings when file does not exist", async () => {
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT");
			});

			const { initLocalSettings, getLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings).toEqual({
				permissions: {
					allow: [],
				},
			});
			expect(getLocalSettings()).toEqual(settings);
		});

		it("should load settings from file", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					permissions: {
						allow: ["bash:*"],
					},
				}),
			);

			const { initLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings.permissions.allow).toEqual(["bash:*"]);
		});

		it("should merge file settings with defaults", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					permissions: {
						allow: ["npm:*"],
					},
				}),
			);

			const { initLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings.permissions.allow).toEqual(["npm:*"]);
		});

		it("should return defaults for invalid JSON", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

			const { initLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings).toEqual({
				permissions: {
					allow: [],
				},
			});
		});

		it("should return defaults for null settings", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue("null");

			const { initLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings.permissions.allow).toEqual([]);
		});

		it("should return defaults for array settings", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue("[]");

			const { initLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			const settings = initLocalSettings();

			expect(settings.permissions.allow).toEqual([]);
		});
	});

	describe("getLocalSettings", () => {
		it("should return a clone of settings", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					permissions: {
						allow: ["git:*"],
					},
				}),
			);

			const { initLocalSettings, getLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			initLocalSettings();
			const settings1 = getLocalSettings();
			const settings2 = getLocalSettings();

			// Should be equal but not the same object
			expect(settings1).toEqual(settings2);
			expect(settings1).not.toBe(settings2);

			// Modifying one should not affect the other
			settings1.permissions.allow.push("test");
			expect(settings2.permissions.allow).not.toContain("test");
		});
	});

	describe("updateLocalSettings", () => {
		it("should update settings and save to file", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					permissions: {
						allow: [],
					},
				}),
			);

			const { initLocalSettings, updateLocalSettings, getLocalSettings } =
				await import("../../source/utils/localsettings.js");

			initLocalSettings();

			const updated = updateLocalSettings({
				permissions: {
					allow: ["bash:npm test"],
				},
			});

			expect(updated.permissions.allow).toEqual(["bash:npm test"]);
			expect(getLocalSettings().permissions.allow).toEqual(["bash:npm test"]);
			expect(fs.mkdirSync).toHaveBeenCalled();
			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it("should merge partial updates", async () => {
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify({
					permissions: {
						allow: ["existing"],
					},
				}),
			);

			const { initLocalSettings, updateLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			initLocalSettings();

			// Update just permissions.allow
			const updated = updateLocalSettings({
				permissions: {
					allow: ["new-permission"],
				},
			});

			expect(updated.permissions.allow).toEqual(["new-permission"]);
		});

		it("should create directory before saving", async () => {
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT");
			});

			const { initLocalSettings, updateLocalSettings } = await import(
				"../../source/utils/localsettings.js"
			);

			initLocalSettings();
			updateLocalSettings({
				permissions: { allow: ["test"] },
			});

			expect(fs.mkdirSync).toHaveBeenCalledWith(
				expect.stringContaining(".axiomate"),
				{ recursive: true },
			);
		});
	});

	describe("getLocalSettingsPath", () => {
		it("should return correct settings path", async () => {
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("ENOENT");
			});

			const { initLocalSettings, getLocalSettingsPath } = await import(
				"../../source/utils/localsettings.js"
			);

			initLocalSettings();
			const path = getLocalSettingsPath();

			expect(path).toContain(".axiomate");
			expect(path).toContain("localsettings.json");
		});
	});
});
