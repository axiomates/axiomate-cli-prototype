import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	builtinDiscoverers,
	discoverableDiscoverers,
	discoverAllTools,
} from "../../../../source/services/tools/discoverers/index.js";

// Mock all discoverer modules
vi.mock("../../../../source/services/tools/discoverers/git.js", () => ({
	detectGit: vi.fn(() => Promise.resolve({ id: "git", installed: true })),
}));

vi.mock("../../../../source/services/tools/discoverers/node.js", () => ({
	detectNode: vi.fn(() => Promise.resolve({ id: "node", installed: true })),
	detectNvm: vi.fn(() => Promise.resolve({ id: "nvm", installed: false })),
	detectNpm: vi.fn(() => Promise.resolve({ id: "npm", installed: true })),
}));

vi.mock("../../../../source/services/tools/discoverers/python.js", () => ({
	detectPython: vi.fn(() => Promise.resolve({ id: "python", installed: true })),
}));

vi.mock("../../../../source/services/tools/discoverers/java.js", () => ({
	detectJava: vi.fn(() => Promise.resolve({ id: "java", installed: false })),
	detectJavac: vi.fn(() => Promise.resolve({ id: "javac", installed: false })),
}));

vi.mock("../../../../source/services/tools/discoverers/powershell.js", () => ({
	detectPowershell: vi.fn(() =>
		Promise.resolve({ id: "powershell", installed: true }),
	),
	detectPwsh: vi.fn(() => Promise.resolve({ id: "pwsh", installed: false })),
}));

vi.mock("../../../../source/services/tools/discoverers/bash.js", () => ({
	detectBash: vi.fn(() => Promise.resolve({ id: "bash", installed: false })),
}));

vi.mock("../../../../source/services/tools/discoverers/cmd.js", () => ({
	detectCmd: vi.fn(() => Promise.resolve({ id: "cmd", installed: true })),
}));

vi.mock("../../../../source/services/tools/discoverers/vscode.js", () => ({
	detectVscode: vi.fn(() => Promise.resolve({ id: "vscode", installed: true })),
}));

vi.mock(
	"../../../../source/services/tools/discoverers/visualstudio.js",
	() => ({
		detectVisualStudio: vi.fn(() =>
			Promise.resolve({ id: "vs2022", installed: false }),
		),
		detectMsbuild: vi.fn(() =>
			Promise.resolve({ id: "msbuild", installed: false }),
		),
	}),
);

vi.mock(
	"../../../../source/services/tools/discoverers/beyondcompare.js",
	() => ({
		detectBeyondCompare: vi.fn(() =>
			Promise.resolve({ id: "beyondcompare", installed: false }),
		),
	}),
);

vi.mock("../../../../source/services/tools/discoverers/docker.js", () => ({
	detectDocker: vi.fn(() =>
		Promise.resolve({ id: "docker", installed: false }),
	),
	detectDockerCompose: vi.fn(() =>
		Promise.resolve({ id: "docker-compose", installed: false }),
	),
}));

vi.mock("../../../../source/services/tools/discoverers/build.js", () => ({
	detectCmake: vi.fn(() => Promise.resolve({ id: "cmake", installed: false })),
	detectGradle: vi.fn(() =>
		Promise.resolve({ id: "gradle", installed: false }),
	),
	detectMaven: vi.fn(() => Promise.resolve({ id: "maven", installed: false })),
}));

vi.mock("../../../../source/services/tools/discoverers/database.js", () => ({
	detectMysql: vi.fn(() => Promise.resolve({ id: "mysql", installed: false })),
	detectPsql: vi.fn(() => Promise.resolve({ id: "psql", installed: false })),
	detectSqlite: vi.fn(() =>
		Promise.resolve({ id: "sqlite3", installed: false }),
	),
}));

vi.mock("../../../../source/services/tools/discoverers/web.js", () => ({
	detectWebFetch: vi.fn(() =>
		Promise.resolve({ id: "web-fetch", installed: true }),
	),
}));

vi.mock("../../../../source/services/tools/discoverers/file.js", () => ({
	detectFile: vi.fn(() => Promise.resolve({ id: "file", installed: true })),
}));

vi.mock("../../../../source/services/tools/discoverers/plan.js", () => ({
	detectPlan: vi.fn(() => Promise.resolve({ id: "plan", installed: true })),
	detectEnterPlan: vi.fn(() =>
		Promise.resolve({ id: "enterplan", installed: true }),
	),
}));

vi.mock("../../../../source/services/tools/discoverers/ask_user.js", () => ({
	detectAskUser: vi.fn(() =>
		Promise.resolve({ id: "askuser", installed: true }),
	),
}));

describe("discoverers index", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("builtinDiscoverers and discoverableDiscoverers", () => {
		it("should export arrays of discover functions", () => {
			expect(Array.isArray(builtinDiscoverers)).toBe(true);
			expect(Array.isArray(discoverableDiscoverers)).toBe(true);
			expect(builtinDiscoverers.length).toBeGreaterThan(0);
			expect(discoverableDiscoverers.length).toBeGreaterThan(0);
		});

		it("should contain expected number of discoverers", () => {
			// builtinDiscoverers: web, file, plan, enterplan, ask_user = 5
			expect(builtinDiscoverers.length).toBe(5);
			// discoverableDiscoverers: 23 external tools
			expect(discoverableDiscoverers.length).toBe(23);
		});

		it("should have all functions be callable", () => {
			for (const discoverer of builtinDiscoverers) {
				expect(typeof discoverer).toBe("function");
			}
			for (const discoverer of discoverableDiscoverers) {
				expect(typeof discoverer).toBe("function");
			}
		});
	});

	describe("discoverAllTools", () => {
		it("should call all discoverers and return results", async () => {
			const results = await discoverAllTools();
			const totalDiscoverers =
				builtinDiscoverers.length + discoverableDiscoverers.length;

			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBe(totalDiscoverers);
		});

		it("should return tools with correct ids", async () => {
			const results = await discoverAllTools();

			// Check some expected tools are in the results
			expect(results.some((t) => t.id === "git")).toBe(true);
			expect(results.some((t) => t.id === "node")).toBe(true);
			expect(results.some((t) => t.id === "python")).toBe(true);
		});

		it("should include both installed and not installed tools", async () => {
			const results = await discoverAllTools();

			const installedTools = results.filter((t) => t.installed);
			const notInstalledTools = results.filter((t) => !t.installed);

			expect(installedTools.length).toBeGreaterThan(0);
			expect(notInstalledTools.length).toBeGreaterThan(0);
		});
	});
});
