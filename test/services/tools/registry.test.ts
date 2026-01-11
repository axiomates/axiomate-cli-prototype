import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

// Mock tools data
const mockTools = [
	{
		id: "git",
		name: "Git",
		category: "vcs",
		installed: true,
		version: "2.43.0",
		capabilities: ["version_control", "diff"],
		keywords: ["git", "commit", "branch"],
	},
	{
		id: "node",
		name: "Node.js",
		category: "runtime",
		installed: true,
		version: "20.10.0",
		capabilities: ["run_code"],
		keywords: ["node", "npm"],
	},
	{
		id: "docker",
		name: "Docker",
		category: "container",
		installed: false,
		capabilities: ["container"],
		keywords: ["docker"],
		installHint: "Download from docker.com\nMore instructions here",
	},
	{
		id: "vscode",
		name: "VS Code",
		category: "ide",
		installed: true,
		version: "1.85.0",
		capabilities: ["edit_code"],
		keywords: ["code", "vscode"],
	},
];

// Mock the discoverers module
vi.mock("../../../source/services/tools/discoverers/index.js", () => ({
	discoverAllTools: vi.fn(() => Promise.resolve(mockTools)),
	getBuiltinTools: vi.fn(() => Promise.resolve(mockTools.slice(0, 2))),
	discoverExternalTools: vi.fn(() => Promise.resolve(mockTools.slice(2))),
}));

import { ToolRegistry } from "../../../source/services/tools/registry.js";

describe("ToolRegistry", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new ToolRegistry();
	});

	describe("discover", () => {
		it("should discover tools and populate the registry", async () => {
			expect(registry.isDiscovered).toBe(false);

			await registry.discover();

			expect(registry.isDiscovered).toBe(true);
			expect(registry.getAll().length).toBe(4);
		});

		it("should merge tools on re-discover (not clear)", async () => {
			await registry.discover();
			expect(registry.getAll().length).toBe(4);

			// Add a tool manually
			registry.tools.set("manual", {
				id: "manual",
				name: "Manual Tool",
				category: "other",
				installed: true,
				capabilities: [],
				keywords: [],
			});
			expect(registry.getAll().length).toBe(5);

			// Re-discover will merge (overwrite existing, keep new)
			await registry.discover();
			// Manual tool is kept, plus 4 discovered tools = 5
			expect(registry.getAll().length).toBe(5);
		});
	});

	describe("isDiscovered", () => {
		it("should return false initially", () => {
			expect(registry.isDiscovered).toBe(false);
		});

		it("should return true after discover", async () => {
			await registry.discover();
			expect(registry.isDiscovered).toBe(true);
		});
	});

	describe("getAll", () => {
		it("should return empty array before discovery", () => {
			expect(registry.getAll()).toEqual([]);
		});

		it("should return all tools after discovery", async () => {
			await registry.discover();
			const tools = registry.getAll();
			expect(tools.length).toBe(4);
			expect(tools.map((t) => t.id)).toContain("git");
			expect(tools.map((t) => t.id)).toContain("node");
		});
	});

	describe("getInstalled", () => {
		it("should return only installed tools", async () => {
			await registry.discover();
			const installed = registry.getInstalled();

			expect(installed.length).toBe(3);
			expect(installed.every((t) => t.installed)).toBe(true);
			expect(installed.map((t) => t.id)).not.toContain("docker");
		});
	});

	describe("getNotInstalled", () => {
		it("should return only not installed tools", async () => {
			await registry.discover();
			const notInstalled = registry.getNotInstalled();

			expect(notInstalled.length).toBe(1);
			expect(notInstalled[0]!.id).toBe("docker");
			expect(notInstalled.every((t) => !t.installed)).toBe(true);
		});
	});

	describe("getByCategory", () => {
		it("should return tools by category", async () => {
			await registry.discover();

			const vcsTools = registry.getByCategory("vcs");
			expect(vcsTools.length).toBe(1);
			expect(vcsTools[0]!.id).toBe("git");

			const runtimeTools = registry.getByCategory("runtime");
			expect(runtimeTools.length).toBe(1);
			expect(runtimeTools[0]!.id).toBe("node");
		});

		it("should return empty array for non-existent category", async () => {
			await registry.discover();
			const tools = registry.getByCategory("database");
			expect(tools).toEqual([]);
		});
	});

	describe("getByCapability", () => {
		it("should return tools by capability", async () => {
			await registry.discover();

			const vcsTools = registry.getByCapability("version_control");
			expect(vcsTools.length).toBe(1);
			expect(vcsTools[0]!.id).toBe("git");
		});

		it("should return multiple tools with same capability", async () => {
			await registry.discover();
			const diffTools = registry.getByCapability("diff");
			expect(diffTools.length).toBe(1);
		});

		it("should return empty array for non-existent capability", async () => {
			await registry.discover();
			const tools = registry.getByCapability("nonexistent" as any);
			expect(tools).toEqual([]);
		});
	});

	describe("getTool", () => {
		it("should return tool by id", async () => {
			await registry.discover();

			const git = registry.getTool("git");
			expect(git).toBeDefined();
			expect(git!.name).toBe("Git");
		});

		it("should return undefined for non-existent tool", async () => {
			await registry.discover();
			const tool = registry.getTool("nonexistent");
			expect(tool).toBeUndefined();
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", async () => {
			await registry.discover();
			const stats = registry.getStats();

			expect(stats.total).toBe(4);
			expect(stats.installed).toBe(3);
			expect(stats.notInstalled).toBe(1);
		});

		it("should return stats by category", async () => {
			await registry.discover();
			const stats = registry.getStats();

			expect(stats.byCategory.vcs).toBe(1);
			expect(stats.byCategory.runtime).toBe(1);
			expect(stats.byCategory.ide).toBe(1);
			// docker is not installed, so container should not be in byCategory
			expect(stats.byCategory.container).toBeUndefined();
		});
	});

	describe("formatToolList", () => {
		it("should format tool list including not installed", async () => {
			await registry.discover();
			const output = registry.formatToolList(true);

			expect(output).toContain("Git");
			expect(output).toContain("git");
			expect(output).toContain("✓ 2.43.0");
			expect(output).toContain("Docker");
			expect(output).toContain("✗ 未安装");
			expect(output).toContain("Download from docker.com");
		});

		it("should format tool list excluding not installed", async () => {
			await registry.discover();
			const output = registry.formatToolList(false);

			expect(output).toContain("Git");
			expect(output).not.toContain("Docker");
			expect(output).not.toContain("✗ 未安装");
		});

		it("should group tools by category", async () => {
			await registry.discover();
			const output = registry.formatToolList();

			expect(output).toContain("## 版本控制");
			expect(output).toContain("## 运行时");
			expect(output).toContain("## IDE");
		});

		it("should handle tools without version", async () => {
			await registry.discover();
			// Docker has no version
			const output = registry.formatToolList();
			expect(output).toContain("Docker");
		});
	});
});

