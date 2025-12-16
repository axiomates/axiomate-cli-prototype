/**
 * AutocompleteInput 主组件
 * 提供类似 Claude Code 终端的输入框，支持多种输入模式
 */

import { Box } from "ink";
import { useReducer, useCallback, useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "ink";
import useTerminalWidth from "../../hooks/useTerminalWidth.js";
import { createMessageInput, createCommandInput } from "../../models/input.js";
import { createCommandRichInput } from "../../models/richInput.js";

// Types
import type { AutocompleteInputProps } from "./types.js";
import { isSlashMode, isHistoryMode, isHelpMode } from "./types.js";

// Re-exports
export type {
	UserInput,
	SlashCommand,
	AutocompleteInputProps,
} from "./types.js";
export { isMessageInput, isCommandInput } from "./types.js";

// Reducer
import { inputReducer, initialState } from "./reducer.js";

// Hooks
import { useAutocomplete } from "./hooks/useAutocomplete.js";
import { useInputHandler } from "./hooks/useInputHandler.js";

// Utils
import { processLines, getInputEndInfo } from "./utils/lineProcessor.js";

// Components
import { InputLine, segmentsToRanges } from "./components/InputLine.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { HelpPanel } from "./components/HelpPanel.js";


export default function AutocompleteInput({
	prompt = "> ",
	onSubmit,
	onClear,
	onExit,
	slashCommands = [],
}: AutocompleteInputProps) {
	const { exit } = useApp();
	const [state, dispatch] = useReducer(inputReducer, initialState);
	const columns = useTerminalWidth();

	// 输入历史记录（独立于输入状态）
	const [history, setHistory] = useState<string[]>([]);

	// 解构状态便于使用
	const { input, mode } = state;

	// 获取命令路径的引用（用于提交时）
	const commandPathRef = useRef<string[]>([]);

	// 模式判断（派生状态）
	const inSlashMode = isSlashMode(mode);
	const inHelpMode = isHelpMode(mode);

	// 获取当前 slash 模式的路径
	const slashPath = useMemo(() => (isSlashMode(mode) ? mode.path : []), [mode]);

	// 保持命令路径引用同步（用于提交时获取）
	useEffect(() => {
		commandPathRef.current = slashPath;
	}, [slashPath]);

	// 获取当前选中的命令索引
	const selectedIndex = isSlashMode(mode) ? mode.selectedIndex : 0;

	// 自动补全 Hook
	const { effectiveSuggestion, filteredCommands, slashSuggestion } =
		useAutocomplete({
			state,
			dispatch,
			slashCommands,
		});

	// 处理提交
	const handleSubmit = useCallback(
		(value: string) => {
			if (!value.trim()) return;

			// 添加到历史记录（避免重复）
			setHistory((prev) => {
				const trimmed = value.trim();
				const filtered = prev.filter((item) => item !== trimmed);
				return [...filtered, trimmed];
			});

			// 重置输入状态
			dispatch({ type: "RESET" });

			// 处理斜杠命令（内部命令）
			if (value.startsWith("/")) {
				// 使用保存的路径（通过 slash 模式导航得到）
				// 如果路径为空（手动输入命令），则简单解析
				const commandPath = commandPathRef.current.length > 0
					? commandPathRef.current
					: value.slice(1).split(/\s*→\s*/).map(s => s.trim()).filter(Boolean);
				const userInput = createCommandInput(commandPath, value);
				onSubmit?.(userInput);

				// 内置命令处理
				const slashCmd = commandPath[0]?.toLowerCase();
				if (slashCmd === "exit") {
					if (onExit) {
						onExit();
					} else {
						exit();
					}
				} else if (slashCmd === "clear") {
					onClear?.();
				}
				return;
			}

			// 处理普通输入（消息类型）
			const userInput = createMessageInput(value.trim());
			onSubmit?.(userInput);

			// 内置命令快捷方式（不带斜杠的命令）
			const cmd = value.trim().toLowerCase();
			if (cmd === "exit" || cmd === "quit") {
				if (onExit) {
					onExit();
				} else {
					exit();
				}
			} else if (cmd === "clear") {
				onClear?.();
			}
		},
		[onSubmit, onClear, onExit, exit],
	);

	// 键盘输入处理 Hook
	useInputHandler({
		state,
		dispatch,
		history,
		filteredCommands,
		effectiveSuggestion,
		onSubmit: handleSubmit,
		onExit,
	});

	// 计算显示内容
	const displayText = input;
	const inHistoryMode = isHistoryMode(mode);
	const suggestionText = inHistoryMode
		? ""
		: (input.startsWith("/") ? slashSuggestion : state.suggestion) || "";

	// 处理行和光标位置
	const { lines, lineOffsets, cursorLine, cursorCol, lineWidth } = processLines(
		displayText,
		suggestionText,
		state.cursor,
		columns,
		prompt.length,
	);

	// 构建颜色信息（使用 RichInput 模型）
	const colorSegments = createCommandRichInput(slashPath, false).segments;
	const colorRanges = segmentsToRanges(colorSegments);

	// 计算输入文本结束位置
	const inputEndInfo = getInputEndInfo(displayText, lineWidth);

	// 计算 prompt 缩进（用于后续行对齐）
	const promptIndent = " ".repeat(prompt.length);

	return (
		<Box flexDirection="column">
			{/* 输入行 */}
			{lines.map((line, lineIndex) => {
				const isInputEndLine = lineIndex === inputEndInfo.endLine;
				const suggestionStart = isInputEndLine ? inputEndInfo.endCol : -1;

				return (
					<InputLine
						key={`${lineIndex}-${line}`}
						line={line}
						lineIndex={lineIndex}
						lineOffset={lineOffsets[lineIndex] ?? 0}
						isFirstLine={lineIndex === 0}
						isCursorLine={lineIndex === cursorLine}
						cursorCol={cursorCol}
						suggestionStart={suggestionStart}
						prompt={prompt}
						promptIndent={promptIndent}
						colorRanges={colorRanges}
					/>
				);
			})}

			{/* 斜杠命令列表 */}
			{inSlashMode && filteredCommands.length > 0 && (
				<SlashMenu
					commands={filteredCommands}
					selectedIndex={selectedIndex}
					path={slashPath}
					columns={columns}
					promptIndent={promptIndent}
				/>
			)}

			{/* 快捷键帮助 */}
			{inHelpMode && <HelpPanel columns={columns} />}
		</Box>
	);
}
