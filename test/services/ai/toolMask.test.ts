import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { initI18n, setLocale } from "../../../source/i18n/index.js";

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
		id: "web_fetch",
		name: "Web Fetch",
		category: "web",
		installed: true,
		capabilities: ["fetch"],
		keywords: ["web", "http"],
	},
	{
		id: "ask_user",
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
];

describe("toolMask", () => {
	describe("buildToolMask", () => {
		describe("Plan mode", () => {
			it("should only allow plan tool in plan mode", () => {
				const mask = buildToolMask(
					"Create a plan for this project",
					{ cwd: "/project" },
					true, // planMode
					mockFrozenTools,
				);

				expect(mask.mode).toBe("plan");
				expect(mask.allowedTools.has("plan")).toBe(true);
				expect(mask.allowedTools.size).toBe(1);
				expect(mask.requiredTool).toBe("plan_create");
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
				expect(mask.allowedTools.has("ask_user")).toBe(true);
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

				expect(mask.allowedTools.has("web_fetch")).toBe(true);
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

			it("should match docker tool from docker keyword", () => {
				const mask = buildToolMask(
					"Build the docker image",
					{ cwd: "/project" },
					false,
					mockFrozenTools,
				);

				expect(mask.allowedTools.has("docker")).toBe(true);
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
			expect(isToolAllowed("ask_user", mask)).toBe(true);
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
