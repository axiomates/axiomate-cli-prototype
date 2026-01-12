import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

// Mock config module for model capability checks
vi.mock("../../../source/utils/config.js", () => ({
	currentModelSupportsToolChoice: vi.fn(() => false),
	currentModelSupportsPrefill: vi.fn(() => true), // Default to prefill support for tests
}));

beforeAll(() => {
	initI18n();
	setLocale("en");
});

import {
	buildToolMask,
	isToolAllowed,
	getToolNotAllowedError,
} from "../../../source/services/ai/toolMask.js";
import type { DiscoveredTool } from "../../../source/services/tools/types.js";
import {
	currentModelSupportsToolChoice,
	currentModelSupportsPrefill,
} from "../../../source/utils/config.js";

// Helper to create mock tool
const createMockTool = (
	id: string,
	name: string,
	category: DiscoveredTool["category"],
	capabilities: DiscoveredTool["capabilities"] = ["execute"],
): DiscoveredTool => ({
	id,
	name,
	description: `${name} tool`,
	category,
	installed: true,
	capabilities,
	executablePath: `/bin/${id}`,
	actions: [],
});

// Mock frozen tools
const mockFrozenTools: DiscoveredTool[] = [
	createMockTool("a-c-file", "File", "utility", ["read", "write"]),
	createMockTool("a-c-bash", "Bash", "shell"),
	createMockTool("a-c-powershell", "PowerShell", "shell"),
	createMockTool("a-c-git", "Git", "vcs"),
	createMockTool("a-c-web", "Web Fetch", "web"),
	createMockTool("a-c-askuser", "Ask User", "utility"),
	createMockTool("p-plan", "Plan", "utility", ["read", "write"]),
	createMockTool("a-node", "Node.js", "runtime"),
	createMockTool("a-docker", "Docker", "container"),
	createMockTool("a-python", "Python", "runtime"),
	createMockTool("a-java", "Java", "runtime"),
	createMockTool("a-javac", "Javac", "build"),
	createMockTool("a-maven", "Maven", "build"),
	createMockTool("a-gradle", "Gradle", "build"),
	createMockTool("a-cmake", "CMake", "build"),
	createMockTool("a-msbuild", "MSBuild", "build"),
	createMockTool("a-vs2022", "Visual Studio 2022", "ide"),
	createMockTool("a-vscode", "VS Code", "ide"),
	createMockTool("a-beyondcompare", "Beyond Compare", "diff"),
	createMockTool("a-mysql", "MySQL", "database"),
	createMockTool("a-c-cmd", "CMD", "shell"),
	createMockTool("a-c-pwsh", "PowerShell Core", "shell"),
	createMockTool("a-c-enterplan", "Enter Plan Mode", "utility"),
];

