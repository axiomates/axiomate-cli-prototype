import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "../../source/utils/logger.js";

// Mock dependencies
vi.mock("../../source/utils/appdata.js", () => ({
	getLogsPath: vi.fn().mockReturnValue("/mock/logs"),
}));

vi.mock("../../source/utils/flags.js", () => ({
	getFlags: vi.fn().mockReturnValue({ verbose: false }),
}));

const mockWrite = vi.fn();
vi.mock("../../source/utils/logWriter.js", () => ({
	LogWriter: vi.fn().mockImplementation(() => ({
		write: mockWrite,
	})),
}));

import { getFlags } from "../../source/utils/flags.js";

describe("logger", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("logger methods", () => {
		it("should have trace method", () => {
			expect(typeof logger.trace).toBe("function");
		});

		it("should have debug method", () => {
			expect(typeof logger.debug).toBe("function");
		});

		it("should have info method", () => {
			expect(typeof logger.info).toBe("function");
		});

		it("should have warn method", () => {
			expect(typeof logger.warn).toBe("function");
		});

		it("should have error method", () => {
			expect(typeof logger.error).toBe("function");
		});

		it("should have fatal method", () => {
			expect(typeof logger.fatal).toBe("function");
		});
	});

	describe("log level filtering", () => {
		it("should log warn level when verbose is false", () => {
			vi.mocked(getFlags).mockReturnValue({ verbose: false, help: undefined });

			logger.warn("test warning");
			// LogWriter 单例已创建，mockWrite 应该被调用
			expect(mockWrite).toHaveBeenCalled();
		});

		it("should log error level when verbose is false", () => {
			vi.mocked(getFlags).mockReturnValue({ verbose: false, help: undefined });
			mockWrite.mockClear();

			logger.error("test error");
			expect(mockWrite).toHaveBeenCalled();
		});

		it("should log fatal level when verbose is false", () => {
			vi.mocked(getFlags).mockReturnValue({ verbose: false, help: undefined });
			mockWrite.mockClear();

			logger.fatal("test fatal");
			expect(mockWrite).toHaveBeenCalled();
		});
	});

	describe("log with object", () => {
		it("should accept optional object parameter", () => {
			vi.mocked(getFlags).mockReturnValue({ verbose: false, help: undefined });

			// 不应该抛出错误
			expect(() => logger.warn("test", { key: "value" })).not.toThrow();
		});
	});
});
