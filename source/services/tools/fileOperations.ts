/**
 * Universal file operations with auto encoding detection
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
// iconv-lite uses CommonJS export, need workaround for ESM + Bun bundling
import iconvModule from "iconv-lite";

// Type for iconv functions we use
type IconvLite = {
	decode(buffer: Buffer | Uint8Array, encoding: string): string;
	encode(content: string, encoding: string): Buffer;
};

// Handle both ESM default export and CommonJS module.exports
const iconv: IconvLite = (iconvModule as unknown as { default?: IconvLite }).default ?? (iconvModule as unknown as IconvLite);
import {
	detectEncoding,
	normalizeEncodingName,
	getBOMForEncoding,
	type EncodingInfo,
} from "./encodingDetector.js";

export type WriteMode = "overwrite" | "append";

export type FileReadResult = {
	success: boolean;
	content: string | null;
	encoding?: EncodingInfo; // Detected encoding info
	error?: string;
};

export type FileWriteResult = {
	success: boolean;
	path: string;
	encoding?: string; // Actual encoding used
	error?: string;
};

export type FileEditResult = {
	success: boolean;
	path: string;
	replaced: number; // Number of replacements made
	encoding?: string; // Preserved original encoding
	error?: string;
};

export type FileReadLinesResult = {
	success: boolean;
	lines: string[] | null;
	totalLines: number;
	startLine: number;
	endLine: number;
	encoding?: EncodingInfo;
	error?: string;
};

export type SearchMatch = {
	line: number; // 1-based line number
	column: number; // 1-based column
	content: string; // Full line content
	match: string; // Matched text
};

export type FileSearchResult = {
	success: boolean;
	matches: SearchMatch[];
	totalMatches: number;
	encoding?: EncodingInfo;
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
 * Read file with auto encoding detection
 * @param filePath File path
 * @param forceEncoding Force specific encoding (skip detection)
 */
