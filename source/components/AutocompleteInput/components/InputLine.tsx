/**
 * 输入行渲染组件
 * 支持通用的带颜色富文本渲染
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { ColorRange } from "../../../models/richInput.js";
import { THEME_PINK } from "../../../constants/colors.js";

type InputLineProps = {
	/** 当前行文本 */
	line: string;
	/** 行索引 */
	lineIndex: number;
	/** 该行在原始文本中的起始偏移 */
	lineOffset: number;
	/** 是否是第一行 */
	isFirstLine: boolean;
	/** 是否是光标所在行 */
	isCursorLine: boolean;
	/** 光标在当前行的列位置 */
	cursorCol: number;
	/** 建议文本开始位置（-1 表示无建议） */
	suggestionStart: number;
	/** prompt 文本 */
	prompt: string;
	/** prompt 缩进（用于非首行） */
	promptIndent: string;
	/** 整个输入文本的颜色区间 */
	colorRanges?: ColorRange[];
};

/**
 * 根据颜色区间渲染文本
 * @param text 要渲染的文本
 * @param ranges 全局颜色区间
 * @param globalOffset 该文本在全局文本中的起始位置
 */
function renderWithColorRanges(
	text: string,
	ranges: ColorRange[],
	globalOffset: number,
): ReactNode {
	if (ranges.length === 0 || text.length === 0) {
		return <>{text}</>;
	}

	const textStart = globalOffset;
	const textEnd = globalOffset + text.length;
	const result: ReactNode[] = [];
	let localPos = 0; // 在 text 中的位置

	for (const range of ranges) {
		// 跳过不相关的区间
		if (range.end <= textStart) continue;
		if (range.start >= textEnd) break;

		// 计算该区间在当前文本中的重叠部分
		const overlapStart = Math.max(range.start, textStart);
		const overlapEnd = Math.min(range.end, textEnd);

		// 处理区间之前的无色部分
		const localOverlapStart = overlapStart - textStart;
		if (localOverlapStart > localPos) {
			const plainText = text.slice(localPos, localOverlapStart);
			if (plainText) {
				result.push(<Text key={`plain-${localPos}`}>{plainText}</Text>);
			}
			localPos = localOverlapStart;
		}

		// 处理有颜色的部分
		const localOverlapEnd = overlapEnd - textStart;
		if (localOverlapEnd > localPos) {
			const colorText = text.slice(localPos, localOverlapEnd);
			if (colorText) {
				result.push(
					<Text key={`color-${localPos}`} color={range.color}>
						{colorText}
					</Text>,
				);
			}
			localPos = localOverlapEnd;
		}
	}

	// 处理剩余的无色部分
	if (localPos < text.length) {
		const remaining = text.slice(localPos);
		if (remaining) {
			result.push(<Text key={`rest-${localPos}`}>{remaining}</Text>);
		}
	}

	return <>{result}</>;
}

export function InputLine({
	line,
	lineIndex,
	lineOffset,
	isFirstLine,
	isCursorLine,
	cursorCol,
	suggestionStart,
	prompt,
	promptIndent,
	colorRanges = [],
}: InputLineProps) {
	// 拆分行内容：用户输入部分 vs 建议部分
	let userPart = line;
	let suggestPart = "";

	if (suggestionStart >= 0 && suggestionStart < line.length) {
		userPart = line.slice(0, suggestionStart);
		suggestPart = line.slice(suggestionStart);
	}

	return (
		<Box key={`${lineIndex}-${line}`}>
			{/* 第一行显示粉色 prompt，后续行显示等宽空格缩进 */}
			{isFirstLine ? (
				<Text color={THEME_PINK}>{prompt}</Text>
			) : (
				<Text>{promptIndent}</Text>
			)}
			<Text>
				{isCursorLine ? (
					<CursorLineContent
						userPart={userPart}
						suggestPart={suggestPart}
						cursorCol={cursorCol}
						colorRanges={colorRanges}
						lineOffset={lineOffset}
					/>
				) : (
					<ColoredContent
						userPart={userPart}
						suggestPart={suggestPart}
						colorRanges={colorRanges}
						lineOffset={lineOffset}
					/>
				)}
			</Text>
		</Box>
	);
}

/**
 * 渲染带颜色的文本（无光标）
 */
function ColoredContent({
	userPart,
	suggestPart,
	colorRanges,
	lineOffset,
}: {
	userPart: string;
	suggestPart: string;
	colorRanges: ColorRange[];
	lineOffset: number;
}) {
	return (
		<>
			{renderWithColorRanges(userPart, colorRanges, lineOffset)}
			<Text color="gray">{suggestPart}</Text>
		</>
	);
}

/**
 * 光标所在行的内容渲染
 */
function CursorLineContent({
	userPart,
	suggestPart,
	cursorCol,
	colorRanges,
	lineOffset,
}: {
	userPart: string;
	suggestPart: string;
	cursorCol: number;
	colorRanges: ColorRange[];
	lineOffset: number;
}) {
	/**
	 * 获取全局位置的颜色
	 */
	const getColorAt = (globalPos: number): string | undefined => {
		for (const range of colorRanges) {
			if (globalPos >= range.start && globalPos < range.end) {
				return range.color;
			}
		}
		return undefined;
	};

	// 光标在用户输入部分
	if (cursorCol < userPart.length) {
		const beforeCursor = userPart.slice(0, cursorCol);
		const atCursor = userPart[cursorCol];
		const afterCursor = userPart.slice(cursorCol + 1);

		const cursorGlobalPos = lineOffset + cursorCol;
		const cursorColor = getColorAt(cursorGlobalPos);

		return (
			<>
				{renderWithColorRanges(beforeCursor, colorRanges, lineOffset)}
				<Text inverse>
					{cursorColor ? <Text color={cursorColor}>{atCursor}</Text> : atCursor}
				</Text>
				{renderWithColorRanges(
					afterCursor,
					colorRanges,
					lineOffset + cursorCol + 1,
				)}
				<Text color="gray">{suggestPart}</Text>
			</>
		);
	}

	// 光标在用户输入末尾，有 suggestion
	if (suggestPart.length > 0) {
		return (
			<>
				{renderWithColorRanges(userPart, colorRanges, lineOffset)}
				<Text inverse>
					<Text color="gray">{suggestPart[0]}</Text>
				</Text>
				<Text color="gray">{suggestPart.slice(1)}</Text>
			</>
		);
	}

	// 光标在末尾，没有 suggestion
	return (
		<>
			{renderWithColorRanges(userPart, colorRanges, lineOffset)}
			<Text inverse> </Text>
		</>
	);
}
