/**
 * Beyond Compare 工具发现器
 */

import { platform } from "node:os";
import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	queryRegistry,
	fileExists,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

const isWindows = platform() === "win32";

const bcDefinition: ToolDefinition = {
	id: "beyondcompare",
	name: "Beyond Compare",
	description: "强大的文件和文件夹比较工具",
	category: "diff",
	capabilities: ["diff", "merge"],
	actions: [
		{
			name: "diff",
			description: "比较两个文件或文件夹",
			parameters: [
				{
					name: "left",
					description: "左侧文件/文件夹",
					type: "string",
					required: true,
				},
				{
					name: "right",
					description: "右侧文件/文件夹",
					type: "string",
					required: true,
				},
			],
			commandTemplate: '"{{execPath}}" "{{left}}" "{{right}}"',
		},
		{
			name: "merge",
			description: "三方合并",
			parameters: [
				{
					name: "left",
					description: "左侧版本",
					type: "file",
					required: true,
				},
				{
					name: "right",
					description: "右侧版本",
					type: "file",
					required: true,
				},
				{
					name: "base",
					description: "基础版本",
					type: "file",
					required: true,
				},
				{
					name: "output",
					description: "输出文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'"{{execPath}}" "{{left}}" "{{right}}" "{{base}}" -o "{{output}}"',
		},
		{
			name: "folder_sync",
			description: "文件夹同步",
			parameters: [
				{
					name: "source",
					description: "源文件夹",
					type: "directory",
					required: true,
				},
				{
					name: "target",
					description: "目标文件夹",
					type: "directory",
					required: true,
				},
			],
			commandTemplate: '"{{execPath}}" /sync "{{source}}" "{{target}}"',
		},
	],
	installHint: "从 https://www.scootersoftware.com/download 下载安装",
};

export async function detectBeyondCompare(): Promise<DiscoveredTool> {
	if (!isWindows) {
		// macOS/Linux 上的检测路径不同，简化处理
		return createNotInstalledTool(bcDefinition);
	}

	// 尝试从注册表获取安装路径
	const regPaths = [
		"HKLM\\SOFTWARE\\Scooter Software\\Beyond Compare 4",
		"HKLM\\SOFTWARE\\Scooter Software\\Beyond Compare 5",
		"HKCU\\SOFTWARE\\Scooter Software\\Beyond Compare 4",
		"HKCU\\SOFTWARE\\Scooter Software\\Beyond Compare 5",
	];

	let bcPath: string | null = null;
	let bcVersion: string | null = null;

	for (const regPath of regPaths) {
		const installPath = await queryRegistry(regPath, "ExePath");
		if (installPath && fileExists(installPath)) {
			bcPath = installPath;
			// 从注册表路径推断版本
			if (regPath.includes("Beyond Compare 5")) {
				bcVersion = "5";
			} else if (regPath.includes("Beyond Compare 4")) {
				bcVersion = "4";
			}
			break;
		}
	}

	// 如果注册表没找到，尝试常见安装路径
	if (!bcPath) {
		const defaultPaths = [
			"C:\\Program Files\\Beyond Compare 5\\BComp.exe",
			"C:\\Program Files\\Beyond Compare 4\\BComp.exe",
			"C:\\Program Files (x86)\\Beyond Compare 4\\BComp.exe",
			"C:\\Program Files (x86)\\Beyond Compare 5\\BComp.exe",
		];

		for (const p of defaultPaths) {
			if (fileExists(p)) {
				bcPath = p;
				if (p.includes("Beyond Compare 5")) {
					bcVersion = "5";
				} else if (p.includes("Beyond Compare 4")) {
					bcVersion = "4";
				}
				break;
			}
		}
	}

	if (!bcPath) {
		return createNotInstalledTool(bcDefinition);
	}

	return createInstalledTool(bcDefinition, bcPath, bcVersion || undefined);
}
