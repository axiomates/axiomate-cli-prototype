/**
 * Ask User tool discoverer
 *
 * Provides a builtin tool for AI to ask user questions and wait for response.
 * This is a builtin tool that is always available.
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import { createInstalledTool } from "./base.js";

const askUserDefinition: ToolDefinition = {
	id: "a-c-askuser",
	name: "Ask User",
	description:
		"Ask user a question when clarification is needed. " +
		"Always provide 2-3 thoughtful options representing different approaches to help user decide quickly.",
	category: "utility",
	capabilities: ["execute"],
	actions: [
		{
			name: "ask",
			description:
				"Ask the user a question to gather preferences, clarify requirements, or get a decision. " +
				"You MUST provide 2-3 options that represent your best suggestions for different approaches or directions. " +
				"Think about what the user might want and offer distinct alternatives. " +
				"User can select from your suggestions or provide custom input if none fit.",
			parameters: [
				{
					name: "question",
					description:
						"A clear, specific question ending with a question mark.",
					type: "string",
					required: true,
				},
				{
					name: "options",
					description:
						"JSON array of 2-3 options representing different approaches YOU think are best suited for the situation. " +
						'Example: \'["Use TypeScript for type safety", "Use JavaScript for simplicity", "Use both with gradual migration"]\'. ' +
						"Each option should be a distinct direction, not variations of the same thing. Maximum 3 options.",
					type: "string",
					required: true,
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