export function readFileContent(
	filePath: string,
	forceEncoding?: string,
): FileReadResult {
	try {
		if (!existsSync(filePath)) {
			return { success: false, content: null, error: "File not found" };
		}

		const buffer = readFileSync(filePath);

		// Detect or use forced encoding
		const encodingInfo = forceEncoding
			? {
					encoding: forceEncoding,
					confidence: 1,
					hasBOM: false,
					bomBytes: 0,
				}
			: detectEncoding(buffer);

		// Decode content
		const normalizedEncoding = normalizeEncodingName(encodingInfo.encoding);
		let content: string;

		if (normalizedEncoding === "utf8" && !encodingInfo.hasBOM) {
			// Fast path for UTF-8 without BOM
			content = buffer.toString("utf8");
		} else {
			// Strip BOM if present, then decode
			const dataBuffer = encodingInfo.hasBOM
				? buffer.subarray(encodingInfo.bomBytes)
				: buffer;
			content = iconv.decode(dataBuffer, normalizedEncoding);
		}

		return { success: true, content, encoding: encodingInfo };
	} catch (err) {
		return {
			success: false,
			content: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Write file with encoding support
 * @param filePath File path
 * @param content Content to write
 * @param mode Write mode
 * @param encoding Target encoding (default: utf-8 for new files, preserve for existing)
 * @param addBOM Add BOM for UTF encodings (default: false)
 */
export function writeFileContent(
	filePath: string,
	content: string,
	mode: WriteMode = "overwrite",
	encoding?: string,
	addBOM: boolean = false,
): FileWriteResult {
	try {
		ensureDir(filePath);

		// Determine encoding: use provided, or detect from existing file, or default to utf-8
		let targetEncoding = encoding;
		if (!targetEncoding && existsSync(filePath)) {
			const buffer = readFileSync(filePath);
			const detected = detectEncoding(buffer);
			targetEncoding = detected.encoding;
			// Preserve BOM if original had it
			if (detected.hasBOM && !addBOM) {
				addBOM = true;
			}
		}
		targetEncoding = targetEncoding || "utf-8";

		const normalizedEncoding = normalizeEncodingName(targetEncoding);

		// Encode content
		let buffer: Buffer;
		if (normalizedEncoding === "utf8" && !addBOM) {
			buffer = Buffer.from(content, "utf8");
		} else {
			buffer = iconv.encode(content, normalizedEncoding);
			// Add BOM if requested
			if (addBOM) {
				const bom = getBOMForEncoding(normalizedEncoding);
				if (bom) {
					buffer = Buffer.concat([bom, buffer]);
				}
			}
		}

		if (mode === "append") {
			appendFileSync(filePath, buffer);
		} else {
			writeFileSync(filePath, buffer);
		}

		return { success: true, path: filePath, encoding: targetEncoding };
	} catch (err) {
		return {
			success: false,
			path: filePath,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Edit file preserving original encoding
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

		// Write back with original encoding (preserve BOM if it existed)
		const originalEncoding = readResult.encoding?.encoding || "utf-8";
		const addBOM = readResult.encoding?.hasBOM || false;

		writeFileContent(filePath, content, "overwrite", originalEncoding, addBOM);

		return { success: true, path: filePath, replaced, encoding: originalEncoding };
	} catch (err) {
		return {
			success: false,
			path: filePath,
			replaced: 0,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Read specific line range from file
 * @param filePath File path
 * @param startLine 1-based start line (inclusive)
 * @param endLine 1-based end line (inclusive), -1 for end of file
 */
export function readFileLines(
	filePath: string,
	startLine: number = 1,
	endLine: number = -1,
): FileReadLinesResult {
	const readResult = readFileContent(filePath);
	if (!readResult.success || readResult.content === null) {
		return {
			success: false,
			lines: null,
			totalLines: 0,
			startLine: 0,
			endLine: 0,
			error: readResult.error,
		};
	}

	const allLines = readResult.content.split(/\r?\n/);
	const totalLines = allLines.length;

	// Normalize line numbers
	const start = Math.max(1, startLine);
	const end = endLine === -1 ? totalLines : Math.min(endLine, totalLines);

	if (start > totalLines) {
		return {
			success: true,
			lines: [],
			totalLines,
			startLine: start,
			endLine: end,
			encoding: readResult.encoding,
		};
	}

	const lines = allLines.slice(start - 1, end);

	return {
		success: true,
		lines,
		totalLines,
		startLine: start,
		endLine: Math.min(end, totalLines),
		encoding: readResult.encoding,
	};
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Search for pattern in file
 * @param filePath File path
 * @param pattern Search pattern (string or regex)
 * @param maxMatches Maximum matches to return (default: 100)
 */
export function searchInFile(
	filePath: string,
	pattern: string | RegExp,
	maxMatches: number = 100,
): FileSearchResult {
	const readResult = readFileContent(filePath);
	if (!readResult.success || readResult.content === null) {
		return {
			success: false,
			matches: [],
			totalMatches: 0,
			error: readResult.error,
		};
	}

	const lines = readResult.content.split(/\r?\n/);
	const matches: SearchMatch[] = [];
	const regex =
		typeof pattern === "string"
			? new RegExp(escapeRegex(pattern), "g")
			: new RegExp(
					pattern.source,
					pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
				);

	for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
		const line = lines[i];
		let match: RegExpExecArray | null;

		// Reset lastIndex for each line
		regex.lastIndex = 0;

		while (
			(match = regex.exec(line)) !== null &&
			matches.length < maxMatches
		) {
			matches.push({
				line: i + 1,
				column: match.index + 1,
				content: line,
				match: match[0],
			});

			// Prevent infinite loop for zero-length matches
			if (match[0].length === 0) {
				regex.lastIndex++;
			}
		}
	}

	return {
		success: true,
		matches,
		totalMatches: matches.length,
		encoding: readResult.encoding,
	};
}
