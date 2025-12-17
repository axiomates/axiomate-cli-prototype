/**
 * AutocompleteInput 主组件
 * 提供类似 Claude Code 终端的输入框，支持多种输入模式
 */

import { Box } from "ink";
import { useReducer, useCallback, useState, useMemo } from "react";
import { useApp } from "ink";
import useTerminalWidth from "../../hooks/useTerminalWidth.js";
import { segmentsToRanges } from "../../models/richInput.js";
import {
	buildFileText,
	toHistoryEntry,
	toUserInput,
	type InputInstance,
	type HistoryEntry,
} from "../../models/inputInstance.js";
import { isMessageInput } from "../../models/input.js";

// Types
import type { AutocompleteInputProps } from "./types.js";
import { isSlashMode, isHistoryMode, isFileMode, isHelpMode } from "./types.js";

// Re-exports
export type {
	UserInput,
	SlashCommand,
	CommandAction,
	AutocompleteInputProps,
} from "./types.js";
export { isMessageInput, isCommandInput } from "./types.js";

// Reducer
import { editorReducer, initialState } from "./reducer.js";

// Hooks
import { useAutocomplete } from "./hooks/useAutocomplete.js";
import { useInputHandler } from "./hooks/useInputHandler.js";
import { useFileSelect } from "./hooks/useFileSelect.js";

// Utils
import { processLines, getInputEndInfo } from "./utils/lineProcessor.js";

// Components
import { InputLine } from "./components/InputLine.js";
import { SlashMenu } from "./components/SlashMenu.js";
import { FileMenu } from "./components/FileMenu.js";
import { HelpPanel } from "./components/HelpPanel.js";

export default function AutocompleteInput({
	prompt = "> ",
	onSubmit,
	onClear,
	onExit,
	slashCommands = [],
}: AutocompleteInputProps) {
	const { exit } = useApp();
	const [state, dispatch] = useReducer(editorReducer, initialState);
	const columns = useTerminalWidth();

	// 输入历史记录（存储 HistoryEntry，不含 cursor）
	const [history, setHistory] = useState<HistoryEntry[]>([]);

	// 解构状态便于使用
	const { instance, uiMode } = state;
	const { text: input, cursor, segments, commandPath } = instance;

	// 模式判断（派生状态）
	const inSlashMode = isSlashMode(uiMode);
	const inFileMode = isFileMode(uiMode);
	const inHelpMode = isHelpMode(uiMode);
	const inHistoryMode = isHistoryMode(uiMode);

	// 获取当前选中的命令索引
	const selectedIndex = isSlashMode(uiMode) ? uiMode.selectedIndex : 0;
	const fileSelectedIndex = isFileMode(uiMode) ? uiMode.selectedIndex : 0;

	// 文件选择相关状态
	// basePath 现在从 instance.filePath 获取
	const fileBasePath = useMemo(() => {
		if (!isFileMode(uiMode)) return "";
		return instance.filePath.join("\\") || ".";
	}, [uiMode, instance.filePath]);

	// 过滤文本从路径前缀之后提取
	const fileFilter = useMemo(() => {
		if (!isFileMode(uiMode)) return "";
		// 计算完整前缀（包括 @ 之前的文本 + 文件路径部分，如 "hello @assets\"）
		const { prefix } = uiMode;
		const filePathText = buildFileText(instance.filePath, true);
		const fullPrefix = prefix + filePathText;
		// 提取完整前缀之后的文本作为过滤条件
		if (input.length > fullPrefix.length) {
			const afterPath = input.slice(fullPrefix.length);
			// 匹配到空格或反斜杠为止
			const match = afterPath.match(/^[^\s\\]*/);
			return match ? match[0] : "";
		}
		return "";
	}, [uiMode, input, instance.filePath]);

	// 自动补全 Hook
	const { effectiveSuggestion, filteredCommands, slashSuggestion } =
		useAutocomplete({
			state,
			dispatch,
			slashCommands,
		});

	// 文件选择 Hook
	const { files: filteredFiles, loading: filesLoading } = useFileSelect(
		fileBasePath,
		fileFilter,
	);

	// 处理提交（接收完整的 InputInstance，保留彩色分段）
	const handleSubmit = useCallback(
		(submittedInstance: InputInstance) => {
			const value = submittedInstance.text;
			if (!value.trim()) return;

			// 添加到历史记录 - 转换为 HistoryEntry（去除 cursor），保留彩色分段
			// "?" 输入不存入历史
			if (value.trim() !== "?") {
				setHistory((prev) => {
					const trimmedText = value.trim();
					// 基于 text 去重
					const filtered = prev.filter(
						(entry) => entry.text.trim() !== trimmedText,
					);
					// 使用 toHistoryEntry 去除 cursor，保留其他属性
					return [...filtered, toHistoryEntry(submittedInstance)];
				});
			}

			// 重置输入状态
			dispatch({ type: "RESET" });

			// 使用 toUserInput 转换为 UserInput（保留 segments 和结构化信息）
			const userInput = toUserInput(submittedInstance);
			onSubmit?.(userInput);

			// 内置命令处理
			if (!isMessageInput(userInput)) {
				// 命令类型
				const slashCmd = userInput.commandPath[0]?.toLowerCase();
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
		filteredFiles,
		effectiveSuggestion,
		onSubmit: handleSubmit,
		onExit,
	});

	// 计算显示内容
	const displayText = input;
	const suggestionText = inHistoryMode
		? ""
		: (input.startsWith("/") ? slashSuggestion : state.suggestion) || "";

	// 处理行和光标位置
	const { lines, lineOffsets, cursorLine, cursorCol, lineWidth } = processLines(
		displayText,
		suggestionText,
		cursor,
		columns,
		prompt.length,
	);

	// 直接使用 instance.segments 构建颜色信息
	const colorRanges = useMemo(() => segmentsToRanges(segments), [segments]);

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
					path={commandPath}
					columns={columns}
					promptIndent={promptIndent}
				/>
			)}

			{/* 文件选择列表 */}
			{inFileMode && (
				<FileMenu
					files={filteredFiles}
					selectedIndex={fileSelectedIndex}
					path={instance.filePath}
					columns={columns}
					promptIndent={promptIndent}
					loading={filesLoading}
				/>
			)}

			{/* 快捷键帮助 */}
			{inHelpMode && <HelpPanel columns={columns} />}
		</Box>
	);
}
