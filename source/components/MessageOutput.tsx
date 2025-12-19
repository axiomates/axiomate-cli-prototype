import { Box, Text, useInput } from "ink";
import { useState, useCallback, useMemo, useEffect } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";
import { logger } from "../utils/logger.js";

export type Message = {
	content: string;
	markdown?: boolean; // 是否渲染为 Markdown，默认 true
};

/**
 * 焦点模式
 * - input: 输入模式，需要 Shift+↑/↓ 滚动
 * - output: 输出查看模式，直接用 ↑/↓ 滚动
 */
type FocusMode = "input" | "output";

type Props = {
	messages: Message[];
	height: number; // 可用高度（行数）
	focusMode?: FocusMode; // 焦点模式（默认 input）
};

// 延迟加载 marked 和 marked-terminal，避免测试环境问题
let markedInstance: {
	parse: (content: string) => string | Promise<string>;
} | null = null;

async function getMarkedInstance(width: number) {
	if (!markedInstance) {
		const { Marked } = await import("marked");
		const { markedTerminal } = await import("marked-terminal");
		const m = new Marked();
		m.use(markedTerminal({ width, reflowText: true }));
		markedInstance = m;
	}
	return markedInstance;
}

// 同步渲染 Markdown（使用缓存的实例）
function renderMarkdownSync(content: string, width: number): string {
	// 如果 marked 还没加载，先返回原始内容
	if (!markedInstance) {
		// 触发异步加载
		getMarkedInstance(width);
		return content;
	}
	const result = markedInstance.parse(content);
	if (typeof result === "string") {
		return result.trim();
	}
	return content;
}

/**
 * 渲染后的行信息
 */
type RenderedLine = {
	text: string;
	msgIndex: number;
};

export default function MessageOutput({
	messages,
	height,
	focusMode = "input",
}: Props) {
	const width = useTerminalWidth();
	// scrollOffset: 从底部向上的偏移量（0 = 显示最新消息）
	const [scrollOffset, setScrollOffset] = useState(0);
	// autoScroll: 是否在新消息到达时自动滚动到底部
	const [autoScroll, setAutoScroll] = useState(true);

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染单条消息
	const renderContent = useCallback(
		(msg: Message): string => {
			if (msg.markdown === false) {
				return msg.content;
			}
			return renderMarkdownSync(msg.content, width - 2);
		},
		[width],
	);

	// 将所有消息预渲染为行数组
	const renderedLines: RenderedLine[] = useMemo(() => {
		const lines: RenderedLine[] = [];
		for (let i = 0; i < messages.length; i++) {
			const content = renderContent(messages[i]!);
			const msgLines = content.split("\n");
			for (const line of msgLines) {
				lines.push({ text: line, msgIndex: i });
			}
		}
		return lines;
	}, [messages, renderContent]);

	// 计算可见范围
	const totalLines = renderedLines.length;

	// 当有新消息且 autoScroll 为 true 时，滚动到底部
	useEffect(() => {
		if (autoScroll) {
			setScrollOffset(0);
		}
	}, [messages.length, autoScroll]);

	// 计算内容高度和可见行
	// 注意：指示器是否显示取决于滚动位置，这会影响可用高度
	// 为了避免循环依赖，我们先用保守估计计算，再调整

	// 先假设最多需要 2 行给指示器（顶部 + 底部）
	const minContentHeight = Math.max(1, height - 2);

	// 用保守的高度计算最大偏移
	const maxOffsetConservative = Math.max(0, totalLines - minContentHeight);

	// 当高度或内容变化时，确保 scrollOffset 在有效范围内
	useEffect(() => {
		setScrollOffset((prev) => {
			if (prev > maxOffsetConservative) {
				return maxOffsetConservative;
			}
			return prev;
		});
	}, [maxOffsetConservative]);

	// 确保 scrollOffset 在有效范围内
	const safeOffset = Math.min(Math.max(0, scrollOffset), maxOffsetConservative);

	// 现在可以确定指示器状态
	// 使用保守高度计算起始行
	const startLineConservative = Math.max(0, totalLines - minContentHeight - safeOffset);
	const hasMoreAbove = startLineConservative > 0;
	const hasMoreBelow = safeOffset > 0;

	// 根据实际需要的指示器数量，计算真正的内容高度
	const indicatorCount = (hasMoreAbove ? 1 : 0) + (hasMoreBelow ? 1 : 0);
	const contentHeight = Math.max(1, height - indicatorCount);
	const maxOffset = Math.max(0, totalLines - contentHeight);

	// 重新计算可见行（用真正的内容高度）
	const startLine = Math.max(0, totalLines - contentHeight - safeOffset);
	const endLine = totalLines - safeOffset;
	const visibleLines = renderedLines.slice(startLine, endLine);

	// 指示器显示的行数
	const linesAbove = startLine;
	const linesBelow = safeOffset;

	// 调试日志
	logger.warn("MessageOutput render", {
		height,
		totalLines,
		contentHeight,
		indicatorCount,
		hasMoreAbove,
		hasMoreBelow,
		scrollOffset,
		safeOffset,
		visibleLinesCount: visibleLines.length,
	});

	// 是否处于输出模式（直接用 ↑/↓ 滚动）
	const isOutputMode = focusMode === "output";

	// 键盘控制滚动（仅在输出模式下用 ↑/↓，输入模式下不响应方向键）
	useInput(
		(_input, key) => {
			// 忽略带 Shift 的方向键（用于模式切换）
			if (key.shift && (key.upArrow || key.downArrow)) {
				return;
			}

			// 输出模式下用 ↑/↓ 滚动
			if (isOutputMode) {
				if (key.upArrow) {
					setScrollOffset((prev) => Math.min(prev + 1, maxOffset));
					setAutoScroll(false);
					return;
				}

				if (key.downArrow) {
					const newOffset = Math.max(0, scrollOffset - 1);
					setScrollOffset(newOffset);
					if (newOffset === 0) {
						setAutoScroll(true);
					}
					return;
				}
			}

			// Page Up/Down 两种模式都可用
			if (key.pageUp) {
				setScrollOffset((prev) => Math.min(prev + contentHeight, maxOffset));
				setAutoScroll(false);
				return;
			}

			if (key.pageDown) {
				const newOffset = Math.max(0, scrollOffset - contentHeight);
				setScrollOffset(newOffset);
				if (newOffset === 0) {
					setAutoScroll(true);
				}
				return;
			}
		},
		{ isActive: true },
	);

	// 构建要渲染的行数组
	const rows: React.ReactNode[] = [];

	// 1. 顶部指示器
	if (hasMoreAbove) {
		rows.push(
			<Box key="indicator-above" justifyContent="center">
				<Text dimColor>↑ 还有 {linesAbove} 行 (PageUp 翻页)</Text>
			</Box>,
		);
	}

	// 2. 消息内容
	for (let i = 0; i < visibleLines.length; i++) {
		const line = visibleLines[i]!;
		rows.push(
			<Box key={`line-${line.msgIndex}-${i}`}>
				<Text>{line.text}</Text>
			</Box>,
		);
	}

	// 3. 底部指示器
	if (hasMoreBelow) {
		rows.push(
			<Box key="indicator-below" justifyContent="center">
				<Text dimColor>↓ 还有 {linesBelow} 行 (PageDown 翻页)</Text>
			</Box>,
		);
	}

	return (
		<Box
			flexDirection="column"
			height={height}
			justifyContent="flex-end"
			overflowY="hidden"
		>
			{rows}
		</Box>
	);
}
