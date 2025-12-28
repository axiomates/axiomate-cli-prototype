import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readdirSync: vi.fn(() => []),
	statSync: vi.fn(),
}));

vi.mock("node:os", () => ({
	platform: vi.fn(() => "win32"),
}));

import * as fs from "node:fs";
import * as os from "node:os";
import {
	ToolMatcher,
	detectProjectType,
	createToolMatcher,
} from "../../../source/services/tools/matcher.js";
import type { IToolRegistry, DiscoveredTool } from "../../../source/services/tools/types.js";

describe("matcher", () => {
	// Mock registry
	const createMockTool = (id: string, installed: boolean = true): DiscoveredTool => ({
		id,
		name: id,
		description: `${id} tool`,
		installed,
		version: "1.0.0",
		capabilities: ["execute"],
		actions: [
			{
				name: `${id}_action`,
				description: `Action for ${id}`,
				parameters: {},
			},
		],
		executionPath: `/bin/${id}`,
	});

	const createMockRegistry = (): IToolRegistry => {
		const tools = new Map<string, DiscoveredTool>();
		["git", "node", "python", "java", "bash", "powershell", "pwsh", "cmd", "docker", "cmake", "web", "dotnet", "sqlite3", "vs2022", "msbuild"].forEach(id => {
			tools.set(id, createMockTool(id));
		});

		return {
			register: vi.fn(),
			getTool: vi.fn((id) => tools.get(id) || null),
			getInstalled: vi.fn(() => Array.from(tools.values()).filter(t => t.installed)),
			getByCapability: vi.fn(() => []),
			discover: vi.fn(),
			getStats: vi.fn(() => ({ total: 10, installed: 10 })),
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fs.existsSync).mockReturnValue(false);
		vi.mocked(fs.readdirSync).mockReturnValue([]);
	});

	describe("detectProjectType", () => {
		it("should detect node project from package.json", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("package.json")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("node");
		});

		it("should detect python project from requirements.txt", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("requirements.txt")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("python");
		});

		it("should detect python project from pyproject.toml", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("pyproject.toml")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("python");
		});

		it("should detect java project from pom.xml", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("pom.xml")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("java");
		});

		it("should detect java project from build.gradle", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("build.gradle")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("java");
		});

		it("should detect cpp project from CMakeLists.txt", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("CMakeLists.txt")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("cpp");
		});

		it("should detect dotnet project from csproj file", () => {
			vi.mocked(fs.readdirSync).mockReturnValue(["app.csproj"] as any);

			const result = detectProjectType("/project");
			expect(result).toBe("dotnet");
		});

		it("should detect rust project from Cargo.toml", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("Cargo.toml")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("rust");
		});

		it("should detect go project from go.mod", () => {
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				typeof p === "string" && p.includes("go.mod")
			);

			const result = detectProjectType("/project");
			expect(result).toBe("go");
		});

		it("should return unknown for unrecognized project", () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.readdirSync).mockReturnValue([]);

			const result = detectProjectType("/project");
			expect(result).toBe("unknown");
		});
	});

	describe("ToolMatcher", () => {
		let registry: IToolRegistry;
		let matcher: ToolMatcher;

		beforeEach(() => {
			registry = createMockRegistry();
			matcher = new ToolMatcher(registry);
		});

		describe("match", () => {
			it("should match git tool by keyword", () => {
				const results = matcher.match("git commit");

				expect(results.length).toBeGreaterThan(0);
				expect(results[0]!.tool.id).toBe("git");
				expect(results[0]!.reason).toContain("Keyword match");
			});

			it("should match node tool by npm keyword", () => {
				const results = matcher.match("npm install");

				expect(results.length).toBeGreaterThan(0);
				expect(results[0]!.tool.id).toBe("node");
			});

			it("should match docker by keyword", () => {
				const results = matcher.match("build a container");

				expect(results.length).toBeGreaterThan(0);
				const dockerResult = results.find(r => r.tool.id === "docker");
				expect(dockerResult).toBeDefined();
			});

			it("should match web tool by Chinese keywords", () => {
				const results = matcher.match("打开网页");

				expect(results.length).toBeGreaterThan(0);
				const webResult = results.find(r => r.tool.id === "web");
				expect(webResult).toBeDefined();
			});

			it("should return empty array for no matches", () => {
				const results = matcher.match("zzzznonexistent");
				expect(results.length).toBe(0);
			});

			it("should match by tool name or description", () => {
				// Match by tool description - "git tool" contains "tool"
				const results = matcher.match("tool");

				// Should find tools where name or description contains "tool"
				expect(results.length).toBeGreaterThan(0);
				const hasNameDescMatch = results.some(r => r.reason === "Name/description match");
				expect(hasNameDescMatch).toBe(true);
			});

			it("should include context-aware matches", () => {
				vi.mocked(os.platform).mockReturnValue("win32");

				const results = matcher.match("hello", {
					cwd: "/project",
					projectType: "node",
				});

				// Should include shell tools and project tools
				expect(results.length).toBeGreaterThan(0);
			});
		});

		describe("matchByCapability", () => {
			it("should return tools by capability", () => {
				vi.mocked(registry.getByCapability).mockReturnValue([
					createMockTool("beyondcompare"),
				]);

				const results = matcher.matchByCapability("compare files");
				expect(results.length).toBe(1);
			});

			it("should return empty for unknown capability", () => {
				const results = matcher.matchByCapability("nonexistent");
				expect(results.length).toBe(0);
			});

			it("should filter out non-installed tools", () => {
				vi.mocked(registry.getByCapability).mockReturnValue([
					createMockTool("tool1", false),
				]);

				const results = matcher.matchByCapability("diff");
				expect(results.length).toBe(0);
			});
		});

		describe("autoSelect", () => {
			it("should always include shell tools", () => {
				vi.mocked(os.platform).mockReturnValue("win32");

				const results = matcher.autoSelect({ cwd: "/project" });

				// Should include Windows shell tools
				const toolIds = results.map(t => t.id);
				expect(toolIds.some(id => ["pwsh", "powershell", "cmd"].includes(id))).toBe(true);
			});

			it("should include bash on unix", () => {
				vi.mocked(os.platform).mockReturnValue("linux");

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("bash");
			});

			it("should add project-specific tools", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					projectType: "node",
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("node");
			});

			it("should detect tools from directory", () => {
				vi.mocked(fs.existsSync).mockReturnValue(true);
				vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);

				// .git directory exists
				vi.mocked(fs.existsSync).mockImplementation((p) =>
					typeof p === "string" && p.includes(".git")
				);

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("git");
			});

			it("should infer tools from selected files", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/app.js"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("node");
			});

			it("should infer tools from Python files", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/script.py"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("python");
			});

			it("should infer tools from file names", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/Dockerfile"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("docker");
			});

			it("should infer tools from docker-compose file names", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/docker-compose.yml"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("docker");
			});

			it("should infer tools from CMakeLists.txt file names", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/CMakeLists.txt"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("cmake");
			});

			it("should infer tools from Makefile", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					selectedFiles: ["/project/Makefile"],
				});

				// Makefile should infer some build tools
				expect(results.length).toBeGreaterThan(0);
			});

			it("should detect project type from cwd", () => {
				vi.mocked(fs.existsSync).mockImplementation((p) =>
					typeof p === "string" && p.includes("package.json")
				);

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("node");
			});

			it("should handle current files", () => {
				const results = matcher.autoSelect({
					cwd: "/project",
					currentFiles: ["/project/test.ts"],
				});

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("node");
			});

			it("should detect tools from glob pattern files (*.csproj)", () => {
				// Mock readdirSync to return .csproj file for glob matching
				vi.mocked(fs.readdirSync).mockReturnValue(["MyApp.csproj"] as any);
				vi.mocked(fs.existsSync).mockReturnValue(false);

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("dotnet");
			});

			it("should detect tools from glob pattern files (*.sln)", () => {
				vi.mocked(fs.readdirSync).mockReturnValue(["Solution.sln"] as any);
				vi.mocked(fs.existsSync).mockReturnValue(false);

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("dotnet");
			});

			it("should detect tools from glob pattern files (*.db)", () => {
				vi.mocked(fs.readdirSync).mockReturnValue(["data.db"] as any);
				vi.mocked(fs.existsSync).mockReturnValue(false);

				const results = matcher.autoSelect({ cwd: "/project" });

				const toolIds = results.map(t => t.id);
				expect(toolIds).toContain("sqlite3");
			});

			it("should handle read errors gracefully", () => {
				// Mock readdirSync to throw error for glob pattern matching
				vi.mocked(fs.readdirSync).mockImplementation(() => {
					throw new Error("Permission denied");
				});
				// existsSync returns false, but statSync throws if called
				vi.mocked(fs.existsSync).mockReturnValue(false);
				vi.mocked(fs.statSync).mockImplementation(() => {
					throw new Error("Access denied");
				});

				// Should not throw, errors are silently ignored
				const results = matcher.autoSelect({ cwd: "/project" });

				// Should still return shell tools at minimum
				expect(results.length).toBeGreaterThan(0);
			});
		});
	});

	describe("createToolMatcher", () => {
		it("should create a ToolMatcher instance", () => {
			const registry = createMockRegistry();
			const matcher = createToolMatcher(registry);

			expect(matcher).toBeInstanceOf(ToolMatcher);
		});
	});
});