describe("toolMask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset to default: no tool_choice, but prefill support
		vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
		vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);
	});

	describe("buildToolMask", () => {
		describe("Plan mode", () => {
			it("should use prefill when model supports it", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				const mask = buildToolMask(
					"Create a plan for this project",
					{ cwd: "/project" },
					true, // planMode
					mockFrozenTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.allowedTools.size).toBe(1);
				expect(mask.toolPrefix).toBe("p-");
				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should use tool_choice when model supports it", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(true);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Create a plan",
					{ cwd: "/project" },
					true,
					mockFrozenTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.toolPrefix).toBeUndefined();
				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should use dynamic fallback when model supports neither tool_choice nor prefill", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Create a plan",
					{ cwd: "/project" },
					true,
					mockFrozenTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.useDynamicFallback).toBe(true);
			});
		});

		describe("Action mode", () => {
			it("should include base tools", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.allowedTools.has("a-c-askuser")).toBe(true);
				expect(mask.allowedTools.has("a-c-file")).toBe(true);
			});

			it("should include git by default", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match web tool from http keyword", () => {
				const mask = buildToolMask(
					"Fetch https://example.com",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match web tool from url keyword", () => {
				const mask = buildToolMask(
					"Get the url content",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match git tool from git keywords", () => {
				const mask = buildToolMask(
					"commit these changes",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match git tool from branch keyword", () => {
				const mask = buildToolMask(
					"create a new branch",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match docker tool from docker keyword", () => {
				const mask = buildToolMask(
					"Build the docker image",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should match node tool from npm keyword", () => {
				const mask = buildToolMask(
					"Run npm install",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
			});

			it("should add node tools for node project type", () => {
				const mask = buildToolMask(
					"Install dependencies",
					{ cwd: "/project", projectType: "node" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
			});

			it("should add tools for python project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "python" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should add tools for java project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "java" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
				expect(mask.allowedTools.has("a-javac")).toBe(true);
				expect(mask.allowedTools.has("a-maven")).toBe(true);
				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should add tools for dotnet project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "dotnet" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-msbuild")).toBe(true);
				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should add tools for cpp project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "cpp" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should handle rust project type gracefully", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "rust" },
					false,
					mockFrozenTools,
				);

				// rust tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should handle go project type gracefully", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "go" },
					false,
					mockFrozenTools,
				);

				// go tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should match cmake tool from cmake keyword", () => {
				const mask = buildToolMask(
					"Run cmake to build",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should match maven tool from maven keyword", () => {
				const mask = buildToolMask(
					"Run maven clean install",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-maven")).toBe(true);
			});

			it("should match gradle tool from gradle keyword", () => {
				const mask = buildToolMask(
					"Execute gradle build",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should match python tool from pip keyword", () => {
				const mask = buildToolMask(
					"Install packages with pip",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should match java tool from java keyword", () => {
				const mask = buildToolMask(
					"Compile the java code",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
			});

			it("should match vscode tool from vscode keyword", () => {
				const mask = buildToolMask(
					"Open in vscode",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-vscode")).toBe(true);
			});

			it("should match vs2022 tool from visual studio keyword", () => {
				const mask = buildToolMask(
					"Open in visual studio",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match vs2022 tool from sln keyword", () => {
				const mask = buildToolMask(
					"Build the .sln file",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match beyondcompare tool from diff keyword", () => {
				const mask = buildToolMask(
					"Compare the diff between files",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-beyondcompare")).toBe(true);
			});

			it("should match mysql tool from mysql keyword", () => {
				const mask = buildToolMask(
					"Connect to mysql database",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-mysql")).toBe(true);
			});

			it("should match docker tool from container keyword", () => {
				const mask = buildToolMask(
					"Start the container",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should use dynamic fallback when model supports neither tool_choice nor prefill", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.useDynamicFallback).toBe(true);
			});

			it("should not use dynamic fallback when model supports tool_choice", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(true);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should not use dynamic fallback when model supports prefill", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should not have requiredTool in action mode", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.requiredTool).toBeUndefined();
			});

			it("should use a-c- prefix when only core tools are matched", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				// "Hello" only matches base tools (a-c-askuser, a-c-file) + shell + git
				// All are core tools (a-c-*)
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				console.log(mask.allowedTools);

				expect(mask.toolPrefix).toBe("a-c-");
			});

			it("should use a- prefix when non-core tools are matched", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				// "docker" keyword matches a-docker (non-core tool)
				const mask = buildToolMask(
					"Build the docker image",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.toolPrefix).toBe("a-");
			});

			it("should use a- prefix when project type adds non-core tools", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				// node project type adds a-node (non-core tool)
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "node" },
					false,
					mockFrozenTools,
				);

				expect(mask.toolPrefix).toBe("a-");
			});
		});

		describe("with empty frozen tools", () => {
			it("should return empty allowedTools when frozen tools is empty", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					[],
				);

				expect(mask.allowedTools.size).toBe(0);
			});
		});
	});

	describe("isToolAllowed", () => {
		it("should return true if tool is in allowedTools", () => {
			const mask = buildToolMask(
				"Hello",
				{ cwd: "/project" },
				false,
				mockFrozenTools,
			);

			expect(isToolAllowed("a-c-file", mask)).toBe(true);
			expect(isToolAllowed("a-c-askuser", mask)).toBe(true);
		});

		it("should return false if tool is not in allowedTools", () => {
			const mask = buildToolMask(
				"Hello",
				{ cwd: "/project" },
				true, // plan mode - only plan allowed
				mockFrozenTools,
			);

			expect(isToolAllowed("a-c-file", mask)).toBe(false);
			expect(isToolAllowed("a-c-git", mask)).toBe(false);
		});

		it("should return true if mask is undefined", () => {
			expect(isToolAllowed("any_tool", undefined)).toBe(true);
		});
	});

	describe("getToolNotAllowedError", () => {
		it("should return error message with tool id and allowed list", () => {
			const mask = buildToolMask(
				"Hello",
				{ cwd: "/project" },
				true,
				mockFrozenTools,
			);

			const error = getToolNotAllowedError("a-c-file", mask);

			expect(error).toContain("a-c-file");
			expect(error).toContain("not available");
			expect(error).toContain("p-plan");
		});
	});
});
