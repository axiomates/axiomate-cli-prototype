/**
 * Plan file operations handler
 * Handles plan file read, write, edit, append, search, and read_lines actions
 */

import type { RegisteredHandler, ExecutionResult } from "./types.js";
import {
	readFileContent,
	writeFileContent,
	editFileContent,
	readFileLines,
	searchInFile,
} from "../fileOperations.js";
import { getPlanFilePath } from "../discoverers/plan.js";

/**
 * Plan file handler - handles all __PLAN_* file operations (not mode switching)
 */
export const planFileHandler: RegisteredHandler = {
	name: "planFile",
	matches: (ctx) => {
		const template = ctx.action.commandTemplate;
		return template.startsWith("__PLAN_") && !template.includes("_MODE__");
	},
	handle: async (ctx) => {
		const { action, params, options } = ctx;
		const cwd = options?.cwd || process.cwd();
		const planPath = getPlanFilePath(cwd);

		switch (action.commandTemplate) {
			case "__PLAN_READ__":
				return handlePlanRead(planPath);
			case "__PLAN_READ_LINES__":
				return handlePlanReadLines(planPath, params);
			case "__PLAN_WRITE__":
				return handlePlanWrite(planPath, params);
			case "__PLAN_APPEND__":
				return handlePlanAppend(planPath, params);
			case "__PLAN_EDIT__":
				return handlePlanEdit(planPath, params);
			case "__PLAN_SEARCH__":
				return handlePlanSearch(planPath, params);
			default:
				return {
					success: false,
					stdout: "",
					stderr: "",
					exitCode: null,
					error: `Unknown plan action: ${action.commandTemplate}`,
				};
		}
	},
};

function handlePlanRead(planPath: string): ExecutionResult {
	const result = readFileContent(planPath);
	return {
		success: true, // Always success, even if file doesn't exist
		stdout: result.content || "[No plan file exists yet]",
		stderr: "",
		exitCode: 0,
	};
}

function handlePlanReadLines(
	planPath: string,
	params: Record<string, unknown>,
): ExecutionResult {
	const startLine = (params.start_line as number) || 1;
	const endLine = (params.end_line as number) ?? -1;

	const result = readFileLines(planPath, startLine, endLine);
	const header = result.success
		? `[Lines ${result.startLine}-${result.endLine} of ${result.totalLines}]\n`
		: "";

	return {
		success: result.success,
		stdout: result.success ? header + (result.lines?.join("\n") || "") : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handlePlanWrite(
	planPath: string,
	params: Record<string, unknown>,
): ExecutionResult {
	const content = params.content as string;
	const result = writeFileContent(planPath, content, "overwrite");

	return {
		success: result.success,
		stdout: result.success ? `Plan written to ${result.path}` : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handlePlanAppend(
	planPath: string,
	params: Record<string, unknown>,
): ExecutionResult {
	const content = params.content as string;
	const result = writeFileContent(planPath, content, "append");

	return {
		success: result.success,
		stdout: result.success ? `Content appended to ${result.path}` : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handlePlanEdit(
	planPath: string,
	params: Record<string, unknown>,
): ExecutionResult {
	const oldContent = params.old_content as string;
	const newContent = params.new_content as string;
	const replaceAll = params.replace_all === true;

	const result = editFileContent(planPath, oldContent, newContent, replaceAll);

	return {
		success: result.success,
		stdout: result.success ? "Plan updated" : "",
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}

function handlePlanSearch(
	planPath: string,
	params: Record<string, unknown>,
): ExecutionResult {
	const pattern = params.pattern as string;
	const isRegex = params.regex === true;
	const maxMatches = (params.max_matches as number) || 100;

	const searchPattern = isRegex ? new RegExp(pattern, "gm") : pattern;
	const result = searchInFile(planPath, searchPattern, maxMatches);

	const output = result.success
		? result.matches.length > 0
			? result.matches
					.map((m) => `${m.line}:${m.column}: ${m.content}`)
					.join("\n")
			: "(no matches)"
		: "";

	return {
		success: result.success,
		stdout: output,
		stderr: "",
		exitCode: result.success ? 0 : 1,
		error: result.error,
	};
}
