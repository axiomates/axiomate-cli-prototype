/**
 * Ask User tool discoverer
 *
 * Provides a builtin tool for AI to ask user questions and wait for response.
 * This is a builtin tool that is always available.
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import { createInstalledTool } from "./base.js";

const askUserDefinition: ToolDefinition = {
	id: "askuser",
	name: "Ask User",
	description: "Ask user a question and wait for response",
	category: "utility",
	capabilities: ["execute"],
	actions: [
		{
			name: "ask",
			description:
				"Ask user a question with optional predefined options. User can select from options or provide custom input.",
			parameters: [
				{
					name: "question",
					description: "The question to ask the user",
					type: "string",
					required: true,
				},
				{
					name: "options",
					description:
						'JSON array of predefined options (e.g., \'["Yes", "No", "Maybe"]\'), optional',
					type: "string",
					required: false,
				},
			],
			commandTemplate: "__ASK_USER__",
		},
	],
};

export async function detectAskUser(): Promise<DiscoveredTool> {
	// askuser tool is always available (builtin)
	return createInstalledTool(askUserDefinition, "builtin", "1.0.0");
}
