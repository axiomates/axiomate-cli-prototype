import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import App from "../source/app.js";
import type { InitResult } from "../source/utils/init.js";

// Mock initResult for App component
// 测试环境没有配置文件，currentModel 为 null 是正常的
const mockInitResult: InitResult = {
	aiService: null,
	currentModel: null,
};

describe("App", () => {
	it("renders the header with app title", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// Header shows app name
		expect(lastFrame()).toContain("axiomate-cli");
	});

	it("shows input mode indicator by default", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// Default mode is input mode
		expect(lastFrame()).toContain("[Input]");
	});

	it("shows command hints in header", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// Header shows command hints
		expect(lastFrame()).toContain("for commands");
		expect(lastFrame()).toContain("for shortcuts");
	});
});
