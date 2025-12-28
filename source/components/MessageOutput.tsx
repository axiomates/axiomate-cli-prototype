import { Box, Text, useInput } from "ink";
import { useState, useCallback, useMemo, useEffect } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";
import { THEME_PINK, THEME_LIGHT_YELLOW } from "../constants/colors.js";
import {
	groupMessages,
	generateGroupHeaderParts,
	canCollapse,
	type GroupHeaderParts,
} from "../models/messageGroup.js";
import { useTranslation } from "../hooks/useTranslation.js";

export type Message = {
	content: string;
	reasoning?: string; // 思考内容（DeepSeek-R1, QwQ 等模型）
	reasoningCollapsed?: boolean; // 思考内容是否折叠
	type?: "user" | "system"; // user: 用户输入, system: 系统输出（默认）
	streaming?: boolean; // true = 正在流式生成, false/undefined = 已完成
	queued?: boolean; // true = 消息已入队等待处理（用户消息）
	queuedMessageId?: string; // 队列中的消息 ID（用于匹配）
	markdown?: boolean; // 是否渲染 Markdown（默认 true）
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
	// 消息组折叠相关
	collapsedGroups?: Set<string>; // 折叠的消息组 ID
	onToggleCollapse?: (groupId: string) => void; // 切换折叠状态
	onExpandAll?: () => void; // 展开所有
	onCollapseAll?: () => void; // 折叠所有
	// 思考内容折叠相关
	onToggleReasoningCollapse?: (msgIndex: number) => void; // 切换思考折叠状态
};

// Braille 点阵旋转动画帧
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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
		// 只移除尾部空白，保留开头缩进（如列表项的缩进）
		return result.replace(/\s+$/, "");
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
	// 消息组折叠相关
	isGroupHeader?: boolean; // 是否是消息组头部行（带三角形）
	isCollapsed?: boolean; // 头部行所属组是否处于折叠状态
	groupId?: string; // 所属消息组 ID（用于展开操作）
	headerParts?: GroupHeaderParts; // 头部行各部分（用于渲染）
	// 思考内容相关
	isReasoning?: boolean; // 是否为思考内容行
	isReasoningHeader?: boolean; // 是否为思考块头部行（可点击折叠）
	reasoningLineCount?: number; // 思考内容总行数（仅 header 有值）
};

