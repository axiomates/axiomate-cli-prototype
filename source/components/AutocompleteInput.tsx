import { Box, Text, useInput, useApp } from "ink";
import { useReducer, useEffect, useRef, useCallback, useMemo, useState } from "react";
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
	onMessage?: (message: string) => void;
	onClear?: () => void;
	onExit?: () => void;
	slashCommands?: SlashCommand[];
};

// ============================================================================
// 状态机类型定义
// ============================================================================

/**
 * 输入模式 - 互斥状态机
 * - normal: 普通输入模式（带自动补全）
 * - history: 历史浏览模式（上下键浏览历史记录）
 * - slash: 斜杠命令选择模式
 * - slash_sub: 斜杠命令子模式（预留，如 /model 后选择模型）
 * - help: 快捷键帮助模式
 */
type InputMode =
	| { type: "normal" }
	| { type: "history"; index: number; savedInput: string }
	| { type: "slash"; selectedIndex: number }
	| { type: "slash_sub"; command: string; selectedIndex: number }
	| { type: "help" };

/**
 * 统一的输入状态
 */
type InputState = {
	input: string;
	cursor: number;
	suggestion: string | null;
	mode: InputMode;
};

/**
 * Reducer Action 类型
 */
type InputAction =
	| { type: "SET_INPUT"; input: string; cursor: number }
	| { type: "SET_CURSOR"; cursor: number }
	| { type: "SET_SUGGESTION"; suggestion: string | null }
	| { type: "ENTER_HISTORY"; index: number; savedInput: string; historyInput: string }
	| { type: "NAVIGATE_HISTORY"; index: number; historyInput: string }
	| { type: "EXIT_HISTORY" }
	| { type: "SELECT_SLASH_COMMAND"; index: number }
	| { type: "EXIT_SLASH" }
	| { type: "TOGGLE_HELP" }
	| { type: "RESET" };

// ============================================================================
// 模式判断 Helper 函数
// ============================================================================

const isNormalMode = (mode: InputMode): mode is { type: "normal" } =>
	mode.type === "normal";

const isHistoryMode = (
	mode: InputMode,
): mode is { type: "history"; index: number; savedInput: string } =>
	mode.type === "history";

const isSlashModeType = (
	mode: InputMode,
): mode is { type: "slash"; selectedIndex: number } => mode.type === "slash";

const isHelpMode = (mode: InputMode): mode is { type: "help" } =>
	mode.type === "help";

// ============================================================================
// Reducer 实现
// ============================================================================

const initialState: InputState = {
	input: "",
	cursor: 0,
	suggestion: null,
	mode: { type: "normal" },
};

function inputReducer(state: InputState, action: InputAction): InputState {
	switch (action.type) {
		case "SET_INPUT": {
			const isSlash = action.input.startsWith("/");
			const wasSlash = state.input.startsWith("/");

			// 从普通模式输入 /，进入 slash 模式
			if (isSlash && !wasSlash && isNormalMode(state.mode)) {
				return {
					...state,
					input: action.input,
					cursor: action.cursor,
					suggestion: null,
					mode: { type: "slash", selectedIndex: 0 },
				};
			}

			// 从 slash 删除 /，回到普通模式
			if (!isSlash && wasSlash && isSlashModeType(state.mode)) {
				return {
					...state,
					input: action.input,
					cursor: action.cursor,
					mode: { type: "normal" },
				};
			}

			// 在历史模式下输入，退出历史模式
			if (isHistoryMode(state.mode)) {
				const newMode = isSlash
					? { type: "slash" as const, selectedIndex: 0 }
					: { type: "normal" as const };
				return {
					...state,
					input: action.input,
					cursor: action.cursor,
					mode: newMode,
				};
			}

			return {
				...state,
				input: action.input,
				cursor: action.cursor,
			};
		}

		case "SET_CURSOR":
			return { ...state, cursor: action.cursor };

		case "SET_SUGGESTION":
			return { ...state, suggestion: action.suggestion };

		case "ENTER_HISTORY":
			return {
				...state,
				input: action.historyInput,
				cursor: action.historyInput.length,
				suggestion: null,
				mode: {
					type: "history",
					index: action.index,
					savedInput: action.savedInput,
				},
			};

		case "NAVIGATE_HISTORY":
			if (!isHistoryMode(state.mode)) return state;
			return {
				...state,
				input: action.historyInput,
				cursor: action.historyInput.length,
				mode: { ...state.mode, index: action.index },
			};

		case "EXIT_HISTORY":
			if (!isHistoryMode(state.mode)) return state;
			return {
				...state,
				input: state.mode.savedInput,
				cursor: state.mode.savedInput.length,
				mode: { type: "normal" },
			};

		case "SELECT_SLASH_COMMAND":
			if (!isSlashModeType(state.mode)) return state;
			return {
				...state,
				mode: { ...state.mode, selectedIndex: action.index },
			};

		case "EXIT_SLASH":
			return {
				...state,
				input: "",
				cursor: 0,
				mode: { type: "normal" },
			};

		case "TOGGLE_HELP":
			if (isHelpMode(state.mode)) {
				return { ...state, mode: { type: "normal" } };
			}
			return { ...state, mode: { type: "help" } };

		case "RESET":
			return initialState;

		default:
			return state;
	}
}

