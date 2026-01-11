/**
 * Plan tool discoverer
 *
 * Provides plan file management for plan mode.
 * This tool is restricted to only operate on .axiomate/plans/plan.md
 */

import { join } from "node:path";
import type { DiscoveredTool, ToolDefinition } from "../types.js";
import { createInstalledTool } from "./base.js";

const planDefinition: ToolDefinition = {
	id: "plan",
	name: "Plan",
	description: "Plan file management (restricted to .axiomate/plans/plan.md)",
	category: "utility",
	capabilities: ["read", "write", "search"],
	actions: [
		{
			name: "read",
			description: "Read the current plan file content",
			parameters: [],
			commandTemplate: "__PLAN_READ__",
		},
		{
			name: "read_lines",
			description: "Read specific line range from plan file",
			parameters: [
				{
					name: "start_line",
					description: "Start line (1-based, default: 1)",
					type: "number",
					required: false,
					default: 1,
				},
				{
					name: "end_line",
					description: "End line (1-based, -1 for EOF, default: -1)",
					type: "number",
					required: false,
					default: -1,
				},
			],
			commandTemplate: "__PLAN_READ_LINES__",
		},
		{
			name: "write",
			description: "Write or replace the entire plan file",
			parameters: [
				{
					name: "content",
					description: "Complete plan content in Markdown",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "__PLAN_WRITE__",
		},
		{
			name: "append",
			description: "Append content to the end of plan file",
			parameters: [
				{
					name: "content",
					description: "Content to append",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "__PLAN_APPEND__",
		},
		{
			name: "edit",
			description: "Replace specific content in plan file",
			parameters: [
				{
					name: "old_content",
					description: "Content to find and replace",
					type: "string",
					required: true,
				},
				{
					name: "new_content",
					description: "Replacement content",
					type: "string",
					required: true,
				},
				{
					name: "replace_all",
					description: "Replace all occurrences (default: false)",
					type: "boolean",
					required: false,
					default: false,
				},
			],
			commandTemplate: "__PLAN_EDIT__",
		},
		{
			name: "search",
			description: "Search for pattern in plan file",
			parameters: [
				{
					name: "pattern",
					description: "Search pattern (string or regex)",
					type: "string",
					required: true,
				},
				{
					name: "regex",
					description: "Treat pattern as regex (default: false)",
					type: "boolean",
					required: false,
					default: false,
				},
				{
					name: "max_matches",
					description: "Maximum matches to return (default: 100)",
					type: "number",
					required: false,
					default: 100,
				},
			],
			commandTemplate: "__PLAN_SEARCH__",
		},
		{
			name: "leave",
			description:
				"Leave Plan Mode and switch to Action Mode. Takes effect immediately.",
			parameters: [],
			commandTemplate: "__PLAN_EXIT_MODE__",
		},
	],
};

/**
 * Mode switching tool definition
 * Separate from plan tool so it's not restricted by plan_ prefix in Plan mode
 */
const enterPlanDefinition: ToolDefinition = {
	id: "enterplan",
	name: "Enter Plan Mode",
	description: "Switch to Plan Mode for exploration and planning",
	category: "utility",
	capabilities: ["execute"],
	actions: [
		{
			name: "enter",
			description:
				"Switch to Plan Mode (read-only exploration and planning). In Plan Mode you can only use plan tools (plan_read, plan_write, plan_edit). Takes effect immediately.",
			parameters: [],
			commandTemplate: "__PLAN_ENTER_MODE__",
		},
	],
};

export async function detectPlan(): Promise<DiscoveredTool> {
	// Plan tool is always available (builtin)
	return createInstalledTool(planDefinition, "builtin", "1.0.0");
}

export async function detectEnterPlan(): Promise<DiscoveredTool> {
	// Enter plan mode tool is always available (builtin)
	return createInstalledTool(enterPlanDefinition, "builtin", "1.0.0");
}

/**
 * Get the plan file path for a given working directory
 */
export function getPlanFilePath(cwd: string): string {
	return join(cwd, ".axiomate", "plans", "plan.md");
}
