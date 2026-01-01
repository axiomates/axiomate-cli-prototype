import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectFile } from "../../../../source/services/tools/discoverers/file.js";

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

describe("file discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectFile", () => {
		it("should return an installed tool (always available)", async () => {
			const result = await detectFile();

			expect(result.installed).toBe(true);
			expect(result.id).toBe("file");
		});

		it("should have correct tool properties", async () => {
			const result = await detectFile();

			expect(result.name).toBe("File");
			expect(result.category).toBe("utility");
			expect(result.capabilities).toContain("read");
			expect(result.capabilities).toContain("write");
			expect(result.capabilities).toContain("search");
		});

		it("should have read action with correct parameters", async () => {
			const result = await detectFile();

			const readAction = result.actions?.find((a) => a.name === "read");
			expect(readAction).toBeDefined();
			expect(readAction?.commandTemplate).toBe("__FILE_READ__");

			const pathParam = readAction?.parameters?.find((p) => p.name === "path");
			expect(pathParam).toBeDefined();
			expect(pathParam?.type).toBe("file");
			expect(pathParam?.required).toBe(true);

			const encodingParam = readAction?.parameters?.find(
				(p) => p.name === "encoding",
			);
			expect(encodingParam).toBeDefined();
			expect(encodingParam?.required).toBe(false);
		});

		it("should have read_lines action with correct parameters", async () => {
			const result = await detectFile();

			const readLinesAction = result.actions?.find(
				(a) => a.name === "read_lines",
			);
			expect(readLinesAction).toBeDefined();
			expect(readLinesAction?.commandTemplate).toBe("__FILE_READ_LINES__");

			const startLineParam = readLinesAction?.parameters?.find(
				(p) => p.name === "start_line",
			);
			expect(startLineParam).toBeDefined();
			expect(startLineParam?.type).toBe("number");
			expect(startLineParam?.default).toBe(1);

			const endLineParam = readLinesAction?.parameters?.find(
				(p) => p.name === "end_line",
			);
			expect(endLineParam).toBeDefined();
			expect(endLineParam?.default).toBe(-1);
		});

		it("should have write action with correct parameters", async () => {
			const result = await detectFile();

			const writeAction = result.actions?.find((a) => a.name === "write");
			expect(writeAction).toBeDefined();
			expect(writeAction?.commandTemplate).toBe("__FILE_WRITE__");

			const contentParam = writeAction?.parameters?.find(
				(p) => p.name === "content",
			);
			expect(contentParam).toBeDefined();
			expect(contentParam?.required).toBe(true);

			const modeParam = writeAction?.parameters?.find((p) => p.name === "mode");
			expect(modeParam).toBeDefined();
			expect(modeParam?.default).toBe("overwrite");
		});

		it("should have edit action with correct parameters", async () => {
			const result = await detectFile();

			const editAction = result.actions?.find((a) => a.name === "edit");
			expect(editAction).toBeDefined();
			expect(editAction?.commandTemplate).toBe("__FILE_EDIT__");

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
			expect(replaceAllParam?.type).toBe("boolean");
			expect(replaceAllParam?.default).toBe(false);
		});

		it("should have search action with correct parameters", async () => {
			const result = await detectFile();

			const searchAction = result.actions?.find((a) => a.name === "search");
			expect(searchAction).toBeDefined();
			expect(searchAction?.commandTemplate).toBe("__FILE_SEARCH__");

			const patternParam = searchAction?.parameters?.find(
				(p) => p.name === "pattern",
			);
			expect(patternParam).toBeDefined();
			expect(patternParam?.required).toBe(true);

			const regexParam = searchAction?.parameters?.find(
				(p) => p.name === "regex",
			);
			expect(regexParam).toBeDefined();
			expect(regexParam?.type).toBe("boolean");
			expect(regexParam?.default).toBe(false);

			const maxMatchesParam = searchAction?.parameters?.find(
				(p) => p.name === "max_matches",
			);
			expect(maxMatchesParam).toBeDefined();
			expect(maxMatchesParam?.default).toBe(100);
		});

		it("should have all 5 actions", async () => {
			const result = await detectFile();

			expect(result.actions?.length).toBe(5);
			const actionNames = result.actions?.map((a) => a.name);
			expect(actionNames).toContain("read");
			expect(actionNames).toContain("read_lines");
			expect(actionNames).toContain("write");
			expect(actionNames).toContain("edit");
			expect(actionNames).toContain("search");
		});

		it("should call createInstalledTool with correct arguments", async () => {
			await detectFile();

			expect(createInstalledTool).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "file",
					name: "File",
					category: "utility",
				}),
				"builtin",
				"1.0.0",
			);
		});
	});
});
