/**
 * Plan mode control handler
 * Handles switching between Plan Mode and Action Mode
 */

import type { RegisteredHandler } from "./types.js";
import { setPlanModeEnabled } from "../../../utils/config.js";

/**
 * Plan mode handler - handles __PLAN_ENTER_MODE__ and __PLAN_EXIT_MODE__
 */
export const planModeHandler: RegisteredHandler = {
	name: "planMode",
	matches: (ctx) => {
		const template = ctx.action.commandTemplate;
		return (
			template === "__PLAN_ENTER_MODE__" || template === "__PLAN_EXIT_MODE__"
		);
	},
	handle: async (ctx) => {
		const { action } = ctx;

		if (action.commandTemplate === "__PLAN_ENTER_MODE__") {
			setPlanModeEnabled(true);
			return {
				success: true,
				stdout:
					"Switched to Plan Mode. You now have access to plan tools only (read/write/edit plan file).",
				stderr: "",
				exitCode: 0,
			};
		}

		if (action.commandTemplate === "__PLAN_EXIT_MODE__") {
			setPlanModeEnabled(false);
			return {
				success: true,
				stdout:
					"Switched to Action Mode. You now have access to all tools (file, git, etc.).",
				stderr: "",
				exitCode: 0,
			};
		}

		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: `Unknown plan mode action: ${action.commandTemplate}`,
		};
	},
};
