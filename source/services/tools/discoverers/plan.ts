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
	capabilities: ["read", "write"],
	actions: [
		{
			name: "read",
			description: "Read the current plan file content",
			parameters: [],
			commandTemplate: "__PLAN_READ__",
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
			],
			commandTemplate: "__PLAN_EDIT__",
		},
	],
};

export async function detectPlan(): Promise<DiscoveredTool> {
	// Plan tool is always available (builtin)
	return createInstalledTool(planDefinition, "builtin", "1.0.0");
}

/**
 * Get the plan file path for a given working directory
 */
export function getPlanFilePath(cwd: string): string {
	return join(cwd, ".axiomate", "plans", "plan.md");
}
