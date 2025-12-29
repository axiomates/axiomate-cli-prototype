/**
 * Script file writer for AI-generated scripts
 *
 * Creates temporary script files in .axiomate/scripts/ directory
 * with proper UTF-8 encoding for execution by shell tools.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";
import { ensureDir } from "./fileOperations.js";

export type ScriptType = "powershell" | "pwsh" | "python" | "cmd" | "bash";

const SCRIPT_EXTENSIONS: Record<ScriptType, string> = {
	powershell: ".ps1",
	pwsh: ".ps1",
	python: ".py",
	cmd: ".bat",
	bash: ".sh",
};

/**
 * Get the scripts directory path (.axiomate/scripts/ in cwd)
 */
export function getScriptsDir(cwd: string): string {
	return join(cwd, ".axiomate", "scripts");
}

/**
 * Ensure the scripts directory exists
 */
export function ensureScriptsDir(cwd: string): string {
	const scriptsDir = getScriptsDir(cwd);
	// ensureDir creates parent directories for a file path
	// Use a placeholder file path to ensure the scripts directory is created
	ensureDir(join(scriptsDir, ".placeholder"));
	return scriptsDir;
}

/**
 * Generate a unique script filename
 */
export function generateScriptFilename(
	scriptType: ScriptType,
	prefix?: string,
): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	const ext = SCRIPT_EXTENSIONS[scriptType];
	const namePrefix = prefix || "script";
	return `${namePrefix}_${timestamp}_${random}${ext}`;
}

/**
 * Write script content to a temporary file
 * Returns the absolute path to the created script file
 */
export function writeScript(
	cwd: string,
	scriptType: ScriptType,
	content: string,
	options?: {
		prefix?: string;
		filename?: string;
	},
): string {
	const scriptsDir = ensureScriptsDir(cwd);
	const filename =
		options?.filename || generateScriptFilename(scriptType, options?.prefix);
	const filePath = join(scriptsDir, filename);

	// Normalize line endings based on script type and platform
	let normalizedContent = content;

	// PowerShell and CMD on Windows should use CRLF
	// Bash scripts should use LF
	if (scriptType === "bash") {
		// Ensure LF line endings for bash
		normalizedContent = content.replace(/\r\n/g, "\n");
	} else if (platform() === "win32" && scriptType !== "python") {
		// Ensure CRLF for Windows batch/PowerShell
		normalizedContent = content.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
	}

	// For PowerShell scripts, add UTF-8 BOM so PowerShell 5.1 reads the file correctly
	// PowerShell 5.1 defaults to system encoding (e.g., GBK) without BOM
	// pwsh (PowerShell Core) also benefits from BOM for consistency
	if (scriptType === "powershell" || scriptType === "pwsh") {
		const bom = Buffer.from([0xef, 0xbb, 0xbf]); // UTF-8 BOM
		const contentBuffer = Buffer.from(normalizedContent, "utf8");
		writeFileSync(filePath, Buffer.concat([bom, contentBuffer]));
	} else {
		// Write with UTF-8 encoding (no BOM)
		writeFileSync(filePath, normalizedContent, { encoding: "utf8" });
	}

	return filePath;
}

/**
 * Build the command template for creating and running a script
 * This returns a command that can be executed by the shell
 */
export function buildScriptCommand(
	scriptType: ScriptType,
	scriptPath: string,
): string {
	// Use forward slashes for cross-platform compatibility in command
	const normalizedPath = scriptPath.replace(/\\/g, "/");

	switch (scriptType) {
		case "powershell":
			// Script file has UTF-8 BOM, so PowerShell reads it correctly
			// Set all UTF-8 encodings for proper I/O
			return `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::InputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8;$OutputEncoding=[Text.Encoding]::UTF8; & '${normalizedPath}'"`;
		case "pwsh":
			// PowerShell Core still needs OutputEncoding set on Windows for proper console output
			return `pwsh -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; & '${normalizedPath}'"`;
		case "python":
			// Python uses PYTHONUTF8 and PYTHONIOENCODING env vars for UTF-8
			return `python "${normalizedPath}"`;
		case "cmd":
			// CMD needs chcp 65001 for UTF-8 console output
			return `chcp 65001 >nul & "${normalizedPath}"`;
		case "bash":
			return `bash "${normalizedPath}"`;
	}
}
