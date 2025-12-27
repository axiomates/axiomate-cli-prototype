import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	getAppDataPath,
	getLogsPath,
	getHistoryPath,
	getSessionsPath,
	initAppData,
} from "../../source/utils/appdata.js";

// Mock fs and os modules
vi.mock("node:fs");
vi.mock("node:os");

describe("appdata", () => {
	const mockHomeDir = "/mock/home";

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
	});

	describe("getAppDataPath", () => {
		it("should return path in home directory", () => {
			const result = getAppDataPath();
			expect(result).toBe(path.join(mockHomeDir, ".axiomate"));
		});
	});

	describe("getLogsPath", () => {
		it("should return logs subdirectory", () => {
			const result = getLogsPath();
			expect(result).toBe(path.join(mockHomeDir, ".axiomate", "logs"));
		});
	});

	describe("getHistoryPath", () => {
		it("should return history subdirectory", () => {
			const result = getHistoryPath();
			expect(result).toBe(path.join(mockHomeDir, ".axiomate", "history"));
		});
	});

	describe("getSessionsPath", () => {
		it("should return sessions subdirectory", () => {
			const result = getSessionsPath();
			expect(result).toBe(path.join(mockHomeDir, ".axiomate", "sessions"));
		});
	});

	describe("initAppData", () => {
		it("should create directories when they do not exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

			initAppData();

			// 应该检查主目录和子目录
			expect(fs.existsSync).toHaveBeenCalled();
			// 应该创建目录
			expect(fs.mkdirSync).toHaveBeenCalled();
		});

		it("should not create directories when they exist", () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);

			initAppData();

			// 不应该创建任何目录
			expect(fs.mkdirSync).not.toHaveBeenCalled();
		});

		it("should create subdirectories when main dir exists but subdirs do not", () => {
			// 第一次检查主目录存在，后续检查子目录不存在
			vi.mocked(fs.existsSync)
				.mockReturnValueOnce(true) // 主目录存在
				.mockReturnValueOnce(false) // logs 不存在
				.mockReturnValueOnce(false) // history 不存在
				.mockReturnValueOnce(false); // sessions 不存在

			vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

			initAppData();

			// 应该创建 3 个子目录
			expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
		});
	});
});
