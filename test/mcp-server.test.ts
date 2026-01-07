import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
	StdioServerTransport: vi.fn(() => ({
		connect: vi.fn(),
	})),
}));

vi.mock("../source/services/tools/registry.js", () => ({
	ToolRegistry: class {
		discover = vi.fn(() => Promise.resolve());
		getDiscoveredTools = vi.fn(() => []);
	},
}));

vi.mock("../source/services/tools/mcp/server.js", () => ({
	createToolsMcpServer: vi.fn(() => ({
		connect: vi.fn(() => Promise.resolve()),
	})),
}));

vi.mock("../source/i18n/index.js", () => ({
	t: vi.fn((key: string) => key),
}));

describe("mcp-server module", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should have ToolRegistry mocked correctly", async () => {
		const { ToolRegistry } =
			await import("../source/services/tools/registry.js");
		expect(ToolRegistry).toBeDefined();

		const registry = new ToolRegistry();
		expect(registry.discover).toBeDefined();
	});

	it("should have createToolsMcpServer mocked correctly", async () => {
		const { createToolsMcpServer } =
			await import("../source/services/tools/mcp/server.js");
		expect(createToolsMcpServer).toBeDefined();
		expect(typeof createToolsMcpServer).toBe("function");
	});

	it("should have StdioServerTransport mocked correctly", async () => {
		const { StdioServerTransport } =
			await import("@modelcontextprotocol/sdk/server/stdio.js");
		expect(StdioServerTransport).toBeDefined();
	});

	it("should have i18n t function mocked correctly", async () => {
		const { t } = await import("../source/i18n/index.js");
		expect(t).toBeDefined();
		expect(t("test.key")).toBe("test.key");
	});
});
