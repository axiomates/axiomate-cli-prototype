/**
 * Token 估算器
 * 使用基于字符的启发式方法估算 token 数量（无外部依赖）
 */

import { t } from "../../i18n/index.js";

/**
 * 估算文本的 token 数量
 *
 * 启发式规则：
 * - CJK 字符（中日韩）：约 1.5 字符/token
 * - ASCII（包括代码符号）：约 4 字符/token
 * - 其他 Unicode：约 2 字符/token
 *
 * @param text 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
	let tokens = 0;

	for (const char of text) {
		const code = char.charCodeAt(0);

		// CJK 字符
		if (
			(code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
			(code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
			(code >= 0xac00 && code <= 0xd7af) // Hangul Syllables
		) {
			tokens += 0.67; // ~1.5 chars per token
		}
		// ASCII
		else if (code < 128) {
			tokens += 0.25; // ~4 chars per token
		}
		// 其他 Unicode
		else {
			tokens += 0.5; // ~2 chars per token
		}
	}

	return Math.ceil(tokens);
}

/**
 * 检查内容是否能放入上下文窗口
 *
 * @param content 内容
 * @param contextWindow 上下文窗口大小
 * @param reserveTokens 预留的 token 数量（用于响应）
 * @returns 是否能放入
 */
export function fitsInContext(
	content: string,
	contextWindow: number,
	reserveTokens: number = 4096,
): boolean {
	const tokens = estimateTokens(content);
	return tokens <= contextWindow - reserveTokens;
}

/**
 * 截断结果
 */
export type TruncateResult = {
	/** 截断后的内容 */
	content: string;
	/** 是否被截断 */
	wasTruncated: boolean;
	/** 原始行数 */
	originalLines: number;
	/** 保留行数 */
	keptLines: number;
};

/**
 * 按行截断文本以适应 token 限制
 *
 * @param content 原始内容
 * @param maxTokens 最大 token 数
 * @returns 截断结果
 */
export function truncateToFit(
	content: string,
	maxTokens: number,
): TruncateResult {
	const lines = content.split("\n");
	const originalLines = lines.length;

	// 如果已经在限制内，直接返回
	if (estimateTokens(content) <= maxTokens) {
		return {
			content,
			wasTruncated: false,
			originalLines,
			keptLines: originalLines,
		};
	}

	// 逐行累加直到超过限制
	let result = "";
	let keptLines = 0;
	let currentTokens = 0;

	for (const line of lines) {
		const lineWithNewline = line + "\n";
		const lineTokens = estimateTokens(lineWithNewline);

		if (currentTokens + lineTokens > maxTokens) {
			break;
		}

		result += lineWithNewline;
		currentTokens += lineTokens;
		keptLines++;
	}

	// 添加截断提示
	const notice = t("tools.contentTruncated", {
		total: originalLines,
		kept: keptLines,
	});
	result += notice;

	return {
		content: result,
		wasTruncated: true,
		originalLines,
		keptLines,
	};
}

/**
 * 按比例截断多个文件内容
 *
 * @param files 文件内容数组 { path, content }
 * @param maxTotalTokens 总共可用的最大 token 数
 * @returns 截断后的文件内容数组
 */
export function truncateFilesProportionally(
	files: Array<{ path: string; content: string }>,
	maxTotalTokens: number,
): Array<{ path: string; content: string; wasTruncated: boolean }> {
	// 计算每个文件的 token 数
	const fileTokens = files.map((f) => ({
		...f,
		tokens: estimateTokens(f.content),
	}));

	const totalTokens = fileTokens.reduce((sum, f) => sum + f.tokens, 0);

	// 如果总量在限制内，直接返回
	if (totalTokens <= maxTotalTokens) {
		return files.map((f) => ({ ...f, wasTruncated: false }));
	}

	// 按比例分配 token
	const ratio = maxTotalTokens / totalTokens;

	return fileTokens.map((f) => {
		const allocatedTokens = Math.floor(f.tokens * ratio);
		const result = truncateToFit(f.content, allocatedTokens);
		return {
			path: f.path,
			content: result.content,
			wasTruncated: result.wasTruncated,
		};
	});
}
