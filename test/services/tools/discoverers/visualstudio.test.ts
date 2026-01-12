import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectVisualStudio,
	detectMsbuild,
} from "../../../../source/services/tools/discoverers/visualstudio.js";

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	findVisualStudio: vi.fn(),
	fileExists: vi.fn(),
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
	findVisualStudio,
	fileExists,
	getVersion,
} from "../../../../source/services/tools/discoverers/base.js";

describe("visualstudio discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectVisualStudio", () => {
		it("should return not installed tool when VS is not found", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue(null);

			const result = await detectVisualStudio();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-vs2022");
		});

		it("should return not installed when devenv.exe does not exist", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(false);

			const result = await detectVisualStudio();

			expect(result.installed).toBe(false);
		});

		it("should return installed tool when VS is found", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(true);

			const result = await detectVisualStudio();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\Common7\\IDE\\devenv.exe",
			);
			expect(result.version).toBe("17.8");
		});

		it("should use full version when pattern not matched", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "unknown-version",
			});
			vi.mocked(fileExists).mockReturnValue(true);

			const result = await detectVisualStudio();

			expect(result.version).toBe("unknown-version");
		});
	});

	describe("detectMsbuild", () => {
		it("should return not installed tool when VS is not found", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue(null);

			const result = await detectMsbuild();

			expect(result.installed).toBe(false);
			expect(result.id).toBe("a-msbuild");
		});

		it("should return not installed when MSBuild.exe does not exist", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(false);

			const result = await detectMsbuild();

			expect(result.installed).toBe(false);
		});

		it("should return installed tool when MSBuild is found", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(true);
			vi.mocked(getVersion).mockResolvedValue("17.8.3.57717");

			const result = await detectMsbuild();

			expect(result.installed).toBe(true);
			expect(result.executablePath).toBe(
				"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe",
			);
			expect(result.version).toBe("17.8.3.57717");
		});

		it("should parse version from last line of output", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(true);
			vi.mocked(getVersion).mockImplementation(async (cmd, args, options) => {
				if (options?.parseOutput) {
					return options.parseOutput(
						"Microsoft (R) Build Engine version 17.8.3+195e7f5a3\nCopyright (C) Microsoft Corporation.\n17.8.3.57717",
					);
				}
				return "17.8.3.57717";
			});

			const result = await detectMsbuild();

			expect(result.version).toBe("17.8.3.57717");
		});

		it("should handle null version", async () => {
			vi.mocked(findVisualStudio).mockResolvedValue({
				installPath:
					"C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise",
				version: "17.8.34330.188",
			});
			vi.mocked(fileExists).mockReturnValue(true);
			vi.mocked(getVersion).mockResolvedValue(null);

			const result = await detectMsbuild();

			expect(result.version).toBeUndefined();
		});
	});
});
