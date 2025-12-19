import { Box, Text, useInput } from "ink";
import { useState, useCallback, useMemo, useEffect } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";

export type Message = {
	content: string;
	type?: "user" | "system"; // user: 用户输入, system: 系统输出（默认）
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
	isUser: boolean; // 是否为用户输入
	isFirstLine: boolean; // 是否为该消息的第一行（用于显示前缀）
};

export default function MessageOutput({
	messages,
	height,
	focusMode = "input",
}: Props) {
	const width = useTerminalWidth();
	// scrollOffset: 从底部向上的偏移量（0 = 显示最新消息）
	const [scrollOffset, setScrollOffset] = useState(0);

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染单条消息（统一 Markdown 渲染）
	const renderContent = useCallback(
		(msg: Message): string => {
			return renderMarkdownSync(msg.content, width - 2);
		},
		[width],
	);

	// 去除 ANSI 转义码，计算可见字符宽度
	const stripAnsi = useCallback((str: string): string => {
		// eslint-disable-next-line no-control-regex
		return str.replace(/\x1b\[[0-9;]*m/g, "");
	}, []);

	// 计算字符串的显示宽度（考虑中文等宽字符）
	const getDisplayWidth = useCallback(
		(str: string): number => {
			const plain = stripAnsi(str);
			let width = 0;
			for (const char of plain) {
				// 中文、日文、韩文等宽字符占 2 个宽度
				const code = char.charCodeAt(0);
				if (code >= 0x4e00 && code <= 0x9fff) {
					width += 2;
				} else if (code >= 0x3000 && code <= 0x303f) {
					width += 2;
				} else if (code >= 0xff00 && code <= 0xffef) {
					width += 2;
				} else {
					width += 1;
				}
			}
			return width;
		},
		[stripAnsi],
	);

	// 将长行拆分为多个终端行
	const wrapLine = useCallback(
		(text: string, maxWidth: number): string[] => {
			if (maxWidth <= 0) return [text];

			const result: string[] = [];
			const plain = stripAnsi(text);

			// 如果纯文本宽度小于等于 maxWidth，不需要换行
			if (getDisplayWidth(plain) <= maxWidth) {
				return [text];
			}

			// 简单处理：按字符拆分（保留 ANSI 码会很复杂）
			// 这里用纯文本拆分，然后每行单独处理
			let currentLine = "";
			let currentWidth = 0;

			for (const char of plain) {
				const charWidth =
					char.charCodeAt(0) >= 0x4e00 && char.charCodeAt(0) <= 0x9fff
						? 2
						: char.charCodeAt(0) >= 0x3000 && char.charCodeAt(0) <= 0x303f
							? 2
							: char.charCodeAt(0) >= 0xff00 && char.charCodeAt(0) <= 0xffef
								? 2
								: 1;

				if (currentWidth + charWidth > maxWidth) {
					result.push(currentLine);
					currentLine = char;
					currentWidth = charWidth;
				} else {
					currentLine += char;
					currentWidth += charWidth;
				}
			}

			if (currentLine) {
				result.push(currentLine);
			}

			return result.length > 0 ? result : [""];
		},
		[stripAnsi, getDisplayWidth],
	);

	// 将所有消息预渲染为行数组（考虑换行）
	const renderedLines: RenderedLine[] = useMemo(() => {
		const lines: RenderedLine[] = [];
		const effectiveWidth = width - 2; // 留一点边距

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i]!;
			const isUser = msg.type === "user";
			const content = renderContent(msg);
			const msgLines = content.split("\n");

			let isFirstLineOfMsg = true;
			for (const line of msgLines) {
				// 检查这行是否需要换行
				const wrappedLines = wrapLine(line, effectiveWidth);
				for (const wrappedLine of wrappedLines) {
					lines.push({
						text: wrappedLine,
						msgIndex: i,
						isUser,
						isFirstLine: isFirstLineOfMsg,
					});
					isFirstLineOfMsg = false;
				}
			}
		}

		return lines;
	}, [messages, renderContent, width, wrapLine]);

	// 计算可见范围
	const totalLines = renderedLines.length;

	// 当有新消息时，自动滚动到底部
	useEffect(() => {
		setScrollOffset(0);
	}, [messages.length]);

	// 计算内容高度和可见行
	// 注意：指示器是否显示取决于滚动位置，这会影响可用高度
	// 使用迭代方式计算，确保边界条件正确

	// 计算给定 offset 下的显示状态
	const computeDisplayState = (offset: number) => {
		// 先用无指示器的高度计算
		const baseContentHeight = height;
		const baseStartLine = Math.max(0, totalLines - baseContentHeight - offset);
		const baseHasAbove = baseStartLine > 0;
		const baseHasBelow = offset > 0;

		// 根据是否需要指示器，调整内容高度
		const indicatorCount = (baseHasAbove ? 1 : 0) + (baseHasBelow ? 1 : 0);
		const contentHeight = Math.max(1, height - indicatorCount);
		const startLine = Math.max(0, totalLines - contentHeight - offset);
		const hasAbove = startLine > 0;
		const hasBelow = offset > 0;

		return { contentHeight, startLine, hasAbove, hasBelow };
	};

	// 计算真正的最大偏移
	// 目标：找到使 startLine = 0 的最小 offset，让用户能滚动到完全看到顶部
	const computeMaxOffset = () => {
		// 从 0 开始，找到第一个使 startLine = 0 的 offset
		for (let testOffset = 0; testOffset <= totalLines; testOffset++) {
			const state = computeDisplayState(testOffset);
			if (state.startLine === 0) {
				// 找到了能显示所有顶部内容的 offset
				return testOffset;
			}
		}
		// 如果循环结束都没找到（不应该发生），返回 totalLines
		return totalLines;
	};

	const maxOffset = computeMaxOffset();

	// 当高度或内容变化时，确保 scrollOffset 在有效范围内
	useEffect(() => {
		setScrollOffset((prev) => {
			if (prev > maxOffset) {
				return maxOffset;
			}
			return prev;
		});
	}, [maxOffset]);

	// 确保 scrollOffset 在有效范围内
	const safeOffset = Math.min(Math.max(0, scrollOffset), maxOffset);

	// 计算最终显示状态
	const displayState = computeDisplayState(safeOffset);
	const { contentHeight, startLine, hasAbove: hasMoreAbove, hasBelow: hasMoreBelow } = displayState;

	// 计算可见行
	const endLine = totalLines - safeOffset;
	const visibleLines = renderedLines.slice(startLine, endLine);

	// 指示器显示的行数
	const linesAbove = startLine;
	const linesBelow = safeOffset;

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
					return;
				}

				if (key.downArrow) {
					setScrollOffset((prev) => Math.max(0, prev - 1));
					return;
				}
			}

			// Page Up/Down 两种模式都可用
			if (key.pageUp) {
				setScrollOffset((prev) => Math.min(prev + contentHeight, maxOffset));
				return;
			}

			if (key.pageDown) {
				setScrollOffset((prev) => Math.max(0, prev - contentHeight));
				return;
			}
		},
		{ isActive: true },
	);

	// 构建内容行数组
	const contentRows: React.ReactNode[] = [];

	// 1. 顶部指示器
	if (hasMoreAbove) {
		contentRows.push(
			<Box key="indicator-above" justifyContent="center" height={1}>
				<Text dimColor>↑ 还有 {linesAbove} 行 (PageUp 翻页)</Text>
			</Box>,
		);
	}

	// 2. 消息内容（确保空行也占据空间）
	for (let i = 0; i < visibleLines.length; i++) {
		const line = visibleLines[i]!;
		// 用户消息第一行显示粉色 > 前缀
		const prefix =
			line.isUser && line.isFirstLine ? (
				<Text color="#ff69b4" bold>
					{">"}{" "}
				</Text>
			) : null;
		contentRows.push(
			<Box key={`line-${line.msgIndex}-${i}`} height={1}>
				{prefix}
				<Text>{line.text || " "}</Text>
			</Box>,
		);
	}

	// 3. 底部指示器
	if (hasMoreBelow) {
		contentRows.push(
			<Box key="indicator-below" justifyContent="center" height={1}>
				<Text dimColor>↓ 还有 {linesBelow} 行 (PageDown 翻页)</Text>
			</Box>,
		);
	}

	// 计算需要的空行数（在顶部填充）
	const emptyRowsNeeded = Math.max(0, height - contentRows.length);

	// 构建最终行数组：空行 + 内容
	const finalRows: React.ReactNode[] = [];

	// 1. 顶部空行填充
	for (let i = 0; i < emptyRowsNeeded; i++) {
		finalRows.push(
			<Box key={`empty-${i}`} height={1}>
				<Text> </Text>
			</Box>,
		);
	}

	// 2. 实际内容
	finalRows.push(...contentRows);

	return (
		<Box
			flexDirection="column"
			height={height}
			flexShrink={0}
			overflowY="hidden"
		>
			{finalRows}
		</Box>
	);
}
