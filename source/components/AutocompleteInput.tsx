import { Box, Text, useInput, useApp } from "ink";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useTerminalWidth from "../hooks/useTerminalWidth.js";

// 命令列表用于自动补全
const COMMANDS = [
	"help",
	"exit",
	"quit",
	"clear",
	"history",
	"config",
	"config set",
	"config get",
	"config list",
	"status",
	"start",
	"stop",
	"restart",
	"logs",
	"version",
];

export type SlashCommand = {
	name: string;
	description: string;
};

type Props = {
	prompt?: string;
	onSubmit?: (value: string) => void;
	onExit?: () => void;
	slashCommands?: SlashCommand[];
};

export default function AutocompleteInput({
	prompt = "> ",
	onSubmit,
	onExit,
	slashCommands = [],
}: Props) {
	const { exit } = useApp();
	const [input, setInput] = useState("");
	const [cursorPosition, setCursorPosition] = useState(0);
	const [suggestion, setSuggestion] = useState<string | null>(null);
	const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
	const [showShortcutHelp, setShowShortcutHelp] = useState(false);
	const columns = useTerminalWidth();
	const abortControllerRef = useRef<AbortController | null>(null);

	// 检测是否在斜杠命令模式
	const isSlashMode = input.startsWith("/");

	// 过滤匹配的斜杠命令（只匹配命令名前缀）
	const filteredCommands = useMemo(() => {
		if (!isSlashMode) return [];
		const query = input.slice(1).toLowerCase();
		return slashCommands.filter((cmd) =>
			cmd.name.toLowerCase().startsWith(query),
		);
	}, [input, isSlashMode, slashCommands]);

	// 重置选中索引当命令列表变化时
	useEffect(() => {
		setSelectedCommandIndex(0);
	}, [filteredCommands.length]);

	// 斜杠命令模式下的自动补全建议
	const slashSuggestion = useMemo(() => {
		if (!isSlashMode || filteredCommands.length === 0) return null;
		const selectedCmd = filteredCommands[selectedCommandIndex];
		if (!selectedCmd) return null;
		const query = input.slice(1).toLowerCase();
		const cmdName = selectedCmd.name.toLowerCase();
		// 只有当命令名以查询开头时才显示补全
		if (cmdName.startsWith(query) && cmdName !== query) {
			return selectedCmd.name.slice(query.length);
		}
		return null;
	}, [isSlashMode, filteredCommands, selectedCommandIndex, input]);

	// 命令自动补全函数
	const getCommandSuggestion = useCallback(
		async (text: string, signal: AbortSignal): Promise<string | null> => {
			// 模拟异步延迟
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(resolve, 100);
				signal.addEventListener("abort", () => {
					clearTimeout(timeout);
					reject(new DOMException("Aborted", "AbortError"));
				});
			});

			if (signal.aborted) {
				return null;
			}

			// 查找匹配的命令
			const lowerInput = text.toLowerCase();
			const match = COMMANDS.find(
				(cmd) => cmd.toLowerCase().startsWith(lowerInput) && cmd !== text,
			);

			if (match) {
				return match.slice(text.length);
			}

			return null;
		},
		[],
	);

	// 触发自动补全
	const triggerAutocomplete = useCallback(
		async (text: string) => {
			// 斜杠模式下使用 slashSuggestion，不触发异步补全
			if (text.startsWith("/")) {
				setSuggestion(null);
				return;
			}

			// 取消之前的请求
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			if (!text) {
				setSuggestion(null);
				return;
			}

			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				const result = await getCommandSuggestion(text, controller.signal);
				if (!controller.signal.aborted) {
					setSuggestion(result);
				}
			} catch {
				// 忽略取消错误
				if (!controller.signal.aborted) {
					setSuggestion(null);
				}
			}
		},
		[getCommandSuggestion],
	);

	// 当输入变化时触发自动补全
	useEffect(() => {
		triggerAutocomplete(input);
	}, [input, triggerAutocomplete]);

	// 合并建议：斜杠模式使用 slashSuggestion，普通模式使用 suggestion
	const effectiveSuggestion = isSlashMode ? slashSuggestion : suggestion;

	// 清理
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	useInput((inputChar, key) => {
		// Ctrl+Enter 插入换行
		if (key.ctrl && key.return) {
			const newInput =
				input.slice(0, cursorPosition) + "\n" + input.slice(cursorPosition);
			setInput(newInput);
			setCursorPosition(cursorPosition + 1);
			return;
		}

		// 斜杠命令模式下的特殊处理
		if (isSlashMode && filteredCommands.length > 0) {
			if (key.upArrow) {
				setSelectedCommandIndex((prev) =>
					prev > 0 ? prev - 1 : filteredCommands.length - 1,
				);
				return;
			}

			if (key.downArrow) {
				setSelectedCommandIndex((prev) =>
					prev < filteredCommands.length - 1 ? prev + 1 : 0,
				);
				return;
			}

			if (key.return) {
				// 选中命令并提交
				const selectedCmd = filteredCommands[selectedCommandIndex];
				if (selectedCmd) {
					const cmdText = "/" + selectedCmd.name;
					onSubmit?.(cmdText);
					setInput("");
					setCursorPosition(0);
					setSuggestion(null);
					setSelectedCommandIndex(0);
				}
				return;
			}
		}

		if (key.return) {
			// 回车提交
			onSubmit?.(input);
			setInput("");
			setCursorPosition(0);
			setSuggestion(null);
			return;
		}

		if (key.tab && effectiveSuggestion) {
			// Tab 确认补全
			const newInput = input + effectiveSuggestion;
			setInput(newInput);
			setCursorPosition(newInput.length);
			setSuggestion(null);
			return;
		}

		if (key.backspace || key.delete) {
			if (cursorPosition > 0) {
				const newInput =
					input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
				setInput(newInput);
				setCursorPosition(cursorPosition - 1);
			}
			return;
		}

		if (key.leftArrow) {
			if (cursorPosition > 0) {
				setCursorPosition(cursorPosition - 1);
			}
			return;
		}

		if (key.rightArrow) {
			if (effectiveSuggestion && cursorPosition === input.length) {
				// 如果光标在末尾且有建议，向右移动接受一个字符
				const newInput = input + effectiveSuggestion[0];
				setInput(newInput);
				setCursorPosition(newInput.length);
				const remaining = effectiveSuggestion.slice(1) || null;
				if (!isSlashMode) {
					setSuggestion(remaining);
				}
			} else if (cursorPosition < input.length) {
				setCursorPosition(cursorPosition + 1);
			}
			return;
		}

		if (!isSlashMode && (key.upArrow || key.downArrow)) {
			// 预留历史记录功能
			return;
		}

		if (key.ctrl && inputChar === "c") {
			if (onExit) {
				onExit();
			} else {
				exit();
			}
			return;
		}

		if (key.ctrl && inputChar === "u") {
			// Ctrl+U 清除光标前的内容
			setInput(input.slice(cursorPosition));
			setCursorPosition(0);
			return;
		}

		if (key.ctrl && inputChar === "k") {
			// Ctrl+K 清除光标后的内容
			setInput(input.slice(0, cursorPosition));
			return;
		}

		if (key.ctrl && inputChar === "a") {
			// Ctrl+A 移动到行首
			setCursorPosition(0);
			return;
		}

		if (key.ctrl && inputChar === "e") {
			// Ctrl+E 移动到行尾
			setCursorPosition(input.length);
			return;
		}

		if (key.escape) {
			// Escape 清除建议或退出斜杠模式或关闭快捷键帮助
			if (showShortcutHelp) {
				setShowShortcutHelp(false);
				return;
			}
			if (isSlashMode) {
				setInput("");
				setCursorPosition(0);
			}
			setSuggestion(null);
			return;
		}

		// 普通字符输入
		if (inputChar && !key.ctrl && !key.meta) {
			// 输入 ? 时显示快捷键帮助（仅当输入框为空时）
			if (inputChar === "?" && input === "") {
				setShowShortcutHelp(true);
				return;
			}
			// 关闭快捷键帮助
			if (showShortcutHelp) {
				setShowShortcutHelp(false);
			}
			const newInput =
				input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
			setInput(newInput);
			setCursorPosition(cursorPosition + inputChar.length);
		}
	});

	// 计算显示内容，支持手动换行和自动换行
	const displayText = input;
	const suggestionText = effectiveSuggestion || "";

	// 将单行文本按宽度自动换行
	const wrapLine = (text: string, width: number): string[] => {
		if (width <= 0 || text.length === 0) return [text];
		const lines: string[] = [];
		let remaining = text;
		while (remaining.length > 0) {
			lines.push(remaining.slice(0, width));
			remaining = remaining.slice(width);
		}
		return lines.length > 0 ? lines : [""];
	};

	// 处理手动换行 + 自动换行
	// 返回: { lines: 显示行数组, cursorLine: 光标所在行, cursorCol: 光标所在列 }
	const processLines = () => {
		const lineWidth = columns - prompt.length > 0 ? columns - prompt.length : columns;
		const fullText = displayText + suggestionText;

		// 先按手动换行符分割
		const manualLines = fullText.split("\n");
		const allLines: string[] = [];

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

				// 计算光标位置
				if (!foundCursor) {
					const lineStart = charCount;
					const lineEnd = charCount + line.length;

					if (cursorPosition >= lineStart && cursorPosition <= lineEnd) {
						cursorLine = allLines.length;
						cursorCol = cursorPosition - lineStart;
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

		return { lines: allLines, cursorLine, cursorCol, lineWidth };
	};

	const { lines, cursorLine, cursorCol, lineWidth } = processLines();

	// 计算输入文本在哪一行结束（用于显示建议）
	const inputEndInfo = (() => {
		const manualLines = displayText.split("\n");
		let totalLines = 0;
		let lastLineLength = 0;

		for (const manualLine of manualLines) {
			const wrappedCount = Math.max(1, Math.ceil(manualLine.length / lineWidth) || 1);
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
	})();

	return (
		<Box flexDirection="column">
			{/* 输入行 */}
			{lines.map((line, lineIndex) => {
				// 判断是否是输入结束行（用于显示建议部分）
				const isInputEndLine = lineIndex === inputEndInfo.endLine;
				const suggestionStart = isInputEndLine ? inputEndInfo.endCol : -1;

				// 拆分行内容：用户输入部分 vs 建议部分
				let userPart = line;
				let suggestPart = "";

				if (suggestionStart >= 0 && suggestionStart < line.length) {
					userPart = line.slice(0, suggestionStart);
					suggestPart = line.slice(suggestionStart);
				}

				const isCursorLine = lineIndex === cursorLine;
				const isFirstLine = lineIndex === 0;

				return (
					<Box key={lineIndex}>
						{/* 第一行显示粉色 prompt */}
						{isFirstLine && <Text color="#FF69B4">{prompt}</Text>}
						<Text>
							{isCursorLine ? (
								<>
									{userPart.slice(0, cursorCol)}
									<Text inverse>{userPart[cursorCol] || suggestPart[0] || " "}</Text>
									{cursorCol < userPart.length
										? userPart.slice(cursorCol + 1)
										: ""}
									{cursorCol >= userPart.length ? (
										<Text color="gray">
											{suggestPart.slice(cursorCol >= userPart.length ? 1 : 0)}
										</Text>
									) : (
										<Text color="gray">{suggestPart}</Text>
									)}
								</>
							) : (
								<>
									{userPart}
									<Text color="gray">{suggestPart}</Text>
								</>
							)}
						</Text>
					</Box>
				);
			})}

			{/* 斜杠命令列表 */}
			{isSlashMode && filteredCommands.length > 0 && (
				<Box flexDirection="column">
					<Text color="gray">{"─".repeat(columns)}</Text>
					{filteredCommands.map((cmd, index) => (
						<Box key={cmd.name}>
							<Text
								backgroundColor={index === selectedCommandIndex ? "blue" : undefined}
								color={index === selectedCommandIndex ? "white" : undefined}
							>
								{" /"}
								{cmd.name}
							</Text>
							<Text color="gray"> - {cmd.description}</Text>
						</Box>
					))}
				</Box>
			)}

			{/* 快捷键帮助 */}
			{showShortcutHelp && (
				<Box flexDirection="column">
					<Text color="gray">{"─".repeat(columns)}</Text>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="#FFFF00">/ </Text>
							<Text color="gray">for commands</Text>
						</Box>
						<Box width="50%">
							<Text color="#FFFF00">Tab </Text>
							<Text color="gray">to autocomplete</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+Enter </Text>
							<Text color="gray">new line</Text>
						</Box>
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+C </Text>
							<Text color="gray">exit</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+A </Text>
							<Text color="gray">move to start</Text>
						</Box>
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+E </Text>
							<Text color="gray">move to end</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+U </Text>
							<Text color="gray">clear before cursor</Text>
						</Box>
						<Box width="50%">
							<Text color="#FFFF00">Ctrl+K </Text>
							<Text color="gray">clear after cursor</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="#FFFF00">Escape </Text>
							<Text color="gray">clear input</Text>
						</Box>
					</Box>
				</Box>
			)}
		</Box>
	);
}
