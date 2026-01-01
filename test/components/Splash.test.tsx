import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import Splash from "../../source/components/Splash.js";

// Mock dependencies
vi.mock("../../source/constants/meta.js", () => ({
	APP_NAME: "TestApp",
	VERSION: "1.0.0",
}));

vi.mock("../../source/constants/colors.js", () => ({
	THEME_LIGHT_YELLOW: "yellow",
	THEME_PINK: "magenta",
}));

vi.mock("../../source/i18n/index.js", () => ({
	t: vi.fn((key: string) => {
		const translations: Record<string, string> = {
			"splash.loading": "Loading...",
		};
		return translations[key] || key;
	}),
}));

describe("Splash", () => {
	it("should render app name", () => {
		const { lastFrame } = render(<Splash />);

		expect(lastFrame()).toContain("TestApp");
	});

	it("should render version", () => {
		const { lastFrame } = render(<Splash />);

		expect(lastFrame()).toContain("v1.0.0");
	});

	it("should render default loading message when no message prop", () => {
		const { lastFrame } = render(<Splash />);

		expect(lastFrame()).toContain("Loading...");
	});

	it("should render custom message when provided", () => {
		const { lastFrame } = render(<Splash message="Initializing..." />);

		expect(lastFrame()).toContain("Initializing...");
		expect(lastFrame()).not.toContain("Loading...");
	});

	it("should render with all elements", () => {
		const { lastFrame } = render(<Splash message="Custom message" />);
		const frame = lastFrame() ?? "";

		expect(frame).toContain("TestApp");
		expect(frame).toContain("v1.0.0");
		expect(frame).toContain("Custom message");
	});
});
