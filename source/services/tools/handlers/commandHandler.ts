/**
 * Default command handler
 * Executes commands using template rendering
 * This is the fallback handler for all non-special actions
 */

import type { RegisteredHandler } from "./types.js";
import { renderCommandTemplate, executeCommand } from "../executorUtils.js";

/**
 * Command handler - handles template-based command execution
 * This is registered last and matches any action as fallback
 */
export const commandHandler: RegisteredHandler = {
	name: "command",
	matches: () => true, // Fallback handler, always matches
	handle: async (ctx) => {
		const { tool, action, params, options } = ctx;

		const command = renderCommandTemplate(action.commandTemplate, params, tool);

		return executeCommand(command, {
			cwd: options?.cwd,
			env: tool.env,
			timeout: options?.timeout,
		});
	},
};
