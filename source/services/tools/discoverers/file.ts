/**
 * File tool discoverer
 *
 * Provides universal UTF-8 file read/write operations.
 * This is a builtin tool that is always available.
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import { createInstalledTool } from "./base.js";

const fileDefinition: ToolDefinition = {
	id: "file",
	name: "File",
	description: "UTF-8 file read/write operations",
	category: "utility",
	capabilities: ["read", "write"],
	actions: [
		{
			name: "read",
			description: "Read file content as UTF-8",
			parameters: [
				{
					name: "path",
					description: "File path (absolute or relative to cwd)",
					type: "file",
					required: true,
				},
			],
			commandTemplate: "__FILE_READ__",
		},
		{
			name: "write",
			description: "Write content to file (creates directories if needed)",
			parameters: [
				{
					name: "path",
					description: "File path",
					type: "file",
					required: true,
				},
				{
					name: "content",
					description: "Content to write",
					type: "string",
					required: true,
				},
				{
					name: "mode",
					description: "Write mode: overwrite (default) or append",
					type: "string",
					required: false,
					default: "overwrite",
				},
			],
			commandTemplate: "__FILE_WRITE__",
		},
		{
			name: "edit",
			description: "Replace content in existing file",
			parameters: [
				{
					name: "path",
					description: "File path",
					type: "file",
					required: true,
				},
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
			commandTemplate: "__FILE_EDIT__",
		},
	],
};

export async function detectFile(): Promise<DiscoveredTool> {
	// File tool is always available (builtin)
	return createInstalledTool(fileDefinition, "builtin", "1.0.0");
}
