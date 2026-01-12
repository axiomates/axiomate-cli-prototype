/**
 * Git tool discoverer
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const gitDefinition: ToolDefinition = {
	id: "a-c-git",
	name: "Git",
	description: "Distributed version control system",
	category: "vcs",
	capabilities: ["execute"],
	actions: [
		{
			name: "status",
			description: "Show repository status",
			parameters: [],
			commandTemplate: "git status",
		},
		{
			name: "diff",
			description: "Show file changes",
			parameters: [
				{
					name: "file",
					description: "File path (optional)",
					type: "file",
					required: false,
				},
			],
			commandTemplate: "git diff {{file}}",
		},
		{
			name: "log",
			description: "Show commit history",
			parameters: [
				{
					name: "count",
					description: "Number of commits to show",
					type: "number",
					required: false,
					default: 10,
				},
			],
			commandTemplate: "git log --oneline -{{count}}",
		},
		{
			name: "add",
			description: "Add files to staging area",
			parameters: [
				{
					name: "file",
					description: "File path (use . to add all)",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "git add {{file}}",
		},
		{
			name: "commit",
			description: "Commit changes",
			parameters: [
				{
					name: "message",
					description: "Commit message",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'git commit -m "{{message}}"',
		},
		{
			name: "push",
			description: "Push to remote repository",
			parameters: [],
			commandTemplate: "git push",
		},
		{
			name: "pull",
			description: "Pull from remote repository",
			parameters: [],
			commandTemplate: "git pull",
		},
		{
			name: "branch",
			description: "List branches",
			parameters: [],
			commandTemplate: "git branch -a",
		},
		{
			name: "checkout",
			description: "Switch branch",
			parameters: [
				{
					name: "branch",
					description: "Branch name",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "git checkout {{branch}}",
		},
	],
	installHint: "Download from https://git-scm.com/downloads",
};

export async function detectGit(): Promise<DiscoveredTool> {
	if (!(await commandExists("git"))) {
		return createNotInstalledTool(gitDefinition);
	}

	const execPath = await getExecutablePath("git");
	const version = await getVersion("git", ["--version"], {
		parseOutput: (output) => {
			// "git version 2.43.0.windows.1" -> "2.43.0"
			const match = output.match(/git version (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		gitDefinition,
		execPath || "git",
		version || undefined,
	);
}
