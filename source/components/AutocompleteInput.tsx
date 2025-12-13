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

	// 计算显示内容，支持自动换行
	const displayText = input;
	const suggestionText = effectiveSuggestion || "";
	// 不再把 prompt 拼接进去，单独渲染
	const fullText = displayText + suggestionText;

	// 计算光标位置相对于显示文本（不含 prompt）
	const cursorOffset = cursorPosition;

	// 将文本分成多行
	const wrapText = (text: string, width: number): string[] => {
		if (width <= 0) return [text];
		const lines: string[] = [];
		let remaining = text;
		while (remaining.length > 0) {
			lines.push(remaining.slice(0, width));
			remaining = remaining.slice(width);
		}
		return lines.length > 0 ? lines : [""];
	};

	const effectiveWidth = columns - prompt.length; // 第一行要减去 prompt 宽度
	const lines = wrapText(fullText, effectiveWidth > 0 ? effectiveWidth : columns);

	// 找到光标所在的行和列
	const cursorLine = Math.floor(cursorOffset / (effectiveWidth > 0 ? effectiveWidth : columns));
	const cursorCol = cursorOffset % (effectiveWidth > 0 ? effectiveWidth : columns);

	return (
		<Box flexDirection="column">
			{/* 输入行 */}
			{lines.map((line, lineIndex) => {
				const lineWidth = effectiveWidth > 0 ? effectiveWidth : columns;
				const inputEndInLine =
					lineIndex === Math.floor(input.length / lineWidth);
				const suggestionStart =
					inputEndInLine ? input.length % lineWidth : -1;

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
						{isFirstLine && <Text color="magenta">{prompt}</Text>}
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
							<Text color="yellow">/ </Text>
							<Text color="gray">for commands</Text>
						</Box>
						<Box width="50%">
							<Text color="yellow">Tab </Text>
							<Text color="gray">to autocomplete</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="yellow">Ctrl+A </Text>
							<Text color="gray">move to start</Text>
						</Box>
						<Box width="50%">
							<Text color="yellow">Ctrl+E </Text>
							<Text color="gray">move to end</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="yellow">Ctrl+U </Text>
							<Text color="gray">clear before cursor</Text>
						</Box>
						<Box width="50%">
							<Text color="yellow">Ctrl+K </Text>
							<Text color="gray">clear after cursor</Text>
						</Box>
					</Box>
					<Box flexDirection="row" flexWrap="wrap">
						<Box width="50%">
							<Text color="yellow">Escape </Text>
							<Text color="gray">clear input</Text>
						</Box>
						<Box width="50%">
							<Text color="yellow">Ctrl+C </Text>
							<Text color="gray">exit</Text>
						</Box>
					</Box>
				</Box>
			)}
		</Box>
	);
}
