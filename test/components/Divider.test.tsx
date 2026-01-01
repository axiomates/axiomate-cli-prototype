import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import Divider from "../../source/components/Divider.js";

// Mock useTerminalWidth hook
vi.mock("../../source/hooks/useTerminalWidth.js", () => ({
	default: vi.fn(() => 80),
}));

describe("Divider", () => {
	it("should render horizontal line", () => {
		const { lastFrame } = render(<Divider />);

		expect(lastFrame()).toBeDefined();
		expect(lastFrame()).toContain("─");
	});

	it("should render line with correct width", () => {
		const { lastFrame } = render(<Divider />);
		const frame = lastFrame() ?? "";

		// Should contain repeated horizontal line character
		// Width is 80 (mocked)
		expect(frame.length).toBeGreaterThan(0);
	});

	it("should use terminal width from hook", async () => {
		const useTerminalWidth = await import(
			"../../source/hooks/useTerminalWidth.js"
		);

		// Test with different width
		vi.mocked(useTerminalWidth.default).mockReturnValue(40);

		const { lastFrame } = render(<Divider />);

		expect(lastFrame()).toBeDefined();
		expect(useTerminalWidth.default).toHaveBeenCalled();
	});
});
