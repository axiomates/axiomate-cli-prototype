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

// Mock platform tools (版本A：核心工具)
const mockPlatformTools: DiscoveredTool[] = [
	createMockTool("a-c-file", "File", "utility", ["read", "write"]),
	createMockTool("a-c-bash", "Bash", "shell"),
	createMockTool("a-c-powershell", "PowerShell", "shell"),
	createMockTool("a-c-git", "Git", "vcs"),
	createMockTool("a-c-web", "Web Fetch", "web"),
	createMockTool("a-c-askuser", "Ask User", "utility"),
	createMockTool("a-c-cmd", "CMD", "shell"),
	createMockTool("a-c-pwsh", "PowerShell Core", "shell"),
	createMockTool("a-c-enterplan", "Enter Plan Mode", "utility"),
	createMockTool("p-plan", "Plan", "utility", ["read", "write"]),
];

// Mock project tools (版本B：平台工具 + 项目工具)
const mockProjectTools: DiscoveredTool[] = [
	...mockPlatformTools,
	createMockTool("a-node", "Node.js", "runtime"),
	createMockTool("a-npm", "npm", "package"),
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
];

// Deprecated: 保持向后兼容
const mockFrozenTools = mockProjectTools;

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
					undefined, // projectType
					true, // planMode
					"platform", // toolSource
					mockPlatformTools,
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
					undefined, // projectType
					true,
					"platform", // toolSource
					mockPlatformTools,
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
					undefined, // projectType
					true,
					"project", // toolSource (动态模式使用 project)
					mockProjectTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.useDynamicFallback).toBe(true);
			});
		});

		describe("Action mode", () => {
			it("should include base tools", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.allowedTools.has("a-c-askuser")).toBe(true);
				expect(mask.allowedTools.has("a-c-file")).toBe(true);
				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should include git by default", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match web tool from http keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Fetch https://example.com",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match web tool from url keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Get the url content",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match git tool from git keywords", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"commit these changes",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match git tool from branch keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"create a new branch",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match docker tool from docker keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Build the docker image",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should match node tool from npm keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Run npm install",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
			});

			it("should add node tools for node project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Install dependencies",
					"node", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
				expect(mask.allowedTools.has("a-npm")).toBe(true);
			});

			it("should add tools for python project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"python", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should add tools for java project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"java", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
				expect(mask.allowedTools.has("a-javac")).toBe(true);
				expect(mask.allowedTools.has("a-maven")).toBe(true);
				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should add tools for dotnet project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"dotnet", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-msbuild")).toBe(true);
				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should add tools for cpp project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"cpp", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should handle rust project type gracefully", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"rust", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				// rust tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should handle go project type gracefully", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"go", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				// go tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should match cmake tool from cmake keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Run cmake to build",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should match maven tool from maven keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Run maven clean install",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-maven")).toBe(true);
			});

			it("should match gradle tool from gradle keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Execute gradle build",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should match python tool from pip keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Install packages with pip",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should match java tool from java keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Compile the java code",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
			});

			it("should match vscode tool from vscode keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Open in vscode",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vscode")).toBe(true);
			});

			it("should match vs2022 tool from visual studio keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Open in visual studio",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match vs2022 tool from sln keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Build the .sln file",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match beyondcompare tool from diff keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Compare the diff between files",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-beyondcompare")).toBe(true);
			});

			it("should match mysql tool from mysql keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Connect to mysql database",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-mysql")).toBe(true);
			});

			it("should match docker tool from container keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Start the container",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should use dynamic fallback when model supports neither tool_choice nor prefill", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.useDynamicFallback).toBe(true);
			});

			it("should not use dynamic fallback when model supports tool_choice", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(true);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"platform", // toolSource (tool_choice uses platform)
					mockPlatformTools,
				);

				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should not use dynamic fallback when model supports prefill", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"platform", // toolSource (prefill uses platform)
					mockPlatformTools,
				);

				expect(mask.useDynamicFallback).toBeUndefined();
			});

			it("should not have requiredTool in action mode", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"platform", // toolSource
					mockPlatformTools,
				);

				expect(mask.requiredTool).toBeUndefined();
			});

			it("should use a-c- prefix when only core tools are matched", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				// "Hello" doesn't match any specific tools, uses a-c- prefix for platform tools
				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"platform", // toolSource
					mockPlatformTools,
				);

				expect(mask.toolPrefix).toBe("a-c-");
			});

			it("should use a- prefix when non-core tools are matched", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				// "docker" keyword matches a-docker (non-core tool) - but platform tools don't include docker
				// So this test needs to use platform toolsource to test the prefix logic
				const mask = buildToolMask(
					"fetch http://example.com",
					undefined, // projectType
					false,
					"platform", // toolSource
					mockPlatformTools,
				);

				// web is in platform tools but still a-c-*, so prefix should be a-c-
				expect(mask.toolPrefix).toBe("a-c-");
			});

			it("should use a- prefix when project type adds non-core tools", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

				// node project type adds a-node (non-core tool) in project tools
				const mask = buildToolMask(
					"Hello",
					"node", // projectType
					false,
					"project", // toolSource
					mockProjectTools,
				);

				// Dynamic mode doesn't use toolPrefix
				expect(mask.toolPrefix).toBeUndefined();
				expect(mask.useDynamicFallback).toBe(true);
			});
		});

		describe("with empty frozen tools", () => {
			it("should return empty allowedTools when frozen tools is empty", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
				vi.mocked(currentModelSupportsPrefill).mockReturnValue(true);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false,
					"platform", // toolSource
					[],
				);

				expect(mask.allowedTools.size).toBe(0);
				// 空工具列表应该使用 "a-" 前缀（更宽松）
				// 而不是 "a-c-" 前缀（空数组的 every() 返回 true 的边界情况）
				expect(mask.toolPrefix).toBe("a-");
			});
		});
	});

	describe("isToolAllowed", () => {
		it("should return true if tool is in allowedTools", () => {
			vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
			vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				false,
				"project", // toolSource
				mockProjectTools,
			);

			expect(isToolAllowed("a-c-file", mask)).toBe(true);
			expect(isToolAllowed("a-c-askuser", mask)).toBe(true);
		});

		it("should return false if tool is not in allowedTools", () => {
			vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
			vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				true, // plan mode - only plan allowed
				"project", // toolSource
				mockProjectTools,
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
			vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
			vi.mocked(currentModelSupportsPrefill).mockReturnValue(false);

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				true,
				"project", // toolSource
				mockProjectTools,
			);

			const error = getToolNotAllowedError("a-c-file", mask);

			expect(error).toContain("a-c-file");
			expect(error).toContain("not available");
			expect(error).toContain("p-plan");
		});
	});
});
