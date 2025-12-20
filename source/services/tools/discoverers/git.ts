/**
 * Git 工具发现器
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
	id: "git",
	name: "Git",
	description: "分布式版本控制系统",
	category: "vcs",
	capabilities: ["execute"],
	actions: [
		{
			name: "status",
			description: "查看仓库状态",
			parameters: [],
			commandTemplate: "git status",
		},
		{
			name: "diff",
			description: "查看文件变更",
			parameters: [
				{
					name: "file",
					description: "文件路径（可选）",
					type: "file",
					required: false,
				},
			],
			commandTemplate: "git diff {{file}}",
		},
		{
			name: "log",
			description: "查看提交历史",
			parameters: [
				{
					name: "count",
					description: "显示条数",
					type: "number",
					required: false,
					default: 10,
				},
			],
			commandTemplate: "git log --oneline -{{count}}",
		},
		{
			name: "add",
			description: "添加文件到暂存区",
			parameters: [
				{
					name: "file",
					description: "文件路径（使用 . 添加所有）",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "git add {{file}}",
		},
		{
			name: "commit",
			description: "提交变更",
			parameters: [
				{
					name: "message",
					description: "提交信息",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'git commit -m "{{message}}"',
		},
		{
			name: "push",
			description: "推送到远程仓库",
			parameters: [],
			commandTemplate: "git push",
		},
		{
			name: "pull",
			description: "从远程仓库拉取",
			parameters: [],
			commandTemplate: "git pull",
		},
		{
			name: "branch",
			description: "列出分支",
			parameters: [],
			commandTemplate: "git branch -a",
		},
		{
			name: "checkout",
			description: "切换分支",
			parameters: [
				{
					name: "branch",
					description: "分支名",
					type: "string",
					required: true,
				},
			],
			commandTemplate: "git checkout {{branch}}",
		},
	],
	installHint: "从 https://git-scm.com/downloads 下载安装",
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
