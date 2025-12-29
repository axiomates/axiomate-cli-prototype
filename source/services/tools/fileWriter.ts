/**
 * Universal UTF-8 file read/write utilities
 * Base layer for all file operations
 */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	appendFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type WriteMode = "overwrite" | "append";

export type FileWriteResult = {
	success: boolean;
	path: string;
	error?: string;
};

export type FileReadResult = {
	success: boolean;
	content: string | null;
	error?: string;
};

export type FileEditResult = {
	success: boolean;
	path: string;
	replaced: number; // Number of replacements made
	error?: string;
};

/**
 * Ensure directory exists for file path
 */
export function ensureDir(filePath: string): void {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Read file content as UTF-8
 */
export function readFileContent(filePath: string): FileReadResult {
	try {
		if (!existsSync(filePath)) {
			return { success: false, content: null, error: "File not found" };
		}
		const content = readFileSync(filePath, "utf8");
		return { success: true, content };
	} catch (err) {
		return {
			success: false,
			content: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Write content to file as UTF-8
 * @param mode - "overwrite" (default) or "append"
 */
export function writeFileContent(
	filePath: string,
	content: string,
	mode: WriteMode = "overwrite",
): FileWriteResult {
	try {
		ensureDir(filePath);

		if (mode === "append") {
			appendFileSync(filePath, content, { encoding: "utf8" });
		} else {
			writeFileSync(filePath, content, { encoding: "utf8" });
		}

		return { success: true, path: filePath };
	} catch (err) {
		return {
			success: false,
			path: filePath,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Edit file by replacing content
 * @param replaceAll - Replace all occurrences (default: false, only first)
 */
export function editFileContent(
	filePath: string,
	oldContent: string,
	newContent: string,
	replaceAll: boolean = false,
): FileEditResult {
	try {
		const readResult = readFileContent(filePath);
		if (!readResult.success || readResult.content === null) {
			return {
				success: false,
				path: filePath,
				replaced: 0,
				error: readResult.error || "File not found",
			};
		}

		let content = readResult.content;
		let replaced = 0;

		if (replaceAll) {
			const parts = content.split(oldContent);
			replaced = parts.length - 1;
			content = parts.join(newContent);
		} else {
			const index = content.indexOf(oldContent);
			if (index !== -1) {
				content =
					content.substring(0, index) +
					newContent +
					content.substring(index + oldContent.length);
				replaced = 1;
			}
		}

		if (replaced === 0) {
			return {
				success: false,
				path: filePath,
				replaced: 0,
				error: "Old content not found in file",
			};
		}

		writeFileSync(filePath, content, { encoding: "utf8" });
		return { success: true, path: filePath, replaced };
	} catch (err) {
		return {
			success: false,
			path: filePath,
			replaced: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
