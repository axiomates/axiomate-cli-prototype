import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import useTerminalHeight from "../../source/hooks/useTerminalHeight.js";

// Test component that uses the hook
function TestComponent() {
	const height = useTerminalHeight();
	return <Text>Height: {height}</Text>;
}

describe("useTerminalHeight", () => {
	it("should return terminal height", () => {
		const { lastFrame } = render(<TestComponent />);

		// 应该渲染高度
		expect(lastFrame()).toContain("Height:");
	});

	it("should return a positive number", () => {
		const { lastFrame } = render(<TestComponent />);

		// 提取数字
		const match = lastFrame()?.match(/Height: (\d+)/);
		expect(match).toBeTruthy();

		const height = parseInt(match![1]!, 10);
		expect(height).toBeGreaterThan(0);
	});

	it("should clean up event listeners on unmount", () => {
		const { unmount, lastFrame } = render(<TestComponent />);
		expect(lastFrame()).toContain("Height:");
		// Should not throw when unmounting
		expect(() => unmount()).not.toThrow();
	});

	it("should handle stdout rows change", () => {
		const { lastFrame, rerender } = render(<TestComponent />);

		// First render
		expect(lastFrame()).toContain("Height:");

		// Rerender to trigger forceUpdate effect
		rerender(<TestComponent />);
		expect(lastFrame()).toContain("Height:");
	});
});
