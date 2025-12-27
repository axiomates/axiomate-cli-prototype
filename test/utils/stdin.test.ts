import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pauseInput, resumeInput } from "../../source/utils/stdin.js";

describe("stdin", () => {
	const originalPause = process.stdin.pause;
	const originalResume = process.stdin.resume;

	beforeEach(() => {
		// Mock stdin methods
		process.stdin.pause = vi.fn().mockReturnThis();
		process.stdin.resume = vi.fn().mockReturnThis();
	});

	afterEach(() => {
		// Restore original methods
		process.stdin.pause = originalPause;
		process.stdin.resume = originalResume;
		// Reset module state by calling resume
		resumeInput();
	});

	describe("pauseInput", () => {
		it("should pause stdin on first call", () => {
			// 先确保是未暂停状态
			resumeInput();
			vi.mocked(process.stdin.pause).mockClear();

			pauseInput();
			expect(process.stdin.pause).toHaveBeenCalledTimes(1);
		});

		it("should not pause stdin if already paused", () => {
			// 先确保是未暂停状态
			resumeInput();
			vi.mocked(process.stdin.pause).mockClear();

			pauseInput();
			pauseInput();
			// 第二次调用不应该再次暂停
			expect(process.stdin.pause).toHaveBeenCalledTimes(1);
		});
	});

	describe("resumeInput", () => {
		it("should resume stdin when paused", () => {
			pauseInput();
			vi.mocked(process.stdin.resume).mockClear();

			resumeInput();
			expect(process.stdin.resume).toHaveBeenCalledTimes(1);
		});

		it("should not resume stdin if not paused", () => {
			// 确保是未暂停状态
			resumeInput();
			vi.mocked(process.stdin.resume).mockClear();

			resumeInput();
			// 不应该调用 resume
			expect(process.stdin.resume).not.toHaveBeenCalled();
		});
	});

	describe("pause/resume cycle", () => {
		it("should handle multiple pause/resume cycles", () => {
			resumeInput(); // Reset state
			vi.mocked(process.stdin.pause).mockClear();
			vi.mocked(process.stdin.resume).mockClear();

			pauseInput();
			expect(process.stdin.pause).toHaveBeenCalledTimes(1);

			resumeInput();
			expect(process.stdin.resume).toHaveBeenCalledTimes(1);

			pauseInput();
			expect(process.stdin.pause).toHaveBeenCalledTimes(2);

			resumeInput();
			expect(process.stdin.resume).toHaveBeenCalledTimes(2);
		});
	});
});
