import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before importing the module
vi.mock("ink", () => ({
	render: vi.fn(() => ({
		rerender: vi.fn(),
		unmount: vi.fn(),
		waitUntilExit: vi.fn(() => Promise.resolve()),
	})),
}));

vi.mock("meow", () => ({
	default: vi.fn(() => ({
		flags: { help: false, verbose: false },
	})),
}));

vi.mock("../source/utils/appdata.js", () => ({
	initAppData: vi.fn(),
}));

vi.mock("../source/utils/config.js", () => ({
	initConfig: vi.fn(),
	isFirstTimeUser: vi.fn(() => false),
}));

vi.mock("../source/utils/flags.js", () => ({
	setFlags: vi.fn(),
}));

vi.mock("../source/utils/localsettings.js", () => ({
	initLocalSettings: vi.fn(),
}));

vi.mock("../source/utils/platform.js", () => ({
	initPlatform: vi.fn(),
}));

vi.mock("../source/utils/init.js", () => ({
	initApp: vi.fn(() => Promise.resolve({ aiService: null, registry: null })),
}));

vi.mock("../source/utils/stdin.js", () => ({
	pauseInput: vi.fn(),
}));

vi.mock("../source/i18n/index.js", () => ({
	initI18n: vi.fn(),
	t: vi.fn((key: string) => key),
}));

vi.mock("../source/app.js", () => ({
	default: vi.fn(() => null),
}));

vi.mock("../source/components/Splash.js", () => ({
	default: vi.fn(() => null),
}));

vi.mock("../source/components/Welcome.js", () => ({
	default: vi.fn(() => null),
}));

describe("cli module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should have required dependencies mocked", async () => {
		// Verify mocks are set up
		const { initConfig } = await import("../source/utils/config.js");
		const { initAppData } = await import("../source/utils/appdata.js");
		const { initLocalSettings } = await import(
			"../source/utils/localsettings.js"
		);
		const { initPlatform } = await import("../source/utils/platform.js");
		const { initI18n } = await import("../source/i18n/index.js");

		expect(initConfig).toBeDefined();
		expect(initAppData).toBeDefined();
		expect(initLocalSettings).toBeDefined();
		expect(initPlatform).toBeDefined();
		expect(initI18n).toBeDefined();
	});

	it("should have meow mocked correctly", async () => {
		const meow = await import("meow");
		expect(meow.default).toBeDefined();
	});

	it("should have ink render mocked correctly", async () => {
		const { render } = await import("ink");
		expect(render).toBeDefined();
		expect(typeof render).toBe("function");
	});
});
