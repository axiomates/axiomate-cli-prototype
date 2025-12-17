/**
 * 键盘输入处理 Hook
 */

import { useCallback } from "react";
import { useInput, useApp } from "ink";
import type {
	EditorState,
	EditorAction,
	SlashCommand,
	InputInstance,
} from "../types.js";
import {
	isSlashMode,
	isHistoryMode,
	isFileMode,
	isHelpMode,
	buildCommandText,
	buildFileText,
} from "../types.js";
import type { FileItem } from "./useFileSelect.js";

type UseInputHandlerOptions = {
	state: EditorState;
	dispatch: React.Dispatch<EditorAction>;
	history: InputInstance[];
	filteredCommands: SlashCommand[];
	filteredFiles: FileItem[];
	effectiveSuggestion: string | null;
	onSubmit: (value: string) => void;
	onExit?: () => void;
};

/**
 * 键盘输入处理 Hook
 */
export function useInputHandler({
	state,
	dispatch,
	history,
	filteredCommands,
	filteredFiles,
	effectiveSuggestion,
	onSubmit,
	onExit,
}: UseInputHandlerOptions): void {
	const { exit } = useApp();

	// 从 instance 获取输入数据
	const { instance, uiMode } = state;
	const { text: input, cursor, commandPath } = instance;

	// 模式判断
	const inSlashMode = isSlashMode(uiMode);
	const inHistoryMode = isHistoryMode(uiMode);
	const inFileMode = isFileMode(uiMode);
	const inHelpMode = isHelpMode(uiMode);
	const selectedIndex = inSlashMode
		? uiMode.selectedIndex
		: inFileMode
			? uiMode.selectedIndex
			: 0;
	const historyIndex = inHistoryMode ? uiMode.index : -1;

	const handleExit = useCallback(() => {
		if (onExit) {
			onExit();
		} else {
			exit();
		}
	}, [onExit, exit]);

	useInput((inputChar, key) => {
		// Help 模式优先处理
		if (inHelpMode) {
			// 先退出 help 模式
			dispatch({ type: "TOGGLE_HELP" });
			// Escape 只退出，不继续处理
			if (key.escape) {
				return;
			}
			// 其他按键继续处理（不 return，让后续逻辑处理该输入）
		}

		// Ctrl+Enter 插入换行
		if (key.ctrl && key.return) {
			const newInput = input.slice(0, cursor) + "\n" + input.slice(cursor);
			dispatch({ type: "SET_TEXT", text: newInput, cursor: cursor + 1 });
			return;
		}

		// 斜杠命令模式下的特殊处理（统一处理所有层级）
		if (inSlashMode && filteredCommands.length > 0) {
			if (key.upArrow) {
				const newIndex =
					selectedIndex > 0 ? selectedIndex - 1 : filteredCommands.length - 1;
				dispatch({ type: "SELECT_SLASH", index: newIndex });
				return;
			}

			if (key.downArrow) {
				const newIndex =
					selectedIndex < filteredCommands.length - 1 ? selectedIndex + 1 : 0;
				dispatch({ type: "SELECT_SLASH", index: newIndex });
				return;
			}

			if (key.return) {
				// 选中命令
				const selectedCmd = filteredCommands[selectedIndex];
				if (selectedCmd) {
					// 如果命令有子选项，进入下一层级
					if (selectedCmd.children && selectedCmd.children.length > 0) {
						dispatch({ type: "ENTER_SLASH_LEVEL", name: selectedCmd.name });
					} else {
						// 选择最终命令：先更新 instance，再提交
						const fullPath = [...commandPath, selectedCmd.name];
						dispatch({ type: "SELECT_FINAL_COMMAND", name: selectedCmd.name });
						// 使用 buildCommandText 计算提交文本（与 reducer 逻辑一致）
						const cmdText = buildCommandText(fullPath, false);
						onSubmit(cmdText);
					}
				}
				return;
			}

			if (key.escape) {
				// Escape 返回上一层或退出
				dispatch({ type: "EXIT_SLASH_LEVEL" });
				return;
			}
		}

		// 文件选择模式下的特殊处理
		if (inFileMode) {
			const fileSelectedIndex = uiMode.selectedIndex;
			const { filePath } = instance;
			const { prefix } = uiMode;

			// 处理 backspace
			if (key.backspace || key.delete) {
				// 计算完整前缀长度（包括 @ 之前的文本 + 文件路径部分，如 "hello @assets\"）
				const filePathText = buildFileText(filePath, true);
				const fullPrefixLength = prefix.length + filePathText.length;
				// 检查是否有过滤文本（光标位置 > 完整前缀长度）
				const hasFilterText = cursor > fullPrefixLength;

				if (hasFilterText) {
					// 有过滤文本，删除一个字符，保持文件选择模式
					const newInput =
						input.slice(0, cursor - 1) + input.slice(cursor);
					dispatch({
						type: "SET_TEXT",
						text: newInput,
						cursor: cursor - 1,
					});
					return;
				}

				// 没有过滤文本
				if (filePath.length === 0) {
					// 在根级别，退出文件模式但保留前缀
					dispatch({ type: "EXIT_FILE_KEEP_AT" });
					return;
				}
				// 在子目录中，返回上一级
				dispatch({ type: "EXIT_FILE" });
				return;
			}

			// 上下键导航 - 在所有文件中循环（FileMenu 会滚动显示选中项）
			const totalFiles = filteredFiles.length;

			if (key.upArrow) {
				if (totalFiles > 0) {
					const newIndex =
						fileSelectedIndex > 0
							? fileSelectedIndex - 1
							: totalFiles - 1;
					dispatch({ type: "SELECT_FILE", index: newIndex });
				}
				return;
			}

			if (key.downArrow) {
				if (totalFiles > 0) {
					const newIndex =
						fileSelectedIndex < totalFiles - 1
							? fileSelectedIndex + 1
							: 0;
					dispatch({ type: "SELECT_FILE", index: newIndex });
				}
				return;
			}

			if (key.return && filteredFiles.length > 0) {
				const selectedFile = filteredFiles[fileSelectedIndex];
				if (selectedFile) {
					if (selectedFile.name === ".") {
						// 选择当前文件夹（"." 条目）
						dispatch({ type: "CONFIRM_FOLDER" });
					} else if (selectedFile.isDirectory) {
						// 进入子目录
						dispatch({ type: "ENTER_FILE_DIR", dirName: selectedFile.name });
					} else {
						// 确认选择文件
						dispatch({ type: "CONFIRM_FILE", fileName: selectedFile.name });
					}
				}
				return;
			}

			if (key.escape) {
				// Escape 返回上一层或退出文件模式
				dispatch({ type: "EXIT_FILE" });
				return;
			}
		}

		if (key.return) {
			// 回车提交
			onSubmit(input);
			return;
		}

		if (key.tab && effectiveSuggestion) {
			// Tab 确认补全
			const newInput = input + effectiveSuggestion;
			dispatch({ type: "SET_TEXT", text: newInput, cursor: newInput.length });
			dispatch({ type: "SET_SUGGESTION", suggestion: null });
			return;
		}

		if (key.backspace || key.delete) {
			if (cursor > 0) {
				const newInput = input.slice(0, cursor - 1) + input.slice(cursor);
				dispatch({ type: "SET_TEXT", text: newInput, cursor: cursor - 1 });
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
				dispatch({
					type: "SET_TEXT",
					text: newInput,
					cursor: newInput.length,
				});
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
				if (!inHistoryMode) {
					// 第一次按上箭头，保存当前输入实例并切换到最新历史
					const historyEntry = history[history.length - 1]!;
					dispatch({
						type: "ENTER_HISTORY",
						index: history.length - 1,
						entry: historyEntry,
					});
				} else if (historyIndex > 0) {
					// 继续向上浏览
					const newIndex = historyIndex - 1;
					const historyEntry = history[newIndex]!;
					dispatch({
						type: "NAVIGATE_HISTORY",
						index: newIndex,
						entry: historyEntry,
					});
				}
			} else if (key.downArrow) {
				if (!inHistoryMode) {
					// 不在历史浏览模式，忽略
					return;
				}
				if (historyIndex < history.length - 1) {
					// 继续向下浏览
					const newIndex = historyIndex + 1;
					const historyEntry = history[newIndex]!;
					dispatch({
						type: "NAVIGATE_HISTORY",
						index: newIndex,
						entry: historyEntry,
					});
				} else {
					// 回到原始输入
					dispatch({ type: "EXIT_HISTORY" });
				}
			}
			return;
		}

		if (key.ctrl && inputChar === "c") {
			handleExit();
			return;
		}

		if (key.ctrl && inputChar === "u") {
			// Ctrl+U 清除光标前的内容
			const newInput = input.slice(cursor);
			dispatch({ type: "SET_TEXT", text: newInput, cursor: 0 });
			return;
		}

		if (key.ctrl && inputChar === "k") {
			// Ctrl+K 清除光标后的内容
			const newInput = input.slice(0, cursor);
			dispatch({ type: "SET_TEXT", text: newInput, cursor: cursor });
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
				dispatch({ type: "EXIT_SLASH_LEVEL" });
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

			// 输入 @ 时进入文件选择模式（不在斜杠模式或文件模式时）
			if (inputChar === "@" && !inSlashMode && !inFileMode) {
				// 进入文件选择模式，保留 @ 之前的文本作为前缀
				const prefix = input.slice(0, cursor);
				dispatch({
					type: "ENTER_FILE",
					atPosition: cursor,
					prefix,
				});
				return;
			}

			// 插入字符
			const newInput = input.slice(0, cursor) + inputChar + input.slice(cursor);
			dispatch({
				type: "SET_TEXT",
				text: newInput,
				cursor: cursor + inputChar.length,
			});
		}
	});
}
