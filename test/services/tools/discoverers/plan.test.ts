import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectPlan,
	getPlanFilePath,
} from "../../../../source/services/tools/discoverers/plan.js";

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	createInstalledTool: vi.fn((def, path, version) => ({
		...def,
		executablePath: path,
		version,
		installed: true,
	})),
}));

import { createInstalledTool } from "../../../../source/services/tools/discoverers/base.js";

describe("plan discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectPlan", () => {
		it("should return an installed tool (always available)", async () => {
			const result = await detectPlan();

			expect(result.installed).toBe(true);
			expect(result.id).toBe("plan");
		});

		it("should have correct tool properties", async () => {
			const result = await detectPlan();

			expect(result.name).toBe("Plan");
			expect(result.category).toBe("utility");
			expect(result.capabilities).toContain("read");
			expect(result.capabilities).toContain("write");
			expect(result.capabilities).toContain("search");
		});

		it("should have read action with no parameters", async () => {
			const result = await detectPlan();

			const readAction = result.actions?.find((a) => a.name === "read");
			expect(readAction).toBeDefined();
			expect(readAction?.commandTemplate).toBe("__PLAN_READ__");
			expect(readAction?.parameters?.length).toBe(0);
		});

		it("should have read_lines action with correct parameters", async () => {
			const result = await detectPlan();

			const readLinesAction = result.actions?.find(
				(a) => a.name === "read_lines",
			);
			expect(readLinesAction).toBeDefined();
			expect(readLinesAction?.commandTemplate).toBe("__PLAN_READ_LINES__");

			const startLineParam = readLinesAction?.parameters?.find(
				(p) => p.name === "start_line",
			);
			expect(startLineParam).toBeDefined();
			expect(startLineParam?.default).toBe(1);

			const endLineParam = readLinesAction?.parameters?.find(
				(p) => p.name === "end_line",
			);
			expect(endLineParam).toBeDefined();
			expect(endLineParam?.default).toBe(-1);
		});

		it("should have write action with content parameter", async () => {
			const result = await detectPlan();

			const writeAction = result.actions?.find((a) => a.name === "write");
			expect(writeAction).toBeDefined();
			expect(writeAction?.commandTemplate).toBe("__PLAN_WRITE__");

			const contentParam = writeAction?.parameters?.find(
				(p) => p.name === "content",
			);
			expect(contentParam).toBeDefined();
			expect(contentParam?.required).toBe(true);
		});

		it("should have append action with content parameter", async () => {
			const result = await detectPlan();

			const appendAction = result.actions?.find((a) => a.name === "append");
			expect(appendAction).toBeDefined();
			expect(appendAction?.commandTemplate).toBe("__PLAN_APPEND__");

			const contentParam = appendAction?.parameters?.find(
				(p) => p.name === "content",
			);
			expect(contentParam).toBeDefined();
			expect(contentParam?.required).toBe(true);
		});

		it("should have edit action with correct parameters", async () => {
			const result = await detectPlan();

			const editAction = result.actions?.find((a) => a.name === "edit");
			expect(editAction).toBeDefined();
			expect(editAction?.commandTemplate).toBe("__PLAN_EDIT__");

			const oldContentParam = editAction?.parameters?.find(
				(p) => p.name === "old_content",
			);
			expect(oldContentParam).toBeDefined();
			expect(oldContentParam?.required).toBe(true);

			const newContentParam = editAction?.parameters?.find(
				(p) => p.name === "new_content",
			);
			expect(newContentParam).toBeDefined();
			expect(newContentParam?.required).toBe(true);

			const replaceAllParam = editAction?.parameters?.find(
				(p) => p.name === "replace_all",
			);
			expect(replaceAllParam).toBeDefined();
			expect(replaceAllParam?.default).toBe(false);
		});

		it("should have search action with correct parameters", async () => {
			const result = await detectPlan();

			const searchAction = result.actions?.find((a) => a.name === "search");
			expect(searchAction).toBeDefined();
			expect(searchAction?.commandTemplate).toBe("__PLAN_SEARCH__");

			const patternParam = searchAction?.parameters?.find(
				(p) => p.name === "pattern",
			);
			expect(patternParam).toBeDefined();
			expect(patternParam?.required).toBe(true);

			const regexParam = searchAction?.parameters?.find(
				(p) => p.name === "regex",
			);
			expect(regexParam).toBeDefined();
			expect(regexParam?.default).toBe(false);

			const maxMatchesParam = searchAction?.parameters?.find(
				(p) => p.name === "max_matches",
			);
			expect(maxMatchesParam).toBeDefined();
			expect(maxMatchesParam?.default).toBe(100);
		});

		it("should have enter_mode action with no parameters", async () => {
			const result = await detectPlan();

			const enterModeAction = result.actions?.find(
				(a) => a.name === "enter_mode",
			);
			expect(enterModeAction).toBeDefined();
			expect(enterModeAction?.commandTemplate).toBe("__PLAN_ENTER_MODE__");
			expect(enterModeAction?.parameters?.length).toBe(0);
		});

		it("should have exit_mode action with no parameters", async () => {
			const result = await detectPlan();

			const exitModeAction = result.actions?.find(
				(a) => a.name === "exit_mode",
			);
			expect(exitModeAction).toBeDefined();
			expect(exitModeAction?.commandTemplate).toBe("__PLAN_EXIT_MODE__");
			expect(exitModeAction?.parameters?.length).toBe(0);
		});

		it("should have all 8 actions", async () => {
			const result = await detectPlan();

			expect(result.actions?.length).toBe(8);
			const actionNames = result.actions?.map((a) => a.name);
			expect(actionNames).toContain("read");
			expect(actionNames).toContain("read_lines");
			expect(actionNames).toContain("write");
			expect(actionNames).toContain("append");
			expect(actionNames).toContain("edit");
			expect(actionNames).toContain("search");
			expect(actionNames).toContain("enter_mode");
			expect(actionNames).toContain("exit_mode");
		});

		it("should call createInstalledTool with correct arguments", async () => {
			await detectPlan();

			expect(createInstalledTool).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "plan",
					name: "Plan",
					category: "utility",
				}),
				"builtin",
				"1.0.0",
			);
		});
	});

	describe("getPlanFilePath", () => {
		it("should return correct path for Unix-style cwd", () => {
			const result = getPlanFilePath("/home/user/project");

			expect(result).toContain(".axiomate");
			expect(result).toContain("plans");
			expect(result).toContain("plan.md");
		});

		it("should return correct path for Windows-style cwd", () => {
			const result = getPlanFilePath("C:\\Users\\project");

			expect(result).toContain(".axiomate");
			expect(result).toContain("plans");
			expect(result).toContain("plan.md");
		});

		it("should handle empty cwd", () => {
			const result = getPlanFilePath("");

			expect(result).toContain(".axiomate");
			expect(result).toContain("plan.md");
		});
	});
});
