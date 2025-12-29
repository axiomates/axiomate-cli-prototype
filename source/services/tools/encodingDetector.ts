/**
 * File encoding detection module
 * Two-stage detection: BOM first, then statistical analysis
 */
import { readFileSync } from "node:fs";
import chardet from "chardet";

export type EncodingInfo = {
	encoding: string; // Detected encoding (e.g., "utf-8", "gbk", "shift-jis")
	confidence: number; // Confidence level 0-1
	hasBOM: boolean; // Whether file has BOM
	bomBytes: number; // BOM byte count (0, 2, 3, 4)
};

/**
 * Detect BOM from buffer
 */
export function detectBOM(
	buffer: Buffer,
): { encoding: string; bytes: number } | null {
	if (buffer.length < 2) return null;

	// Check 4-byte BOMs first
	if (buffer.length >= 4) {
		if (
			buffer[0] === 0x00 &&
			buffer[1] === 0x00 &&
			buffer[2] === 0xfe &&
			buffer[3] === 0xff
		) {
			return { encoding: "utf-32be", bytes: 4 };
		}
		if (
			buffer[0] === 0xff &&
			buffer[1] === 0xfe &&
			buffer[2] === 0x00 &&
			buffer[3] === 0x00
		) {
			return { encoding: "utf-32le", bytes: 4 };
		}
	}

	// Check 3-byte BOM (UTF-8)
	if (
		buffer.length >= 3 &&
		buffer[0] === 0xef &&
		buffer[1] === 0xbb &&
		buffer[2] === 0xbf
	) {
		return { encoding: "utf-8", bytes: 3 };
	}

	// Check 2-byte BOMs
	if (buffer[0] === 0xfe && buffer[1] === 0xff) {
		return { encoding: "utf-16be", bytes: 2 };
	}
	if (buffer[0] === 0xff && buffer[1] === 0xfe) {
		return { encoding: "utf-16le", bytes: 2 };
	}

	return null;
}

/**
 * Detect file encoding from buffer
 * @param buffer File content buffer
 * @param sampleSize Max bytes to analyze for detection (default: 64KB)
 */
export function detectEncoding(
	buffer: Buffer,
	sampleSize: number = 65536,
): EncodingInfo {
	const sample = buffer.length > sampleSize ? buffer.subarray(0, sampleSize) : buffer;

	// Stage 1: BOM detection (near 100% accurate)
	const bom = detectBOM(sample);
	if (bom) {
		return {
			encoding: bom.encoding,
			confidence: 1.0,
			hasBOM: true,
			bomBytes: bom.bytes,
		};
	}

	// Stage 2: Statistical detection via chardet
	const detected = chardet.detect(sample);

	return {
		encoding: detected || "utf-8",
		confidence: detected ? 0.85 : 0.5, // chardet doesn't provide confidence, estimate
		hasBOM: false,
		bomBytes: 0,
	};
}

/**
 * Detect file encoding from file path
 * @param filePath File path
 * @param sampleSize Max bytes to read for detection (default: 64KB)
 */
export function detectFileEncoding(
	filePath: string,
	sampleSize: number = 65536,
): EncodingInfo {
	const buffer = readFileSync(filePath);
	return detectEncoding(buffer, sampleSize);
}

/**
 * Normalize encoding name for iconv-lite
 */
export function normalizeEncodingName(encoding: string): string {
	const map: Record<string, string> = {
		"utf-8": "utf8",
		"utf-16le": "utf16le",
		"utf-16be": "utf16be",
		"utf-32le": "utf32le",
		"utf-32be": "utf32be",
		gb2312: "gbk",
		gb18030: "gb18030",
		"shift-jis": "shiftjis",
		shift_jis: "shiftjis",
		"windows-1252": "win1252",
		"iso-8859-1": "latin1",
	};
	return map[encoding.toLowerCase()] || encoding.toLowerCase();
}

/**
 * Get BOM buffer for encoding
 */
export function getBOMForEncoding(encoding: string): Buffer | null {
	switch (encoding.toLowerCase()) {
		case "utf8":
		case "utf-8":
			return Buffer.from([0xef, 0xbb, 0xbf]);
		case "utf16le":
		case "utf-16le":
			return Buffer.from([0xff, 0xfe]);
		case "utf16be":
		case "utf-16be":
			return Buffer.from([0xfe, 0xff]);
		case "utf32le":
		case "utf-32le":
			return Buffer.from([0xff, 0xfe, 0x00, 0x00]);
		case "utf32be":
		case "utf-32be":
			return Buffer.from([0x00, 0x00, 0xfe, 0xff]);
		default:
			return null;
	}
}
