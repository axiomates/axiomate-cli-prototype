import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import useTerminalWidth from "../../source/hooks/useTerminalWidth.js";

// Test component that uses the hook
function TestComponent() {
	const width = useTerminalWidth();
	return <Text>Width: {width}</Text>;
}

describe("useTerminalWidth", () => {
	it("should return terminal width", () => {
		const { lastFrame } = render(<TestComponent />);

		// 应该渲染宽度
		expect(lastFrame()).toContain("Width:");
	});

	it("should return a positive number", () => {
		const { lastFrame } = render(<TestComponent />);

		// 提取数字
		const match = lastFrame()?.match(/Width: (\d+)/);
		expect(match).toBeTruthy();

		const width = parseInt(match![1]!, 10);
		expect(width).toBeGreaterThan(0);
	});
});
