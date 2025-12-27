import { describe, it, expect, beforeEach } from "vitest";
import { setFlags, getFlags, type CliFlags } from "../../source/utils/flags.js";

describe("flags", () => {
	beforeEach(() => {
		// 重置为默认值
		setFlags({ help: undefined, verbose: undefined });
	});

	describe("getFlags", () => {
		it("should return default flags initially", () => {
			const flags = getFlags();
			expect(flags.help).toBeUndefined();
			expect(flags.verbose).toBeUndefined();
		});
	});

	describe("setFlags", () => {
		it("should set help flag", () => {
			setFlags({ help: true, verbose: undefined });
			const flags = getFlags();
			expect(flags.help).toBe(true);
		});

		it("should set verbose flag", () => {
			setFlags({ help: undefined, verbose: true });
			const flags = getFlags();
			expect(flags.verbose).toBe(true);
		});

		it("should set both flags", () => {
			setFlags({ help: true, verbose: true });
			const flags = getFlags();
			expect(flags.help).toBe(true);
			expect(flags.verbose).toBe(true);
		});

		it("should override previous flags", () => {
			setFlags({ help: true, verbose: true });
			setFlags({ help: false, verbose: false });
			const flags = getFlags();
			expect(flags.help).toBe(false);
			expect(flags.verbose).toBe(false);
		});
	});
});
