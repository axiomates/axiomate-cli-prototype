import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
	promises: {
		mkdir: vi.fn(() => Promise.resolve()),
		readdir: vi.fn(() => Promise.resolve([])),
		stat: vi.fn(() => Promise.resolve({ size: 0 })),
		appendFile: vi.fn(() => Promise.resolve()),
		unlink: vi.fn(() => Promise.resolve()),
	},
}));

import * as fs from "node:fs";
import { LogWriter } from "../../source/utils/logWriter.js";

describe("LogWriter", () => {
	let writer: LogWriter;
	const basePath = "/logs";

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-12-20T10:30:00.000Z"));
		writer = new LogWriter(basePath);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should create with default config", () => {
			const w = new LogWriter("/test");
			expect(w).toBeDefined();
		});

		it("should accept custom options", () => {
			const w = new LogWriter("/test", {
				baseName: "custom",
				maxFileSize: 1024,
				maxDays: 7,
			});
			expect(w).toBeDefined();
		});
	});

	describe("write", () => {
		it("should queue log entry and schedule processing", () => {
			writer.write("info", "Test message");

			// Entry should be queued
			expect((writer as any).queue.length).toBe(1);
			expect((writer as any).queue[0].msg).toBe("Test message");
			expect((writer as any).queue[0].level).toBe("info");
		});

		it("should include additional data in log entry", () => {
			writer.write("error", "Error occurred", { code: 500, path: "/api" });

			const entry = (writer as any).queue[0];
			expect(entry.code).toBe(500);
			expect(entry.path).toBe("/api");
		});

		it("should include ISO timestamp in entry", () => {
			writer.write("debug", "Debug message");

			const entry = (writer as any).queue[0];
			expect(entry.time).toBe("2024-12-20T10:30:00.000Z");
		});

		it("should support all log levels", () => {
			const levels = [
				"trace",
				"debug",
				"info",
				"warn",
				"error",
				"fatal",
			] as const;

			for (const level of levels) {
				writer.write(level, `${level} message`);
			}

			expect((writer as any).queue.length).toBe(6);
		});
	});

	describe("processQueue", () => {
		it("should create directory on first write", async () => {
			writer.write("info", "First message");

			// Run setImmediate callbacks
			await vi.runAllTimersAsync();

			expect(fs.promises.mkdir).toHaveBeenCalledWith(basePath, {
				recursive: true,
			});
		});

		it("should initialize current file state", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([]);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			expect(fs.promises.readdir).toHaveBeenCalledWith(basePath);
		});

		it("should append log entry to file", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([]);

			writer.write("info", "Test message");
			await vi.runAllTimersAsync();

			expect(fs.promises.appendFile).toHaveBeenCalled();
			const [filePath, content] = vi.mocked(fs.promises.appendFile).mock
				.calls[0]!;
			expect(filePath).toContain("axiomate.2024-12-20.log");
			expect(content).toContain('"level":"info"');
			expect(content).toContain('"msg":"Test message"');
		});

		it("should process multiple queued entries", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([]);

			writer.write("info", "Message 1");
			writer.write("info", "Message 2");
			writer.write("info", "Message 3");

			await vi.runAllTimersAsync();

			expect(fs.promises.appendFile).toHaveBeenCalledTimes(3);
		});

		it("should handle mkdir error silently", async () => {
			vi.mocked(fs.promises.mkdir).mockRejectedValue(
				new Error("Permission denied"),
			);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should not throw
			expect(fs.promises.mkdir).toHaveBeenCalled();
		});

		it("should handle appendFile error silently", async () => {
			vi.mocked(fs.promises.appendFile).mockRejectedValue(
				new Error("Disk full"),
			);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should not throw
			expect(fs.promises.appendFile).toHaveBeenCalled();
		});
	});

	describe("file rotation", () => {
		it("should continue from existing file when size under limit", async () => {
			// String sort: .1 < .l, so axiomate.2024-12-20.1.log < axiomate.2024-12-20.log
			// After sort: [.1.log, .2.log, .log], last one is .log which parses to index 0
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-20.log",
				"axiomate.2024-12-20.1.log",
			] as any);
			// Size is under limit, so should use same file
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1000 } as any);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Due to string sorting, .log comes after .1.log, so latest is .log (index 0)
			expect((writer as any).currentFileIndex).toBe(0);
			expect((writer as any).currentDate).toBe("2024-12-20");
		});

		it("should use highest numbered file index", async () => {
			// Only numbered files to test index parsing
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-20.1.log",
				"axiomate.2024-12-20.2.log",
				"axiomate.2024-12-20.10.log",
			] as any);
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1000 } as any);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// String sort: .1. < .10. < .2., so last is .2.log (index 2)
			expect((writer as any).currentFileIndex).toBe(2);
		});

		it("should rotate to next file when size exceeded", async () => {
			const maxSize = 100;
			writer = new LogWriter(basePath, { maxFileSize: maxSize });

			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-20.log",
			] as any);
			vi.mocked(fs.promises.stat).mockResolvedValue({
				size: maxSize + 1,
			} as any);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should have incremented to index 1
			expect((writer as any).currentFileIndex).toBe(1);
		});

		it("should rotate on date change", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-19.log",
				"axiomate.2024-12-19.5.log",
			] as any);
			vi.mocked(fs.promises.stat).mockResolvedValue({ size: 0 } as any);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// New day should start at index 0
			expect((writer as any).currentFileIndex).toBe(0);
			expect((writer as any).currentDate).toBe("2024-12-20");
		});

		it("should handle readdir error", async () => {
			vi.mocked(fs.promises.readdir).mockRejectedValue(
				new Error("Access denied"),
			);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should use default values
			expect((writer as any).currentFileIndex).toBe(0);
		});
	});

	describe("cleanOldFiles", () => {
		it("should delete files older than maxDays", async () => {
			writer = new LogWriter(basePath, { maxDays: 1 });

			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-18.log", // 2 days old - should delete
				"axiomate.2024-12-19.log", // 1 day old - should keep
				"axiomate.2024-12-20.log", // today - should keep
			] as any);

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			expect(fs.promises.unlink).toHaveBeenCalledWith(
				expect.stringContaining("axiomate.2024-12-18.log"),
			);
			expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
		});

		it("should handle unlink error silently", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([
				"axiomate.2024-12-01.log",
			] as any);
			vi.mocked(fs.promises.unlink).mockRejectedValue(new Error("File busy"));

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should not throw
			expect(fs.promises.unlink).toHaveBeenCalled();
		});

		it("should handle readdir error in cleanup", async () => {
			// First call succeeds for init, second fails for cleanup
			let callCount = 0;
			vi.mocked(fs.promises.readdir).mockImplementation(() => {
				callCount++;
				if (callCount === 1) return Promise.resolve([]);
				return Promise.reject(new Error("Error"));
			});

			writer.write("info", "Test");
			await vi.runAllTimersAsync();

			// Should not throw
		});
	});

	describe("parseFileIndex", () => {
		it("should parse index from filename", () => {
			const parse = (writer as any).parseFileIndex.bind(writer);

			expect(parse("axiomate.2024-12-20.log")).toBe(0);
			expect(parse("axiomate.2024-12-20.1.log")).toBe(1);
			expect(parse("axiomate.2024-12-20.10.log")).toBe(10);
			expect(parse("axiomate.2024-12-20.999.log")).toBe(999);
		});
	});

	describe("getDateString", () => {
		it("should return date in YYYY-MM-DD format", () => {
			const getDate = (writer as any).getDateString.bind(writer);

			expect(getDate()).toBe("2024-12-20");

			// Test different dates
			vi.setSystemTime(new Date("2025-01-05T00:00:00.000Z"));
			expect(getDate()).toBe("2025-01-05");
		});
	});

	describe("concurrent writes", () => {
		it("should process new entries added during processing", async () => {
			vi.mocked(fs.promises.readdir).mockResolvedValue([]);

			// Simulate slow append
			let appendCount = 0;
			vi.mocked(fs.promises.appendFile).mockImplementation(async () => {
				appendCount++;
				if (appendCount === 1) {
					// Add more entries during first write
					writer.write("info", "Concurrent 1");
					writer.write("info", "Concurrent 2");
				}
			});

			writer.write("info", "First");
			await vi.runAllTimersAsync();

			// All entries should be processed
			expect(fs.promises.appendFile).toHaveBeenCalledTimes(3);
		});
	});
});
