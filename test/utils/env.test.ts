import { describe, it, expect } from "vitest";

describe("env", () => {
	it("should set FORCE_COLOR environment variable", async () => {
		// Import the module to trigger the side effect
		await import("../../source/utils/env.js");

		expect(process.env.FORCE_COLOR).toBe("1");
	});
});
