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
	HistoryEntry,
} from "../types.js";
import {
	isSlashMode,
	isHistoryMode,
	isFileMode,
	isHelpMode,
	buildFileText,
	createCommandInstance,
	findSelectedFileAtCursor,
	findSelectedFileEndingAt,
	findSelectedFileStartingAt,
} from "../types.js";
import type { FileItem } from "./useFileSelect.js";
import {
	getPrevGraphemeBoundary,
	getNextGraphemeBoundary,
	splitGraphemes,
} from "../utils/grapheme.js";

type UseInputHandlerOptions = {
	state: EditorState;
	dispatch: React.Dispatch<EditorAction>;
	history: HistoryEntry[];
	filteredCommands: SlashCommand[];
	filteredFiles: FileItem[];
	effectiveSuggestion: string | null;
	onSubmit: (instance: InputInstance) => void;
	onExit?: () => void;
	/** 是否激活键盘输入（默认 true）*/
	isActive?: boolean;
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
	isActive = true,
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

	useInput(
		(inputChar, key) => {
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
							// 选择最终命令并提交
							// 注意：这里先 dispatch 更新状态（用于显示），然后创建相同的 instance 提交
							// 提交后 handleSubmit 会 RESET 状态，所以两者创建的 instance 必须一致
							const fullPath = [...commandPath, selectedCmd.name];
							dispatch({
								type: "SELECT_FINAL_COMMAND",
								name: selectedCmd.name,
							});
							// 使用相同参数创建 instance 确保与 reducer 一致
							const cmdInstance = createCommandInstance(fullPath, false);
							onSubmit(cmdInstance);
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

				// 处理 backspace（使用相同的检测逻辑）
				if (key.backspace || key.delete) {
					// Windows 上 backspace 可能触发 key.delete，通过检查 inputChar 区分
					const isBackspace =
						key.backspace ||
						(key.delete &&
							(inputChar === "" || inputChar === "\b" || inputChar === "\x7f"));

					// 只处理退格，不处理 delete 键
					if (!isBackspace) {
						return;
					}

					// 计算完整前缀长度（包括 @ 之前的文本 + 文件路径部分，如 "hello @assets\"）
					const filePathText = buildFileText(filePath, true);
					const fullPrefixLength = prefix.length + filePathText.length;
					// 检查是否有过滤文本（光标位置 > 完整前缀长度）
					const hasFilterText = cursor > fullPrefixLength;

					if (hasFilterText) {
						// 有过滤文本，删除一个字形簇（grapheme cluster），保持文件选择模式
						const prevBoundary = getPrevGraphemeBoundary(input, cursor);
						const newInput = input.slice(0, prevBoundary) + input.slice(cursor);
						dispatch({
							type: "SET_TEXT",
							text: newInput,
							cursor: prevBoundary,
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
							fileSelectedIndex > 0 ? fileSelectedIndex - 1 : totalFiles - 1;
						dispatch({ type: "SELECT_FILE", index: newIndex });
					}
					return;
				}

				if (key.downArrow) {
					if (totalFiles > 0) {
						const newIndex =
							fileSelectedIndex < totalFiles - 1 ? fileSelectedIndex + 1 : 0;
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
				// 回车提交（传递完整的 InputInstance）
				onSubmit(instance);
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
				const { selectedFiles } = instance;
				// Windows 上 backspace 可能触发 key.delete，通过检查 inputChar 区分
				// Backspace: inputChar 是 '\b' (ASCII 8) 或 '\x7f' (ASCII 127) 或空字符串
				// Delete: inputChar 通常是转义序列或特定字符
				const isBackspace =
					key.backspace ||
					(key.delete &&
						(inputChar === "" || inputChar === "\b" || inputChar === "\x7f"));
				const isDelete = key.delete && !isBackspace;

				if (isBackspace && cursor > 0) {
					// 检查光标是否在某个已选择文件的末尾
					const fileAtEnd = findSelectedFileEndingAt(
						cursor,
						selectedFiles,
						input,
					);
					if (fileAtEnd) {
						// 整体删除该文件
						dispatch({ type: "REMOVE_SELECTED_FILE", file: fileAtEnd });
						return;
					}
					// 检查光标是否在某个已选择文件的内部（不应该发生，但防御性处理）
					const fileAtCursor = findSelectedFileAtCursor(
						cursor,
						selectedFiles,
						input,
					);
					if (fileAtCursor) {
						// 整体删除该文件
						dispatch({ type: "REMOVE_SELECTED_FILE", file: fileAtCursor });
						return;
					}
					// 普通退格 - 删除一个字形簇（grapheme cluster）
					const prevBoundary = getPrevGraphemeBoundary(input, cursor);
					const newInput = input.slice(0, prevBoundary) + input.slice(cursor);
					dispatch({ type: "SET_TEXT", text: newInput, cursor: prevBoundary });
					return;
				}

				if (isDelete && cursor < input.length) {
					// 检查光标是否在某个已选择文件的开头
					const fileAtStart = findSelectedFileStartingAt(
						cursor,
						selectedFiles,
						input,
					);
					if (fileAtStart) {
						// 整体删除该文件
						dispatch({ type: "REMOVE_SELECTED_FILE", file: fileAtStart });
						return;
					}
					// 检查光标后一位是否在文件内部
					const nextBoundary = getNextGraphemeBoundary(input, cursor);
					const fileAtNext = findSelectedFileAtCursor(
						nextBoundary,
						selectedFiles,
						input,
					);
					if (fileAtNext) {
						// 整体删除该文件
						dispatch({ type: "REMOVE_SELECTED_FILE", file: fileAtNext });
						return;
					}
					// 普通删除 - 删除一个字形簇（grapheme cluster）
					const newInput = input.slice(0, cursor) + input.slice(nextBoundary);
					dispatch({ type: "SET_TEXT", text: newInput, cursor });
					return;
				}
				return;
			}

			if (key.leftArrow) {
				if (cursor > 0) {
					const { selectedFiles } = instance;
					// 按字形簇（grapheme cluster）移动光标
					let newCursor = getPrevGraphemeBoundary(input, cursor);
					// 检查新光标位置是否在某个文件区域内，如果是则跳到文件开头
					const fileAtNewCursor = findSelectedFileAtCursor(
						newCursor,
						selectedFiles,
						input,
					);
					if (fileAtNewCursor) {
						newCursor = fileAtNewCursor.atPosition;
					}
					dispatch({ type: "SET_CURSOR", cursor: newCursor });
				}
				return;
			}

			if (key.rightArrow) {
				if (effectiveSuggestion && cursor === input.length) {
					// 如果光标在末尾且有建议，向右移动接受一个字形簇
					const firstGrapheme = splitGraphemes(effectiveSuggestion)[0] || "";
					const newInput = input + firstGrapheme;
					const remaining =
						effectiveSuggestion.slice(firstGrapheme.length) || null;
					dispatch({
						type: "SET_TEXT",
						text: newInput,
						cursor: newInput.length,
					});
					if (!inSlashMode) {
						dispatch({ type: "SET_SUGGESTION", suggestion: remaining });
					}
				} else if (cursor < input.length) {
					const { selectedFiles } = instance;
					// 按字形簇（grapheme cluster）移动光标
					let newCursor = getNextGraphemeBoundary(input, cursor);
					// 检查新光标位置是否在某个文件区域内，如果是则跳到文件末尾
					const fileAtNewCursor = findSelectedFileAtCursor(
						newCursor,
						selectedFiles,
						input,
					);
					if (fileAtNewCursor) {
						newCursor = fileAtNewCursor.endPosition;
					}
					dispatch({ type: "SET_CURSOR", cursor: newCursor });
				}
				return;
			}

			// 非斜杠模式下的历史导航
			// 忽略 Shift+↑/↓（用于全局模式切换）
			if (!inSlashMode && (key.upArrow || key.downArrow) && !key.shift) {
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
					// 进入文件选择模式，保留 @ 之前的文本作为前缀，之后的文本作为后缀
					const prefix = input.slice(0, cursor);
					const suffix = input.slice(cursor);
					dispatch({
						type: "ENTER_FILE",
						atPosition: cursor,
						prefix,
						suffix,
					});
					return;
				}

				// 处理粘贴的文本：将 \r\n 和 \r 统一转换为 \n
				// 终端粘贴时可能使用 \r（Windows 风格）作为换行符
				let normalizedInput = inputChar;
				if (inputChar.includes("\r")) {
					normalizedInput = inputChar
						.replace(/\r\n/g, "\n")
						.replace(/\r/g, "\n");
				}

				// 插入字符
				const newInput =
					input.slice(0, cursor) + normalizedInput + input.slice(cursor);
				dispatch({
					type: "SET_TEXT",
					text: newInput,
					// 使用 normalizedInput 计算新光标位置
					cursor: cursor + normalizedInput.length,
				});
			}
		},
		{ isActive },
	);
}
