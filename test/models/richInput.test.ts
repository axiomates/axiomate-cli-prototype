import { describe, it, expect } from "vitest";
import {
	segmentsToRanges,
	type ColoredSegment,
	type ColorRange,
} from "../../source/models/richInput.js";

describe("richInput", () => {
	describe("segmentsToRanges", () => {
		it("should return empty array for empty segments", () => {
			const segments: ColoredSegment[] = [];
			const ranges = segmentsToRanges(segments);
			expect(ranges).toEqual([]);
		});

		it("should convert single segment to range", () => {
			const segments: ColoredSegment[] = [{ text: "hello", color: "red" }];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(1);
			expect(ranges[0]).toEqual({
				start: 0,
				end: 5,
				color: "red",
			});
		});

		it("should convert multiple segments to consecutive ranges", () => {
			const segments: ColoredSegment[] = [
				{ text: "hello", color: "red" },
				{ text: " ", color: undefined },
				{ text: "world", color: "blue" },
			];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(3);
			expect(ranges[0]).toEqual({ start: 0, end: 5, color: "red" });
			expect(ranges[1]).toEqual({ start: 5, end: 6, color: undefined });
			expect(ranges[2]).toEqual({ start: 6, end: 11, color: "blue" });
		});

		it("should skip empty text segments", () => {
			const segments: ColoredSegment[] = [
				{ text: "hello", color: "red" },
				{ text: "", color: "green" },
				{ text: "world", color: "blue" },
			];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(2);
			expect(ranges[0]).toEqual({ start: 0, end: 5, color: "red" });
			expect(ranges[1]).toEqual({ start: 5, end: 10, color: "blue" });
		});

		it("should handle segments without color", () => {
			const segments: ColoredSegment[] = [
				{ text: "plain text" },
				{ text: "colored", color: "#ff0000" },
			];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(2);
			expect(ranges[0]).toEqual({ start: 0, end: 10, color: undefined });
			expect(ranges[1]).toEqual({ start: 10, end: 17, color: "#ff0000" });
		});

		it("should handle all empty segments", () => {
			const segments: ColoredSegment[] = [
				{ text: "", color: "red" },
				{ text: "", color: "blue" },
			];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toEqual([]);
		});

		it("should handle unicode characters correctly", () => {
			const segments: ColoredSegment[] = [
				{ text: "你好", color: "red" },
				{ text: "世界", color: "blue" },
			];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(2);
			expect(ranges[0]).toEqual({ start: 0, end: 2, color: "red" });
			expect(ranges[1]).toEqual({ start: 2, end: 4, color: "blue" });
		});

		it("should handle emoji characters", () => {
			const segments: ColoredSegment[] = [{ text: "👋🌍", color: "yellow" }];
			const ranges = segmentsToRanges(segments);

			expect(ranges).toHaveLength(1);
			// Emoji are 2 code units each
			expect(ranges[0]!.start).toBe(0);
			expect(ranges[0]!.color).toBe("yellow");
		});
	});
});
