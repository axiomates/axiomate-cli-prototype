import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

// Mock config module for model capability checks
vi.mock("../../../source/utils/config.js", () => ({
	currentModelSupportsToolChoice: vi.fn(() => false),
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
import { currentModelSupportsToolChoice } from "../../../source/utils/config.js";

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

describe("toolMask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset to default: no tool_choice support
		vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);
	});

	describe("buildToolMask", () => {
		describe("Plan mode", () => {
			it("should use tool_choice when model supports it", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(true);

				const mask = buildToolMask(
					"Create a plan",
					undefined, // projectType
					true, // planMode
					mockPlatformTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.useDynamicFiltering).toBeUndefined();
			});

			it("should use dynamic filtering when model does not support tool_choice", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Create a plan",
					undefined, // projectType
					true, // planMode
					mockProjectTools,
				);

				expect(mask.mode).toBe("p");
				expect(mask.allowedTools.has("p-plan")).toBe(true);
				expect(mask.useDynamicFiltering).toBe(true);
			});
		});

		describe("Action mode", () => {
			it("should include base tools", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.allowedTools.has("a-c-askuser")).toBe(true);
				expect(mask.allowedTools.has("a-c-file")).toBe(true);
				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should include git by default", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match web tool from http keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Fetch https://example.com",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match web tool from url keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Get the url content",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-web")).toBe(true);
			});

			it("should match git tool from git keywords", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"commit these changes",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match git tool from branch keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"create a new branch",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-c-git")).toBe(true);
			});

			it("should match docker tool from docker keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Build the docker image",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should match node tool from npm keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Run npm install",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
			});

			it("should add node tools for node project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Install dependencies",
					"node", // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-node")).toBe(true);
				expect(mask.allowedTools.has("a-npm")).toBe(true);
			});

			it("should add tools for python project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"python", // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should add tools for java project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"java", // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
				expect(mask.allowedTools.has("a-javac")).toBe(true);
				expect(mask.allowedTools.has("a-maven")).toBe(true);
				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should add tools for dotnet project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"dotnet", // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-msbuild")).toBe(true);
				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should add tools for cpp project type", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"cpp", // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should handle rust project type gracefully", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"rust", // projectType
					false, // planMode
					mockProjectTools,
				);

				// rust tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should handle go project type gracefully", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					"go", // projectType
					false, // planMode
					mockProjectTools,
				);

				// go tools not implemented yet, but should not error
				expect(mask.mode).toBe("a");
			});

			it("should match cmake tool from cmake keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Run cmake to build",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-cmake")).toBe(true);
			});

			it("should match maven tool from maven keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Run maven clean install",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-maven")).toBe(true);
			});

			it("should match gradle tool from gradle keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Execute gradle build",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-gradle")).toBe(true);
			});

			it("should match python tool from pip keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Install packages with pip",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-python")).toBe(true);
			});

			it("should match java tool from java keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Compile the java code",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-java")).toBe(true);
			});

			it("should match vscode tool from vscode keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Open in vscode",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vscode")).toBe(true);
			});

			it("should match vs2022 tool from visual studio keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Open in visual studio",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match vs2022 tool from sln keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Build the .sln file",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-vs2022")).toBe(true);
			});

			it("should match beyondcompare tool from diff keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Compare the diff between files",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-beyondcompare")).toBe(true);
			});

			it("should match mysql tool from mysql keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Connect to mysql database",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-mysql")).toBe(true);
			});

			it("should match docker tool from container keyword", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Start the container",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.allowedTools.has("a-docker")).toBe(true);
			});

			it("should use dynamic filtering when model does not support tool_choice", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false, // planMode
					mockProjectTools,
				);

				expect(mask.mode).toBe("a");
				expect(mask.useDynamicFiltering).toBe(true);
			});

			it("should not have requiredTool in action mode", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false, // planMode
					mockPlatformTools,
				);

				expect(mask.requiredTool).toBeUndefined();
			});
		});

		describe("with empty tools", () => {
			it("should return empty allowedTools when tools is empty", () => {
				vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

				const mask = buildToolMask(
					"Hello",
					undefined, // projectType
					false, // planMode
					[],
				);

				expect(mask.allowedTools.size).toBe(0);
			});
		});
	});

	describe("isToolAllowed", () => {
		it("should return true if tool is in allowedTools", () => {
			vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				false, // planMode
				mockProjectTools,
			);

			expect(isToolAllowed("a-c-file", mask)).toBe(true);
			expect(isToolAllowed("a-c-askuser", mask)).toBe(true);
		});

		it("should return false if tool is not in allowedTools", () => {
			vi.mocked(currentModelSupportsToolChoice).mockReturnValue(false);

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				true, // plan mode - only plan allowed
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

			const mask = buildToolMask(
				"Hello",
				undefined, // projectType
				true, // planMode
				mockProjectTools,
			);

			const error = getToolNotAllowedError("a-c-file", mask);

			expect(error).toContain("a-c-file");
			expect(error).toContain("not available");
			expect(error).toContain("p-plan");
		});
	});
});