describe("getToolRegistry and initToolRegistry", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset the module to clear singleton
		vi.resetModules();
	});

	it("should return singleton instance", async () => {
		const { getToolRegistry } =
			await import("../../../source/services/tools/registry.js");

		const registry1 = getToolRegistry();
		const registry2 = getToolRegistry();

		expect(registry1).toBe(registry2);
	});

	it("should initialize registry on first call", async () => {
		const { initToolRegistry } =
			await import("../../../source/services/tools/registry.js");

		const registry = await initToolRegistry();

		expect(registry.isDiscovered).toBe(true);
	});

	it("should not re-discover on second init call", async () => {
		const { initToolRegistry } =
			await import("../../../source/services/tools/registry.js");
		const { getBuiltinTools, discoverExternalTools } =
			await import("../../../source/services/tools/discoverers/index.js");

		await initToolRegistry();
		await initToolRegistry();

		// getBuiltinTools and discoverExternalTools are called once each
		expect(vi.mocked(getBuiltinTools)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(discoverExternalTools)).toHaveBeenCalledTimes(1);
	});
});

describe("Tool Freezing", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new ToolRegistry();
	});

	describe("freezeTools", () => {
		it("should freeze tools after discovery", async () => {
			await registry.discover();
			expect(registry.isFrozen()).toBe(false);

			registry.freezeTools();

			expect(registry.isFrozen()).toBe(true);
		});

		it("should only include installed tools in frozen list", async () => {
			await registry.discover();
			registry.freezeTools();

			const frozenTools = registry.getFrozenTools();

			// Only git, node, and vscode are installed (not docker)
			expect(frozenTools.length).toBe(3);
			expect(frozenTools.every((t) => t.installed)).toBe(true);
			expect(frozenTools.find((t) => t.id === "docker")).toBeUndefined();
		});

		it("should sort frozen tools by id", async () => {
			await registry.discover();
			registry.freezeTools();

			const frozenTools = registry.getFrozenTools();
			const ids = frozenTools.map((t) => t.id);

			// git, node, vscode - alphabetically sorted
			expect(ids).toEqual(["git", "node", "vscode"]);
		});

		it("should not re-freeze if already frozen", async () => {
			await registry.discover();
			registry.freezeTools();

			const firstFrozenTools = registry.getFrozenTools();

			// Add a new tool manually
			registry.tools.set("new-tool", {
				id: "new-tool",
				name: "New Tool",
				category: "other",
				installed: true,
				capabilities: [],
				keywords: [],
			});

			// Try to freeze again
			registry.freezeTools();

			// Frozen list should be unchanged
			const secondFrozenTools = registry.getFrozenTools();
			expect(secondFrozenTools).toBe(firstFrozenTools);
			expect(secondFrozenTools.length).toBe(3);
		});

		it("should return empty array when not frozen", () => {
			const frozenTools = registry.getFrozenTools();
			expect(frozenTools).toEqual([]);
		});
	});
});
