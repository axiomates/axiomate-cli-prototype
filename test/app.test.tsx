import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";

describe("App", () => {
	it("renders the app title", () => {
		const { lastFrame } = render(<App flags={{ name: undefined }} />);
		expect(lastFrame()).toContain("axiomate-cli");
	});

	it("renders autocomplete hint", () => {
		const { lastFrame } = render(<App flags={{ name: "Jane" }} />);
		expect(lastFrame()).toContain("Tab");
		expect(lastFrame()).toContain("autocomplete");
	});
});
