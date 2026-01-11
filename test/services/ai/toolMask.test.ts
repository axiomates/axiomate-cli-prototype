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

// Mock frozen tools
const mockFrozenTools: DiscoveredTool[] = [
	{
		id: "file",
		name: "File",
		category: "builtin",
		installed: true,
		capabilities: ["read", "write"],
		keywords: ["file"],
	},
	{
		id: "bash",
		name: "Bash",
		category: "shell",
		installed: true,
		capabilities: ["execute"],
		keywords: ["bash", "shell"],
	},
	{
		id: "powershell",
		name: "PowerShell",
		category: "shell",
		installed: true,
		capabilities: ["execute"],
		keywords: ["powershell"],
	},
	{
		id: "git",
		name: "Git",
		category: "vcs",
		installed: true,
		capabilities: ["version_control"],
		keywords: ["git"],
	},
	{
		id: "web",
		name: "Web Fetch",
		category: "web",
		installed: true,
		capabilities: ["fetch"],
		keywords: ["web", "http"],
	},
	{
		id: "askuser",
		name: "Ask User",
		category: "builtin",
		installed: true,
		capabilities: ["interact"],
		keywords: ["ask"],
	},
	{
		id: "plan",
		name: "Plan",
		category: "builtin",
		installed: true,
		capabilities: ["plan"],
		keywords: ["plan"],
	},
	{
		id: "node",
		name: "Node.js",
		category: "runtime",
		installed: true,
		capabilities: ["execute"],
		keywords: ["node", "npm"],
	},
	{
		id: "docker",
		name: "Docker",
		category: "container",
		installed: true,
		capabilities: ["container"],
		keywords: ["docker"],
	},
	{
		id: "python",
		name: "Python",
		category: "runtime",
		installed: true,
		capabilities: ["execute"],
		keywords: ["python"],
	},
	{
		id: "java",
		name: "Java",
		category: "runtime",
		installed: true,
		capabilities: ["execute"],
		keywords: ["java"],
	},
	{
		id: "javac",
		name: "Javac",
		category: "build",
		installed: true,
		capabilities: ["compile"],
		keywords: ["javac"],
	},
	{
		id: "maven",
		name: "Maven",
		category: "build",
		installed: true,
		capabilities: ["build"],
		keywords: ["maven"],
	},
	{
		id: "gradle",
		name: "Gradle",
		category: "build",
		installed: true,
		capabilities: ["build"],
		keywords: ["gradle"],
	},
	{
		id: "cmake",
		name: "CMake",
		category: "build",
		installed: true,
		capabilities: ["build"],
		keywords: ["cmake"],
	},
	{
		id: "msbuild",
		name: "MSBuild",
		category: "build",
		installed: true,
		capabilities: ["build"],
		keywords: ["msbuild"],
	},
	{
		id: "vs2022",
		name: "Visual Studio 2022",
		category: "ide",
		installed: true,
		capabilities: ["ide"],
		keywords: ["vs2022"],
	},
	{
		id: "vscode",
		name: "VS Code",
		category: "ide",
		installed: true,
		capabilities: ["ide"],
		keywords: ["vscode"],
	},
	{
		id: "beyondcompare",
		name: "Beyond Compare",
		category: "diff",
		installed: true,
		capabilities: ["compare"],
		keywords: ["beyondcompare"],
	},
	{
		id: "mysql",
		name: "MySQL",
		category: "database",
		installed: true,
		capabilities: ["database"],
		keywords: ["mysql"],
	},
	{
		id: "cmd",
		name: "CMD",
		category: "shell",
		installed: true,
		capabilities: ["execute"],
		keywords: ["cmd"],
	},
	{
		id: "pwsh",
		name: "PowerShell Core",
		category: "shell",
		installed: true,
		capabilities: ["execute"],
		keywords: ["pwsh"],
	},
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

				expect(mask.mode).toBe("plan");
				expect(mask.allowedTools.has("plan")).toBe(true);
				expect(mask.allowedTools.size).toBe(1);
				expect(mask.toolPrefix).toBe("plan_");
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

				expect(mask.mode).toBe("plan");
				expect(mask.allowedTools.has("plan")).toBe(true);
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

				expect(mask.mode).toBe("plan");
				expect(mask.allowedTools.has("plan")).toBe(true);
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

				expect(mask.mode).toBe("action");
				expect(mask.allowedTools.has("askuser")).toBe(true);
				expect(mask.allowedTools.has("file")).toBe(true);
			});

			it("should include git by default", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("git")).toBe(true);
			});

			it("should match web tool from http keyword", () => {
				const mask = buildToolMask(
					"Fetch https://example.com",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("web")).toBe(true);
			});

			it("should match web tool from url keyword", () => {
				const mask = buildToolMask(
					"Get the url content",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("web")).toBe(true);
			});

			it("should match git tool from git keywords", () => {
				const mask = buildToolMask(
					"commit these changes",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("git")).toBe(true);
			});

			it("should match git tool from branch keyword", () => {
				const mask = buildToolMask(
					"create a new branch",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("git")).toBe(true);
			});

			it("should match docker tool from docker keyword", () => {
				const mask = buildToolMask(
					"Build the docker image",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("docker")).toBe(true);
			});

			it("should match node tool from npm keyword", () => {
				const mask = buildToolMask(
					"Run npm install",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("node")).toBe(true);
			});

			it("should add node tools for node project type", () => {
				const mask = buildToolMask(
					"Install dependencies",
					{ cwd: "/project", projectType: "node" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("node")).toBe(true);
			});

			it("should add tools for python project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "python" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("python")).toBe(true);
			});

			it("should add tools for java project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "java" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("java")).toBe(true);
				expect(mask.allowedTools.has("javac")).toBe(true);
				expect(mask.allowedTools.has("maven")).toBe(true);
				expect(mask.allowedTools.has("gradle")).toBe(true);
			});

			it("should add tools for dotnet project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "dotnet" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("msbuild")).toBe(true);
				expect(mask.allowedTools.has("vs2022")).toBe(true);
			});

			it("should add tools for cpp project type", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "cpp" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("cmake")).toBe(true);
			});

			it("should handle rust project type gracefully", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "rust" },
					false,
					mockFrozenTools,
				);

				// rust tools not implemented yet, but should not error
				expect(mask.mode).toBe("action");
			});

			it("should handle go project type gracefully", () => {
				const mask = buildToolMask(
					"Hello",
					{ cwd: "/project", projectType: "go" },
					false,
					mockFrozenTools,
				);

				// go tools not implemented yet, but should not error
				expect(mask.mode).toBe("action");
			});

			it("should match cmake tool from cmake keyword", () => {
				const mask = buildToolMask(
					"Run cmake to build",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("cmake")).toBe(true);
			});

			it("should match maven tool from maven keyword", () => {
				const mask = buildToolMask(
					"Run maven clean install",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("maven")).toBe(true);
			});

			it("should match gradle tool from gradle keyword", () => {
				const mask = buildToolMask(
					"Execute gradle build",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("gradle")).toBe(true);
			});

			it("should match python tool from pip keyword", () => {
				const mask = buildToolMask(
					"Install packages with pip",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("python")).toBe(true);
			});

			it("should match java tool from java keyword", () => {
				const mask = buildToolMask(
					"Compile the java code",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("java")).toBe(true);
			});

			it("should match vscode tool from vscode keyword", () => {
				const mask = buildToolMask(
					"Open in vscode",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("vscode")).toBe(true);
			});

			it("should match vs2022 tool from visual studio keyword", () => {
				const mask = buildToolMask(
					"Open in visual studio",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("vs2022")).toBe(true);
			});

			it("should match vs2022 tool from sln keyword", () => {
				const mask = buildToolMask(
					"Build the .sln file",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("vs2022")).toBe(true);
			});

			it("should match beyondcompare tool from diff keyword", () => {
				const mask = buildToolMask(
					"Compare the diff between files",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("beyondcompare")).toBe(true);
			});

			it("should match mysql tool from mysql keyword", () => {
				const mask = buildToolMask(
					"Connect to mysql database",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("mysql")).toBe(true);
			});

			it("should match docker tool from container keyword", () => {
				const mask = buildToolMask(
					"Start the container",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("docker")).toBe(true);
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

				expect(mask.mode).toBe("action");
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

			expect(isToolAllowed("file", mask)).toBe(true);
			expect(isToolAllowed("askuser", mask)).toBe(true);
		});

		it("should return false if tool is not in allowedTools", () => {
			const mask = buildToolMask(
				"Hello",
				{ cwd: "/project" },
				true, // plan mode - only plan allowed
				mockFrozenTools,
			);

			expect(isToolAllowed("file", mask)).toBe(false);
			expect(isToolAllowed("git", mask)).toBe(false);
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

			const error = getToolNotAllowedError("file", mask);

			expect(error).toContain("file");
			expect(error).toContain("not available");
			expect(error).toContain("plan");
		});
	});
});