export default function MessageOutput({
	messages,
	height,
	focusMode = "input",
	collapsedGroups,
	onToggleCollapse,
	onExpandAll,
	onCollapseAll,
	onToggleReasoningCollapse,
}: Props) {
	const { t } = useTranslation();
	const width = useTerminalWidth();
	// scrollOffset: 从底部向上的偏移量（0 = 显示最新消息）
	const [scrollOffset, setScrollOffset] = useState(0);

	// 浏览模式下的光标位置（全局索引，相对于 renderedLines）
	const [cursorIndex, setCursorIndex] = useState(-1);

	// 记录刚刚切换（展开/折叠）的组 ID，用于在操作后跳转光标到该组头部
	const [justToggledGroupId, setJustToggledGroupId] = useState<string | null>(
		null,
	);

	// 记录展开全部前的光标信息，用于保持光标位置和视口位置
	const [expandAllCursorInfo, setExpandAllCursorInfo] = useState<{
		groupId: string;
		msgIndex: number; // 消息索引
		lineIndexInMsg: number; // 在该消息内的行偏移
		screenOffset: number; // 光标在屏幕上的位置（从顶部数第几行）
		isGroupHeader: boolean; // 是否是组头部行
	} | null>(null);

	// 动画 spinner 状态
	const [spinnerIndex, setSpinnerIndex] = useState(0);
	const hasStreamingMessage = messages.some((m) => m.streaming);
	const hasQueuedMessage = messages.some((m) => m.queued);

	// Spinner 动画效果（流式或等待中都需要动画）
	useEffect(() => {
		if (!hasStreamingMessage && !hasQueuedMessage) return;

		const timer = setInterval(() => {
			setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
		}, 80); // 80ms 每帧，约 12.5 FPS

		return () => clearInterval(timer);
	}, [hasStreamingMessage, hasQueuedMessage]);

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染单条消息（统一 Markdown 渲染）
	const renderContent = useCallback(
		(msg: Message, isLastMessage: boolean): string => {
			// 如果明确设置不渲染 Markdown，直接返回内容
			let content =
				msg.markdown === false
					? msg.content
					: renderMarkdownSync(msg.content, width - 2);

			// 如果是最后一条消息且正在流式生成，添加动画 spinner（带明黄色）
			if (msg.streaming && isLastMessage) {
				// 确保 spinner 在内容后面（同一行或新行）
				const spinnerChar = SPINNER_FRAMES[spinnerIndex] || SPINNER_FRAMES[0];
				// 使用 ANSI 转义码添加明黄色
				const coloredSpinner = `\x1b[93m${spinnerChar}\x1b[0m`; // 93 = bright yellow
				if (content.endsWith("\n")) {
					content = content.slice(0, -1) + " " + coloredSpinner;
				} else {
					content += " " + coloredSpinner;
				}
			}

			// 如果消息正在队列中等待，添加等待 spinner（带灰色）
			if (msg.queued) {
				const spinnerChar = SPINNER_FRAMES[spinnerIndex] || SPINNER_FRAMES[0];
				// 使用 ANSI 转义码添加灰色 (90 = bright black/gray)
				const coloredSpinner = `\x1b[90m${spinnerChar} ${t("common.waiting")}\x1b[0m`;
				if (content.endsWith("\n")) {
					content = content.slice(0, -1) + " " + coloredSpinner;
				} else {
					content += " " + coloredSpinner;
				}
			}

			return content;
		},
		[width, spinnerIndex, t],
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

	// 计算消息组（缓存）
	const messageGroups = useMemo(() => groupMessages(messages), [messages]);

	// 将所有消息预渲染为行数组（考虑换行和折叠）
	const renderedLines: RenderedLine[] = useMemo(() => {
		const lines: RenderedLine[] = [];
		const effectiveWidth = width - 2; // 留一点边距

		for (const group of messageGroups) {
			const isCollapsible = canCollapse(group);
			const isCollapsed = collapsedGroups?.has(group.id) && isCollapsible;

			// 可折叠的组：先添加头部行（带三角形）
			if (isCollapsible) {
				const parts = generateGroupHeaderParts(
					group,
					effectiveWidth,
					!!isCollapsed,
				);
				lines.push({
					text: "", // 实际渲染由 headerParts 控制
					msgIndex: group.startIndex,
					isUser: false,
					isFirstLine: true,
					isGroupHeader: true,
					isCollapsed,
					groupId: group.id,
					headerParts: parts,
				});
			}

			// 折叠状态：只显示头部行，不显示内容
			if (isCollapsed) {
				continue;
			}

			// 展开状态或不可折叠：正常渲染所有消息
			for (let i = group.startIndex; i < group.endIndex; i++) {
				const msg = messages[i]!;
				const isUser = msg.type === "user";
				const isLastMessage = i === messages.length - 1;

				// 1. 渲染思考内容（如果有）
				if (msg.reasoning && msg.reasoning.length > 0) {
					// 计算思考内容的总行数（用于折叠显示）
					const reasoningLines = msg.reasoning.split("\n");
					let totalReasoningLines = 0;
					for (const line of reasoningLines) {
						const wrappedLines = wrapLine(line, effectiveWidth - 2); // 缩进 2 空格
						totalReasoningLines += wrappedLines.length;
					}

					// 思考块头部行
					const isReasoningCollapsed = msg.reasoningCollapsed ?? false;
					const headerSymbol = isReasoningCollapsed ? "▸" : "▼";
					const headerText = isReasoningCollapsed
						? `${headerSymbol} ${t("message.thinkingProcess")} (${totalReasoningLines} ${t("message.lines")})`
						: `${headerSymbol} ${t("message.thinkingProcess")}`;

					lines.push({
						text: headerText,
						msgIndex: i,
						isUser: false,
						isFirstLine: true,
						groupId: group.id,
						isReasoning: true,
						isReasoningHeader: true,
						reasoningLineCount: totalReasoningLines,
						isCollapsed: isReasoningCollapsed,
					});

					// 如果思考内容未折叠，渲染思考内容行
					if (!isReasoningCollapsed) {
						for (const line of reasoningLines) {
							const wrappedLines = wrapLine(line, effectiveWidth - 2);
							for (const wrappedLine of wrappedLines) {
								lines.push({
									text: "  " + wrappedLine, // 缩进 2 空格
									msgIndex: i,
									isUser: false,
									isFirstLine: false,
									groupId: group.id,
									isReasoning: true,
								});
							}
						}
					}

					// 思考中的 spinner（最后一条消息且正在流式生成，且还没有正式内容）
					if (msg.streaming && isLastMessage && !msg.content) {
						const spinnerChar =
							SPINNER_FRAMES[spinnerIndex] || SPINNER_FRAMES[0];
						lines.push({
							text: `  \x1b[93m${spinnerChar}\x1b[0m`,
							msgIndex: i,
							isUser: false,
							isFirstLine: false,
							groupId: group.id,
							isReasoning: true,
						});
					}
				}

				// 2. 渲染正式内容
				if (msg.content) {
					const content = renderContent(msg, isLastMessage);
					const msgLines = content.split("\n");

					let isFirstLineOfMsg = !msg.reasoning; // 如果有思考内容，正式内容不是第一行
					for (const line of msgLines) {
						// 检查这行是否需要换行
						const wrappedLines = wrapLine(line, effectiveWidth);
						for (const wrappedLine of wrappedLines) {
							lines.push({
								text: wrappedLine,
								msgIndex: i,
								isUser,
								isFirstLine: isFirstLineOfMsg,
								groupId: group.id,
							});
							isFirstLineOfMsg = false;
						}
					}
				} else if (!msg.reasoning) {
					// 没有思考内容也没有正式内容（空消息）
					const content = renderContent(msg, isLastMessage);
					const msgLines = content.split("\n");

					let isFirstLineOfMsg = true;
					for (const line of msgLines) {
						const wrappedLines = wrapLine(line, effectiveWidth);
						for (const wrappedLine of wrappedLines) {
							lines.push({
								text: wrappedLine,
								msgIndex: i,
								isUser,
								isFirstLine: isFirstLineOfMsg,
								groupId: group.id,
							});
							isFirstLineOfMsg = false;
						}
					}
				}
			}
		}

		return lines;
	}, [
		messages,
		messageGroups,
		collapsedGroups,
		renderContent,
		width,
		wrapLine,
		t,
		spinnerIndex,
	]);

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
	const computeDisplayState = useCallback(
		(offset: number) => {
			// 先用无指示器的高度计算
			const baseContentHeight = height;
			const baseStartLine = Math.max(0, totalLines - baseContentHeight - offset);
			const baseHasAbove = baseStartLine > 0;
			const baseHasBelow = offset > 0;

			// 根据是否需要指示器，调整内容高度
			const indicatorCount = (baseHasAbove ? 1 : 0) + (baseHasBelow ? 1 : 0);
			const adjustedContentHeight = Math.max(1, height - indicatorCount);
			const startLine = Math.max(
				0,
				totalLines - adjustedContentHeight - offset,
			);
			const hasAbove = startLine > 0;
			const hasBelow = offset > 0;

			return {
				contentHeight: adjustedContentHeight,
				startLine,
				hasAbove,
				hasBelow,
			};
		},
		[height, totalLines],
	);

	// 计算真正的最大偏移
	// 目标：找到使 startLine = 0 的最小 offset，让用户能滚动到完全看到顶部
	const maxOffset = useMemo(() => {
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
	}, [totalLines, computeDisplayState]);

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
	const {
		contentHeight,
		startLine,
		hasAbove: hasMoreAbove,
		hasBelow: hasMoreBelow,
	} = displayState;

	// 计算可见行
	const endLine = totalLines - safeOffset;
	const visibleLines = renderedLines.slice(startLine, endLine);

	// 指示器显示的行数
	const linesAbove = startLine;
	const linesBelow = safeOffset;

	// 是否处于输出模式（直接用 ↑/↓ 滚动）
	const isOutputMode = focusMode === "output";

	// 找出所有头部行的全局索引（相对于 renderedLines）
	const allHeaderIndices = useMemo(() => {
		return renderedLines
			.map((line, index) => (line.isGroupHeader ? index : -1))
			.filter((index) => index !== -1);
	}, [renderedLines]);

	// 切换到浏览模式时，光标定位到最后一行
	// 注意：只在进入浏览模式时设置，不在 totalLines 变化时重设（避免覆盖折叠/展开后的光标位置）
	useEffect(() => {
		if (isOutputMode && totalLines > 0 && cursorIndex === -1) {
			// 首次进入浏览模式，定位到最后一行
			setCursorIndex(totalLines - 1);
		} else if (!isOutputMode) {
			// 退出浏览模式，重置光标
			setCursorIndex(-1);
		}
	}, [isOutputMode, totalLines, cursorIndex]);

	// 展开/折叠组后，跳转光标到该组的头部行
	useEffect(() => {
		if (!justToggledGroupId || !isOutputMode) return;

		// 找到该组的头部行索引
		const headerIndex = renderedLines.findIndex(
			(line) => line.isGroupHeader && line.groupId === justToggledGroupId,
		);

		if (headerIndex >= 0) {
			setCursorIndex(headerIndex);
			// 需要延迟调用 ensureCursorVisible，因为此时 scrollOffset 等状态可能还没更新
			// 使用 setTimeout 确保在下一个事件循环中执行
			setTimeout(() => {
				// 重新计算可见范围并滚动
				const targetOffset = Math.max(
					0,
					totalLines - headerIndex - contentHeight,
				);
				setScrollOffset(Math.min(targetOffset, maxOffset));
			}, 0);
		}

		// 清除标记
		setJustToggledGroupId(null);
	}, [
		justToggledGroupId,
		isOutputMode,
		renderedLines,
		totalLines,
		contentHeight,
		maxOffset,
	]);

	// 展开全部后，恢复光标位置和视口位置
	useEffect(() => {
		if (!expandAllCursorInfo || !isOutputMode) return;

		let targetIndex = -1;

		if (expandAllCursorInfo.isGroupHeader) {
			// 原来在组头部行,直接找组头部
			targetIndex = renderedLines.findIndex(
				(line) =>
					line.isGroupHeader &&
					line.groupId === expandAllCursorInfo.groupId
			);
		} else {
			// 原来在消息内容行,找到消息第一行再偏移
			const firstLineIndex = renderedLines.findIndex(
				(line) =>
					line.groupId === expandAllCursorInfo.groupId &&
					line.msgIndex === expandAllCursorInfo.msgIndex &&
					line.isFirstLine &&
					!line.isGroupHeader  // 排除组头部行
			);

			if (firstLineIndex >= 0) {
				// 从第一行向后偏移
				let offset = 0;
				for (let i = firstLineIndex; i < renderedLines.length; i++) {
					const line = renderedLines[i];
					if (line?.msgIndex !== expandAllCursorInfo.msgIndex || line.isGroupHeader) {
						// 超出消息范围或遇到组头部,停止
						break;
					}
					if (offset === expandAllCursorInfo.lineIndexInMsg) {
						targetIndex = i;
						break;
					}
					offset++;
				}
			}
		}

		if (targetIndex >= 0) {
			// 设置光标到目标行
			setCursorIndex(targetIndex);

			// 计算滚动位置,保持屏幕位置不变
			// 使用 setTimeout 确保在状态更新后执行
			setTimeout(() => {
				// 计算期望的起始行位置
				// 目标:让光标行显示在屏幕上的 screenOffset 位置
				let targetStartLine = targetIndex - expandAllCursorInfo.screenOffset;

				// 如果起始行 + 屏幕高度超出总行数,需要贴底显示
				if (targetStartLine + contentHeight > totalLines) {
					targetStartLine = Math.max(0, totalLines - contentHeight);
				} else {
					targetStartLine = Math.max(0, targetStartLine);
				}

				// 初步计算目标 offset
				// 公式: startLine = totalLines - contentHeight - offset
				// 所以: offset = totalLines - contentHeight - startLine
				let targetOffset = totalLines - contentHeight - targetStartLine;

				// 确保 offset 在有效范围内
				targetOffset = Math.max(0, Math.min(targetOffset, maxOffset));

				// 迭代调整,确保 startLine 尽可能接近 targetStartLine
				// 由于指示器会影响 contentHeight,需要多次迭代
				for (let iter = 0; iter < 10; iter++) {
					const state = computeDisplayState(targetOffset);

					// 如果 startLine 已经匹配,停止迭代
					if (state.startLine === targetStartLine) {
						break;
					}

					// 调整 offset
					if (state.startLine < targetStartLine) {
						// startLine 太小,需要增加 offset (显示更靠后的内容)
						const newOffset = targetOffset + 1;
						if (newOffset > maxOffset) break; // 已到边界
						targetOffset = newOffset;
					} else {
						// state.startLine > targetStartLine
						// startLine 太大,需要减少 offset (显示更靠前的内容)
						const newOffset = targetOffset - 1;
						if (newOffset < 0) break; // 已到边界
						targetOffset = newOffset;
					}
				}

				setScrollOffset(targetOffset);
			}, 0);
		}

		// 清除标记
		setExpandAllCursorInfo(null);
	}, [
		expandAllCursorInfo,
		isOutputMode,
		renderedLines,
		totalLines,
		contentHeight,
		maxOffset,
		computeDisplayState,
	]);

	// 确保光标移动后可见（自动滚动）
	const ensureCursorVisible = useCallback(
		(newCursorIndex: number) => {
			// 计算当前可见范围
			const currentEndLine = totalLines - safeOffset;
			const currentStartLine = startLine;

			if (newCursorIndex < currentStartLine) {
				// 光标在屏幕上方，需要向上滚动
				// 目标：让 newCursorIndex 成为新的 startLine
				// 需要通过迭代找到正确的 offset（因为指示器会影响 contentHeight）
				let targetOffset = totalLines - newCursorIndex - contentHeight;
				// 迭代调整，确保 startLine 正好等于 newCursorIndex
				for (let iter = 0; iter < 3; iter++) {
					const state = computeDisplayState(targetOffset);
					if (state.startLine < newCursorIndex) {
						// startLine 太小，需要减少 offset
						targetOffset = Math.max(0, targetOffset - 1);
					} else if (state.startLine > newCursorIndex) {
						// startLine 太大，需要增加 offset
						targetOffset = Math.min(maxOffset, targetOffset + 1);
					} else {
						break;
					}
				}
				setScrollOffset(Math.min(Math.max(0, targetOffset), maxOffset));
			} else if (newCursorIndex >= currentEndLine) {
				// 光标在屏幕下方，需要向下滚动
				const newOffset = totalLines - newCursorIndex - 1;
				setScrollOffset(Math.max(0, newOffset));
			}
		},
		[totalLines, safeOffset, startLine, contentHeight, maxOffset, computeDisplayState],
	);

	// 键盘控制
	useInput(
		(input, key) => {
			// 忽略带 Shift 的方向键（用于模式切换）
			if (key.shift && (key.upArrow || key.downArrow)) {
				return;
			}

			// 输出模式下的按键处理
			if (isOutputMode && totalLines > 0) {
				// ↑: 光标上移一行
				if (key.upArrow) {
					const newIndex = Math.max(0, cursorIndex - 1);
					setCursorIndex(newIndex);
					ensureCursorVisible(newIndex);
					return;
				}

				// ↓: 光标下移一行
				if (key.downArrow) {
					const newIndex = Math.min(totalLines - 1, cursorIndex + 1);
					setCursorIndex(newIndex);
					ensureCursorVisible(newIndex);
					return;
				}

				// w: 跳转到上一个头部行
				if (input === "w" && allHeaderIndices.length > 0) {
					// 找到当前光标位置之前的最近头部行
					let targetIndex = -1;
					for (let i = allHeaderIndices.length - 1; i >= 0; i--) {
						if (allHeaderIndices[i]! < cursorIndex) {
							targetIndex = allHeaderIndices[i]!;
							break;
						}
					}
					if (targetIndex >= 0) {
						setCursorIndex(targetIndex);
						ensureCursorVisible(targetIndex);
					}
					return;
				}

				// s: 跳转到下一个头部行
				if (input === "s" && allHeaderIndices.length > 0) {
					// 找到当前光标位置之后的最近头部行
					let targetIndex = -1;
					for (let i = 0; i < allHeaderIndices.length; i++) {
						if (allHeaderIndices[i]! > cursorIndex) {
							targetIndex = allHeaderIndices[i]!;
							break;
						}
					}
					if (targetIndex >= 0) {
						setCursorIndex(targetIndex);
						ensureCursorVisible(targetIndex);
					}
					return;
				}

				// Enter: 展开/折叠光标所在的消息组或思考块
				if (key.return && cursorIndex >= 0) {
					const cursorLine = renderedLines[cursorIndex];
					// 思考块头部：切换思考内容的折叠状态
					if (
						cursorLine?.isReasoningHeader &&
						onToggleReasoningCollapse
					) {
						onToggleReasoningCollapse(cursorLine.msgIndex);
						return;
					}
					// 消息组头部：切换消息组的折叠状态
					if (
						cursorLine?.isGroupHeader &&
						cursorLine.groupId &&
						onToggleCollapse
					) {
						// 记录 groupId，展开/折叠后跳转到组的头部行
						setJustToggledGroupId(cursorLine.groupId);
						onToggleCollapse(cursorLine.groupId);
					}
					return;
				}

				// e: 展开所有
				if (input === "e" && onExpandAll) {
					// 保存当前光标信息，用于展开后恢复位置
					if (cursorIndex >= 0 && cursorIndex < renderedLines.length) {
						const cursorLine = renderedLines[cursorIndex];
						if (cursorLine?.groupId) {
							let lineIndexInMsg = 0;

							// 如果不是组头部行,需要计算在消息内的偏移
							if (!cursorLine.isGroupHeader) {
								// 找到该消息的第一行索引
								let firstLineIdx = cursorIndex;
								for (let i = cursorIndex; i >= 0; i--) {
									const line = renderedLines[i];
									if (line?.msgIndex !== cursorLine.msgIndex || line?.isGroupHeader) {
										break;
									}
									if (line.isFirstLine) {
										firstLineIdx = i;
										break;
									}
								}
								lineIndexInMsg = cursorIndex - firstLineIdx;
							}

							const screenOffset = cursorIndex - startLine;

							setExpandAllCursorInfo({
								groupId: cursorLine.groupId,
								msgIndex: cursorLine.msgIndex,
								lineIndexInMsg,
								screenOffset,
								isGroupHeader: !!cursorLine.isGroupHeader,
							});
						}
					}
					onExpandAll();
					return;
				}

				// c: 折叠所有
				if (input === "c" && onCollapseAll) {
					onCollapseAll();
					// 折叠后，跳转到最后一个消息组的头部行
					if (messageGroups.length > 0) {
						const lastGroup = messageGroups[messageGroups.length - 1];
						if (lastGroup) {
							setJustToggledGroupId(lastGroup.id);
						}
					}
					return;
				}

				// Page Up: 光标上移一页
				if (key.pageUp) {
					const newIndex = Math.max(0, cursorIndex - contentHeight);
					setCursorIndex(newIndex);
					ensureCursorVisible(newIndex);
					return;
				}

				// Page Down: 光标下移一页
				if (key.pageDown) {
					const newIndex = Math.min(
						totalLines - 1,
						cursorIndex + contentHeight,
					);
					setCursorIndex(newIndex);
					ensureCursorVisible(newIndex);
					return;
				}
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
				<Text dimColor>{t("messageOutput.scrollUpHint", { count: linesAbove })}</Text>
			</Box>,
		);
	}

	/**
	 * 从 ANSI 前景色转义码生成对应的背景色转义码
	 * 前景色 38 -> 背景色 48
	 * 前景色 30-37 -> 背景色 40-47
	 * 前景色 90-97 -> 背景色 100-107
	 */
	const convertFgToBgAnsi = (ansiCodes: string): string | null => {
		// 真彩色：ESC[38;2;R;G;Bm -> ESC[48;2;R;G;Bm
		const trueColorMatch = ansiCodes.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
		if (trueColorMatch) {
			return `\x1b[48;2;${trueColorMatch[1]};${trueColorMatch[2]};${trueColorMatch[3]}m`;
		}

		// 256色：ESC[38;5;Nm -> ESC[48;5;Nm
		const color256Match = ansiCodes.match(/\x1b\[38;5;(\d+)m/);
		if (color256Match) {
			return `\x1b[48;5;${color256Match[1]}m`;
		}

		// 基本色：ESC[3Xm -> ESC[4Xm, ESC[9Xm -> ESC[10Xm
		const basicColorMatch = ansiCodes.match(/\x1b\[(3[0-7])m/);
		if (basicColorMatch) {
			const fgCode = parseInt(basicColorMatch[1]!, 10);
			const bgCode = fgCode + 10; // 30-37 -> 40-47
			return `\x1b[${bgCode}m`;
		}

		// 亮色：ESC[9Xm -> ESC[10Xm
		const brightColorMatch = ansiCodes.match(/\x1b\[(9[0-7])m/);
		if (brightColorMatch) {
			const fgCode = parseInt(brightColorMatch[1]!, 10);
			const bgCode = fgCode + 10; // 90-97 -> 100-107
			return `\x1b[${bgCode}m`;
		}

		return null;
	};

	/**
	 * 渲染带光标背景的行
	 * 通过在文本开头插入 ANSI 背景色代码实现
	 *
	 * 注意：text 可能包含 ANSI 转义码（来自 Markdown 渲染），
	 * 我们需要在第一个可见字符前插入背景色，并在其后重置背景
	 * 背景色使用与前景色相同的 ANSI 码（只是转换为背景版本）
	 */
	const renderLineWithCursorBg = (
		text: string,
		fgColor?: string,
	): React.ReactNode => {
		// 如果提供了 fgColor，说明是简单文本（如 ">" 前缀），直接处理
		if (fgColor) {
			const chars = [...text];
			const firstChar = chars[0] || " ";
			const rest = chars.slice(1).join("");
			return (
				<>
					<Text backgroundColor={fgColor} color={fgColor} bold>
						{firstChar}
					</Text>
					{rest && (
						<Text color={fgColor} bold>
							{rest}
						</Text>
					)}
				</>
			);
		}

		// 对于 Markdown 渲染后的文本，使用 ANSI 转义码方式处理
		// eslint-disable-next-line no-control-regex
		const ansiRegex = /\x1b\[[0-9;]*m/g;

		// 找到第一个可见字符的位置，同时收集开头的 ANSI 码
		let firstVisibleCharIndex = 0;
		let leadingAnsiCodes = "";
		let match;
		let lastIndex = 0;
		ansiRegex.lastIndex = 0;

		while ((match = ansiRegex.exec(text)) !== null) {
			if (match.index === lastIndex) {
				leadingAnsiCodes += match[0];
				lastIndex = ansiRegex.lastIndex;
				firstVisibleCharIndex = lastIndex;
			} else {
				break;
			}
		}

		// 获取第一个可见字符
		const textAfterAnsi = text.slice(firstVisibleCharIndex);
		const chars = [...textAfterAnsi];
		const firstVisibleChar = chars[0] || " ";
		const firstCharLength = firstVisibleChar.length;

		// 从开头的 ANSI 码转换为对应的背景色码
		const bgAnsi = convertFgToBgAnsi(leadingAnsiCodes);
		// 默认使用白色背景（真彩色）
		const bgStart = bgAnsi || "\x1b[48;2;224;224;224m";
		const bgReset = "\x1b[49m";

		// 构建带背景色的文本
		const leadingAnsi = text.slice(0, firstVisibleCharIndex);
		const restStartIndex = firstVisibleCharIndex + firstCharLength;
		const restText = text.slice(restStartIndex);

		// 组装最终文本
		const finalText =
			leadingAnsi + bgStart + firstVisibleChar + bgReset + restText;

		return <Text>{finalText}</Text>;
	};

	// 2. 消息内容（确保空行也占据空间）
	for (let i = 0; i < visibleLines.length; i++) {
		const line = visibleLines[i]!;
		// 计算该行在 renderedLines 中的全局索引
		const globalIndex = startLine + i;
		// 浏览模式下光标所在行
		const isCursorLine = isOutputMode && globalIndex === cursorIndex;

		// 消息组头部行的特殊渲染（带三角形）
		if (line.isGroupHeader && line.headerParts) {
			const parts = line.headerParts;
			if (isCursorLine) {
				// 光标行：三角形显示背景色
				contentRows.push(
					<Box key={`header-${line.groupId}`} height={1}>
						{renderLineWithCursorBg(parts.arrow, "gray")}
						<Text dimColor> </Text>
						<Text color={THEME_PINK}>{parts.userPreview}</Text>
						<Text dimColor> {parts.separator} </Text>
						<Text>{parts.responsePreview}</Text>
						<Text dimColor> {parts.lineCount}</Text>
					</Box>,
				);
			} else {
				contentRows.push(
					<Box key={`header-${line.groupId}`} height={1}>
						<Text dimColor>{parts.arrow}</Text>
						<Text dimColor> </Text>
						<Text color={THEME_PINK}>{parts.userPreview}</Text>
						<Text dimColor> {parts.separator} </Text>
						<Text>{parts.responsePreview}</Text>
						<Text dimColor> {parts.lineCount}</Text>
					</Box>,
				);
			}
			continue;
		}

		// 思考内容行的特殊渲染（暗色显示）
		if (line.isReasoning) {
			if (line.isReasoningHeader) {
				// 思考块头部行（可点击折叠）
				if (isCursorLine) {
					contentRows.push(
						<Box key={`reasoning-header-${line.msgIndex}-${i}`} height={1}>
							{renderLineWithCursorBg(line.text, "gray")}
						</Box>,
					);
				} else {
					contentRows.push(
						<Box key={`reasoning-header-${line.msgIndex}-${i}`} height={1}>
							<Text dimColor>{line.text}</Text>
						</Box>,
					);
				}
			} else {
				// 思考内容行（暗色）
				if (isCursorLine) {
					contentRows.push(
						<Box key={`reasoning-${line.msgIndex}-${i}`} height={1}>
							{renderLineWithCursorBg(line.text, "gray")}
						</Box>,
					);
				} else {
					contentRows.push(
						<Box key={`reasoning-${line.msgIndex}-${i}`} height={1}>
							<Text dimColor>{line.text || " "}</Text>
						</Box>,
					);
				}
			}
			continue;
		}

		// 消息第一行显示 > 前缀
		// 用户消息: 粉色 > 前缀
		// 非用户消息（AI 回复/系统消息）: 浅黄色 > 前缀
		const prefixColor = line.isUser ? THEME_PINK : THEME_LIGHT_YELLOW;

		if (isCursorLine) {
			// 光标行：第一个字符显示背景色
			if (line.isFirstLine) {
				// 有前缀的行：> 字符显示背景色
				contentRows.push(
					<Box key={`line-${line.msgIndex}-${i}`} height={1}>
						{renderLineWithCursorBg(">", prefixColor)}
						<Text color={prefixColor} bold>
							{" "}
						</Text>
						<Text>{line.text || " "}</Text>
					</Box>,
				);
			} else {
				// 无前缀的行：内容第一个字符显示背景色
				const text = line.text || " ";
				contentRows.push(
					<Box key={`line-${line.msgIndex}-${i}`} height={1}>
						{renderLineWithCursorBg(text)}
					</Box>,
				);
			}
		} else {
			// 非光标行：正常显示
			const prefix = line.isFirstLine ? (
				<Text color={prefixColor} bold>
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
	}

	// 3. 底部指示器
	if (hasMoreBelow) {
		contentRows.push(
			<Box key="indicator-below" justifyContent="center" height={1}>
				<Text dimColor>{t("messageOutput.scrollDownHint", { count: linesBelow })}</Text>
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
