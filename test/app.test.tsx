import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";

describe("App", () => {
	it("renders the splash screen with app title on initial load", () => {
		const { lastFrame } = render(<App />);
		// Splash screen shows app name
		expect(lastFrame()).toContain("axiomate-cli");
	});

	it("shows loading message in splash screen", () => {
		const { lastFrame } = render(<App />);
		// Splash screen shows loading message
		expect(lastFrame()).toContain("Loading...");
	});

	it("shows version in splash screen", () => {
		const { lastFrame } = render(<App />);
		// Splash screen shows version (format: v0.1.0)
		expect(lastFrame()).toMatch(/v\d+\.\d+\.\d+/);
	});
});