export default function AutocompleteInput({
	prompt = "> ",
	onMessage,
	onClear,
	onExit,
	slashCommands = [],
}: Props) {
	const { exit } = useApp();
	const [state, dispatch] = useReducer(inputReducer, initialState);
	const columns = useTerminalWidth();
	const abortControllerRef = useRef<AbortController | null>(null);

	// 输入历史记录（独立于输入状态）
	const [history, setHistory] = useState<string[]>([]);

	// 解构状态便于使用
	const { input, cursor, suggestion, mode } = state;

	// 模式判断（派生状态）
	const inSlashMode = isSlashModeType(mode) || input.startsWith("/");
	const inHistoryMode = isHistoryMode(mode);
	const inHelpMode = isHelpMode(mode);

	// 获取当前选中的命令索引（从 mode 中获取）
	const selectedCommandIndex = isSlashModeType(mode) ? mode.selectedIndex : 0;

	// 获取历史索引（从 mode 中获取）
	const historyIndex = isHistoryMode(mode) ? mode.index : -1;

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

			// 可用命令列表（用于 help 显示）
			const AVAILABLE_COMMANDS = ["help", "exit", "quit", "clear", "version"];

			onMessage?.(`> ${value}`);

			// 处理斜杠命令
			if (value.startsWith("/")) {
				const slashCmd = value.slice(1).toLowerCase();
				if (slashCmd === "help") {
					onMessage?.("Available commands: " + AVAILABLE_COMMANDS.join(", "));
				} else if (slashCmd === "exit") {
					if (onExit) {
						onExit();
					} else {
						exit();
					}
				} else if (slashCmd === "clear") {
					onClear?.();
				} else if (slashCmd === "version") {
					onMessage?.("axiomate-cli v1.0.0");
				} else if (slashCmd === "config") {
					onMessage?.("Config: (empty)");
				} else if (slashCmd === "status") {
					onMessage?.("Status: running");
				} else {
					onMessage?.(`Unknown slash command: ${value}`);
				}
				return;
			}

			// 处理普通命令
			const cmd = value.trim().toLowerCase();
			if (cmd === "help") {
				onMessage?.("Available commands: " + AVAILABLE_COMMANDS.join(", "));
			} else if (cmd === "exit" || cmd === "quit") {
				if (onExit) {
					onExit();
				} else {
					exit();
				}
			} else if (cmd === "clear") {
				onClear?.();
			} else if (cmd === "version") {
				onMessage?.("axiomate-cli v1.0.0");
			} else {
				onMessage?.(`Unknown command: ${value}`);
			}
		},
		[onMessage, onClear, onExit, exit],
	);

	// 过滤匹配的斜杠命令（只匹配命令名前缀）
	const filteredCommands = useMemo(() => {
		if (!inSlashMode) return [];
		const query = input.slice(1).toLowerCase();
		return slashCommands.filter((cmd) =>
			cmd.name.toLowerCase().startsWith(query),
		);
	}, [input, inSlashMode, slashCommands]);

	// 斜杠命令模式下的自动补全建议
	const slashSuggestion = useMemo(() => {
		if (!inSlashMode || filteredCommands.length === 0) return null;
		const selectedCmd = filteredCommands[selectedCommandIndex];
		if (!selectedCmd) return null;
		const query = input.slice(1).toLowerCase();
		const cmdName = selectedCmd.name.toLowerCase();
		// 只有当命令名以查询开头时才显示补全
		if (cmdName.startsWith(query) && cmdName !== query) {
			return selectedCmd.name.slice(query.length);
		}
		return null;
	}, [inSlashMode, filteredCommands, selectedCommandIndex, input]);

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
		async (text: string, browsing: boolean) => {
			// 历史浏览模式下不触发自动补全
			if (browsing) {
				return;
			}

			// 斜杠模式下使用 slashSuggestion，不触发异步补全
			if (text.startsWith("/")) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			// 取消之前的请求
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			if (!text) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				const result = await getCommandSuggestion(text, controller.signal);
				if (!controller.signal.aborted) {
					dispatch({ type: "SET_SUGGESTION", suggestion: result });
				}
			} catch {
				// 忽略取消错误
				if (!controller.signal.aborted) {
					dispatch({ type: "SET_SUGGESTION", suggestion: null });
				}
			}
		},
		[getCommandSuggestion],
	);

	// 当输入变化时触发自动补全
	useEffect(() => {
		triggerAutocomplete(state.input, inHistoryMode);
	}, [state.input, inHistoryMode, triggerAutocomplete]);

	// 合并建议：斜杠模式使用 slashSuggestion，普通模式使用 suggestion
	// 历史浏览模式下不显示建议
	const effectiveSuggestion = inHistoryMode
		? null
		: inSlashMode
			? slashSuggestion
			: suggestion;

	// 清理
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	useInput((inputChar, key) => {
		// Help 模式优先处理
		if (inHelpMode) {
			if (key.escape || inputChar) {
				dispatch({ type: "TOGGLE_HELP" });
			}
			return;
		}

		// Ctrl+Enter 插入换行
		if (key.ctrl && key.return) {
			const newInput = input.slice(0, cursor) + "\n" + input.slice(cursor);
			dispatch({ type: "SET_INPUT", input: newInput, cursor: cursor + 1 });
			return;
		}

		// 斜杠命令模式下的特殊处理
		if (inSlashMode && filteredCommands.length > 0) {
			if (key.upArrow) {
				const newIndex =
					selectedCommandIndex > 0
						? selectedCommandIndex - 1
						: filteredCommands.length - 1;
				dispatch({ type: "SELECT_SLASH_COMMAND", index: newIndex });
				return;
			}

			if (key.downArrow) {
				const newIndex =
					selectedCommandIndex < filteredCommands.length - 1
						? selectedCommandIndex + 1
						: 0;
				dispatch({ type: "SELECT_SLASH_COMMAND", index: newIndex });
				return;
			}

			if (key.return) {
				// 选中命令并提交
				const selectedCmd = filteredCommands[selectedCommandIndex];
				if (selectedCmd) {
					const cmdText = "/" + selectedCmd.name;
					handleSubmit(cmdText);
				}
				return;
			}
		}

		if (key.return) {
			// 回车提交
			handleSubmit(input);
			return;
		}

		if (key.tab && effectiveSuggestion) {
			// Tab 确认补全
			const newInput = input + effectiveSuggestion;
			dispatch({ type: "SET_INPUT", input: newInput, cursor: newInput.length });
			dispatch({ type: "SET_SUGGESTION", suggestion: null });
			return;
		}

		if (key.backspace || key.delete) {
			if (cursor > 0) {
				const newInput = input.slice(0, cursor - 1) + input.slice(cursor);
				dispatch({ type: "SET_INPUT", input: newInput, cursor: cursor - 1 });
			}
			return;
		}

		if (key.leftArrow) {
			if (cursor > 0) {
				dispatch({ type: "SET_CURSOR", cursor: cursor - 1 });
			}
			return;
		}

		if (key.rightArrow) {
			if (effectiveSuggestion && cursor === input.length) {
				// 如果光标在末尾且有建议，向右移动接受一个字符
				const newInput = input + effectiveSuggestion[0];
				const remaining = effectiveSuggestion.slice(1) || null;
				dispatch({ type: "SET_INPUT", input: newInput, cursor: newInput.length });
				if (!inSlashMode) {
					dispatch({ type: "SET_SUGGESTION", suggestion: remaining });
				}
			} else if (cursor < input.length) {
				dispatch({ type: "SET_CURSOR", cursor: cursor + 1 });
			}
			return;
		}

		// 非斜杠模式下的历史导航
		if (!inSlashMode && (key.upArrow || key.downArrow)) {
			if (history.length === 0) return;

			if (key.upArrow) {
				if (historyIndex === -1) {
					// 第一次按上箭头，保存当前输入并切换到最新历史
					const historyItem = history[history.length - 1]!;
					dispatch({
						type: "ENTER_HISTORY",
						index: history.length - 1,
						savedInput: input,
						historyInput: historyItem,
					});
				} else if (historyIndex > 0) {
					// 继续向上浏览
					const newIndex = historyIndex - 1;
					const historyItem = history[newIndex]!;
					dispatch({
						type: "NAVIGATE_HISTORY",
						index: newIndex,
						historyInput: historyItem,
					});
				}
			} else if (key.downArrow) {
				if (historyIndex === -1) {
					// 不在历史浏览模式，忽略
					return;
				} else if (historyIndex < history.length - 1) {
					// 继续向下浏览
					const newIndex = historyIndex + 1;
					const historyItem = history[newIndex]!;
					dispatch({
						type: "NAVIGATE_HISTORY",
						index: newIndex,
						historyInput: historyItem,
					});
				} else {
					// 回到原始输入
					dispatch({ type: "EXIT_HISTORY" });
				}
			}
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
			const newInput = input.slice(cursor);
			dispatch({ type: "SET_INPUT", input: newInput, cursor: 0 });
			return;
		}

		if (key.ctrl && inputChar === "k") {
			// Ctrl+K 清除光标后的内容
			const newInput = input.slice(0, cursor);
			dispatch({ type: "SET_INPUT", input: newInput, cursor: cursor });
			return;
		}

		if (key.ctrl && inputChar === "a") {
			// Ctrl+A 移动到行首
			dispatch({ type: "SET_CURSOR", cursor: 0 });
			return;
		}

		if (key.ctrl && inputChar === "e") {
			// Ctrl+E 移动到行尾
			dispatch({ type: "SET_CURSOR", cursor: input.length });
			return;
		}

		if (key.escape) {
			// Escape 退出斜杠模式或清除建议
			if (inSlashMode) {
				dispatch({ type: "EXIT_SLASH" });
			} else {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
			}
			return;
		}

		// 普通字符输入
		if (inputChar && !key.ctrl && !key.meta) {
			// 输入 ? 时显示快捷键帮助（仅当输入框为空时）
			if (inputChar === "?" && input === "") {
				dispatch({ type: "TOGGLE_HELP" });
				return;
			}
			// 插入字符
			const newInput = input.slice(0, cursor) + inputChar + input.slice(cursor);
			dispatch({
				type: "SET_INPUT",
				input: newInput,
				cursor: cursor + inputChar.length,
			});
		}
	});

	// 计算显示内容，支持手动换行和自动换行
	const displayText = state.input;
	const suggestionText = inHistoryMode
		? ""
		: (state.input.startsWith("/") ? slashSuggestion : state.suggestion) || "";

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
		const lineWidth =
			columns - prompt.length > 0 ? columns - prompt.length : columns;
		// 直接用 state，确保渲染时数据一致
		const fullText = displayText + suggestionText;

		// 先按手动换行符分割
		const manualLines = fullText.split("\n");
		const allLines: string[] = [];

		// 记录每个手动行的起始位置（用于计算光标位置）
		let charCount = 0;
		let cursorLine = 0;
		let cursorCol = 0;
		let foundCursor = false;
		const cursorPos = state.cursor;

		for (let i = 0; i < manualLines.length; i++) {
			const manualLine = manualLines[i]!;
			const wrappedLines = wrapLine(manualLine, lineWidth);

			for (let j = 0; j < wrappedLines.length; j++) {
				const line = wrappedLines[j]!;

				// 计算光标位置
				if (!foundCursor) {
					const lineStart = charCount;
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

		return { lines: allLines, cursorLine, cursorCol, lineWidth };
	};

	const { lines, cursorLine, cursorCol, lineWidth } = processLines();

	// 计算输入文本在哪一行结束（用于显示建议）
	const inputEndInfo = (() => {
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
	})();

	// 计算 prompt 缩进（用于后续行对齐）
	const promptIndent = " ".repeat(prompt.length);

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
					<Box key={`${lineIndex}-${line}`}>
						{/* 第一行显示粉色 prompt，后续行显示等宽空格缩进 */}
						{isFirstLine ? (
							<Text color="#FF69B4">{prompt}</Text>
						) : (
							<Text>{promptIndent}</Text>
						)}
						<Text>
							{isCursorLine ? (
								(() => {
									// 光标在用户输入部分
									if (cursorCol < userPart.length) {
										return (
											<>
												{userPart.slice(0, cursorCol)}
												<Text inverse>{userPart[cursorCol]}</Text>
												{userPart.slice(cursorCol + 1)}
												<Text color="gray">{suggestPart}</Text>
											</>
										);
									}
									// 光标在用户输入末尾，有 suggestion
									if (suggestPart.length > 0) {
										return (
											<>
												{userPart}
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
											{userPart}
											<Text inverse> </Text>
										</>
									);
								})()
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
			{inSlashMode && filteredCommands.length > 0 && (
				<Box flexDirection="column">
					<Text color="gray">{"─".repeat(columns)}</Text>
					{filteredCommands.map((cmd, index) => (
						<Box key={cmd.name}>
							<Text
								backgroundColor={
									index === selectedCommandIndex ? "blue" : undefined
								}
								color={index === selectedCommandIndex ? "white" : undefined}
							>
								{`${promptIndent}/`}
								{cmd.name}
							</Text>
							<Text color="gray"> - {cmd.description}</Text>
						</Box>
					))}
				</Box>
			)}

			{/* 快捷键帮助 */}
			{inHelpMode && (
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
