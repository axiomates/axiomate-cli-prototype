/**
 * Beyond Compare tool discoverer
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
	id: "a-beyondcompare",
	name: "Beyond Compare",
	description: "Powerful file and folder comparison tool",
	category: "diff",
	capabilities: ["diff", "merge"],
	actions: [
		{
			name: "diff",
			description: "Compare two files or folders",
			parameters: [
				{
					name: "left",
					description: "Left file/folder",
					type: "string",
					required: true,
				},
				{
					name: "right",
					description: "Right file/folder",
					type: "string",
					required: true,
				},
			],
			commandTemplate: '"{{execPath}}" "{{left}}" "{{right}}"',
		},
		{
			name: "merge",
			description: "Three-way merge",
			parameters: [
				{
					name: "left",
					description: "Left version",
					type: "file",
					required: true,
				},
				{
					name: "right",
					description: "Right version",
					type: "file",
					required: true,
				},
				{
					name: "base",
					description: "Base version",
					type: "file",
					required: true,
				},
				{
					name: "output",
					description: "Output file",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'"{{execPath}}" "{{left}}" "{{right}}" "{{base}}" -o "{{output}}"',
		},
		{
			name: "folder_sync",
			description: "Folder synchronization",
			parameters: [
				{
					name: "source",
					description: "Source folder",
					type: "directory",
					required: true,
				},
				{
					name: "target",
					description: "Target folder",
					type: "directory",
					required: true,
				},
			],
			commandTemplate: '"{{execPath}}" /sync "{{source}}" "{{target}}"',
		},
	],
	installHint: "Download from https://www.scootersoftware.com/download",
};

export async function detectBeyondCompare(): Promise<DiscoveredTool> {
	if (!isWindows) {
		// macOS/Linux detection paths are different, simplified handling
		return createNotInstalledTool(bcDefinition);
	}

	// Try to get install path from registry
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
			// Infer version from registry path
			if (regPath.includes("Beyond Compare 5")) {
				bcVersion = "5";
			} else if (regPath.includes("Beyond Compare 4")) {
				bcVersion = "4";
			}
			break;
		}
	}

	// If not found in registry, try common install paths
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
