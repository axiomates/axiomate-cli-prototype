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
	it("shows action mode indicator by default", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// Default mode is action mode (plan mode disabled)
		expect(lastFrame()).toContain("[Action]");
	});

	it("shows usage N/A when AI not configured", () => {
		const { lastFrame } = render(<App initResult={mockInitResult} />);
		// StatusBar shows N/A when AI not configured
		expect(lastFrame()).toContain("N/A");
	});
});
