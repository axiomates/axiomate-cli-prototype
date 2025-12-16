/**
 * 行处理工具函数
 * 处理手动换行和自动换行的计算逻辑
 */

export type ProcessedLines = {
	/** 处理后的显示行数组 */
	lines: string[];
	/** 每行在原始文本中的起始偏移量 */
	lineOffsets: number[];
	/** 光标所在行索引 */
	cursorLine: number;
	/** 光标所在列索引 */
	cursorCol: number;
	/** 每行宽度 */
	lineWidth: number;
};

export type InputEndInfo = {
	/** 输入文本结束的行索引 */
	endLine: number;
	/** 输入文本结束的列索引 */
	endCol: number;
};

/**
 * 将单行文本按宽度自动换行
 */
export function wrapLine(text: string, width: number): string[] {
	if (width <= 0 || text.length === 0) return [text];
	const lines: string[] = [];
	let remaining = text;
	while (remaining.length > 0) {
		lines.push(remaining.slice(0, width));
		remaining = remaining.slice(width);
	}
	return lines.length > 0 ? lines : [""];
}

/**
 * 处理手动换行 + 自动换行
 * 返回显示行数组和光标位置信息
 */
export function processLines(
	displayText: string,
	suggestionText: string,
	cursorPos: number,
	columns: number,
	promptLength: number,
): ProcessedLines {
	const lineWidth =
		columns - promptLength > 0 ? columns - promptLength : columns;
	const fullText = displayText + suggestionText;

	// 先按手动换行符分割
	const manualLines = fullText.split("\n");
	const allLines: string[] = [];
	const lineOffsets: number[] = [];

	// 记录每个手动行的起始位置（用于计算光标位置）
	let charCount = 0;
	let cursorLine = 0;
	let cursorCol = 0;
	let foundCursor = false;

	for (let i = 0; i < manualLines.length; i++) {
		const manualLine = manualLines[i]!;
		const wrappedLines = wrapLine(manualLine, lineWidth);

		for (let j = 0; j < wrappedLines.length; j++) {
			const line = wrappedLines[j]!;
			const lineStart = charCount;

			// 记录该行在原始文本中的起始偏移
			lineOffsets.push(lineStart);

			// 计算光标位置
			if (!foundCursor) {
				const lineEnd = charCount + line.length;

				if (cursorPos >= lineStart && cursorPos <= lineEnd) {
					cursorLine = allLines.length;
					cursorCol = cursorPos - lineStart;
					foundCursor = true;
				}
			}

			allLines.push(line);
			charCount += line.length;
		}

		// 手动换行符也占一个字符位置
		if (i < manualLines.length - 1) {
			charCount += 1; // \n
		}
	}

	// 如果没找到光标（光标在末尾），设置到最后
	if (!foundCursor) {
		cursorLine = allLines.length - 1;
		cursorCol = allLines[cursorLine]?.length || 0;
	}

	return { lines: allLines, lineOffsets, cursorLine, cursorCol, lineWidth }
}

/**
 * 计算输入文本在哪一行结束（用于显示建议）
 */
export function getInputEndInfo(
	displayText: string,
	lineWidth: number,
): InputEndInfo {
	const manualLines = displayText.split("\n");
	let totalLines = 0;
	let lastLineLength = 0;

	for (const manualLine of manualLines) {
		const wrappedCount = Math.max(
			1,
			Math.ceil(manualLine.length / lineWidth) || 1,
		);
		totalLines += wrappedCount;
		lastLineLength = manualLine.length % lineWidth;
		if (manualLine.length > 0 && lastLineLength === 0) {
			lastLineLength = lineWidth;
		}
	}

	return {
		endLine: totalLines - 1,
		endCol: lastLineLength,
	};
}
