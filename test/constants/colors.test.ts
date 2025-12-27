import { describe, it, expect } from "vitest";
import {
	PATH_COLOR,
	ARROW_COLOR,
	FILE_AT_COLOR,
	FILE_COLOR,
	DIR_COLOR,
	THEME_LIGHT_YELLOW,
	THEME_PINK,
	CURSOR_COLOR,
	lightenColor,
} from "../../source/constants/colors.js";

describe("colors", () => {
	describe("color constants", () => {
		it("should export PATH_COLOR", () => {
			expect(PATH_COLOR).toBe("#ffd700");
		});

		it("should export ARROW_COLOR", () => {
			expect(ARROW_COLOR).toBe("gray");
		});

		it("should export FILE_AT_COLOR", () => {
			expect(FILE_AT_COLOR).toBe("#87ceeb");
		});

		it("should export FILE_COLOR", () => {
			expect(FILE_COLOR).toBe("#87ceeb");
		});

		it("should export DIR_COLOR", () => {
			expect(DIR_COLOR).toBe("#ffd700");
		});

		it("should export THEME_LIGHT_YELLOW", () => {
			expect(THEME_LIGHT_YELLOW).toBe("#ffff00");
		});

		it("should export THEME_PINK", () => {
			expect(THEME_PINK).toBe("#ff69b4");
		});

		it("should export CURSOR_COLOR", () => {
			expect(CURSOR_COLOR).toBe("#00ffff");
		});
	});

	describe("lightenColor", () => {
		it("should lighten a hex color with default factor", () => {
			const result = lightenColor("#000000");
			// 黑色变浅应该得到灰色
			expect(result).toBe("#666666"); // 0 + (255-0)*0.4 = 102 = 0x66
		});

		it("should lighten a hex color with custom factor", () => {
			const result = lightenColor("#000000", 0.5);
			// 0 + (255-0)*0.5 = 127.5 ≈ 128 = 0x80
			expect(result).toBe("#808080");
		});

		it("should handle white color (no change possible)", () => {
			const result = lightenColor("#ffffff", 0.4);
			// 255 + (255-255)*0.4 = 255
			expect(result).toBe("#ffffff");
		});

		it("should lighten red color", () => {
			const result = lightenColor("#ff0000", 0.4);
			// R: 255 + (255-255)*0.4 = 255
			// G: 0 + (255-0)*0.4 = 102
			// B: 0 + (255-0)*0.4 = 102
			expect(result).toBe("#ff6666");
		});

		it("should handle named color 'gray'", () => {
			const result = lightenColor("gray", 0.4);
			// gray = #808080
			// 128 + (255-128)*0.4 = 128 + 50.8 = 179 ≈ 0xb3
			expect(result).toBe("#b3b3b3");
		});

		it("should handle named color 'red'", () => {
			const result = lightenColor("red", 0.4);
			// red = #ff0000
			expect(result).toBe("#ff6666");
		});

		it("should handle named color 'white'", () => {
			const result = lightenColor("white", 0.4);
			expect(result).toBe("#ffffff");
		});

		it("should handle named color 'black'", () => {
			const result = lightenColor("black", 0.4);
			expect(result).toBe("#666666");
		});

		it("should handle named color 'green'", () => {
			const result = lightenColor("green", 0.4);
			// green = #00ff00
			expect(result).toBe("#66ff66");
		});

		it("should handle named color 'blue'", () => {
			const result = lightenColor("blue", 0.4);
			// blue = #0000ff
			expect(result).toBe("#6666ff");
		});

		it("should handle named color 'yellow'", () => {
			const result = lightenColor("yellow", 0.4);
			// yellow = #ffff00
			expect(result).toBe("#ffff66");
		});

		it("should handle named color 'cyan'", () => {
			const result = lightenColor("cyan", 0.4);
			// cyan = #00ffff
			expect(result).toBe("#66ffff");
		});

		it("should handle named color 'magenta'", () => {
			const result = lightenColor("magenta", 0.4);
			// magenta = #ff00ff
			expect(result).toBe("#ff66ff");
		});

		it("should use gray as fallback for unknown named colors", () => {
			const result = lightenColor("unknowncolor", 0.4);
			// 使用 gray (#808080) 作为默认
			expect(result).toBe("#b3b3b3");
		});

		it("should handle factor of 0 (no lightening)", () => {
			const result = lightenColor("#ff0000", 0);
			expect(result).toBe("#ff0000");
		});

		it("should handle factor of 1 (maximum lightening to white)", () => {
			const result = lightenColor("#000000", 1);
			expect(result).toBe("#ffffff");
		});

		it("should handle mixed colors", () => {
			const result = lightenColor("#336699", 0.4);
			// R: 51 + (255-51)*0.4 = 51 + 81.6 = 133 ≈ 0x85
			// G: 102 + (255-102)*0.4 = 102 + 61.2 = 163 ≈ 0xa3
			// B: 153 + (255-153)*0.4 = 153 + 40.8 = 194 ≈ 0xc2
			expect(result).toBe("#85a3c2");
		});
	});
});
