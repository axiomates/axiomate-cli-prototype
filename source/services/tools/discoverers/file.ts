/**
 * File tool discoverer
 *
 * Provides file operations with auto encoding detection.
 * This is a builtin tool that is always available.
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import { createInstalledTool } from "./base.js";

const fileDefinition: ToolDefinition = {
	id: "file",
	name: "File",
	description: "File operations with auto encoding detection",
	category: "utility",
	capabilities: ["read", "write", "search"],
	actions: [
		{
			name: "read",
			description: "Read file with auto encoding detection",
			parameters: [
				{
					name: "path",
					description: "File path (absolute or relative to cwd)",
					type: "file",
					required: true,
				},
				{
					name: "encoding",
					description: "Force encoding (e.g., utf-8, gbk, shift-jis)",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "__FILE_READ__",
		},
		{
			name: "read_lines",
			description: "Read specific line range from file",
			parameters: [
				{
					name: "path",
					description: "File path",
					type: "file",
					required: true,
				},
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
			commandTemplate: "__FILE_READ_LINES__",
		},
		{
			name: "write",
			description: "Write file (preserves encoding for existing files, UTF-8 for new)",
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
				{
					name: "encoding",
					description: "Force encoding (default: auto)",
					type: "string",
					required: false,
				},
			],
			commandTemplate: "__FILE_WRITE__",
		},
		{
			name: "edit",
			description: "Replace content (preserves original encoding)",
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
		{
			name: "search",
			description: "Search for pattern in file",
			parameters: [
				{
					name: "path",
					description: "File path",
					type: "file",
					required: true,
				},
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
			commandTemplate: "__FILE_SEARCH__",
		},
	],
};

export async function detectFile(): Promise<DiscoveredTool> {
	// File tool is always available (builtin)
	return createInstalledTool(fileDefinition, "builtin", "1.0.0");
}
