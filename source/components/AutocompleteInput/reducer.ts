/**
 * AutocompleteInput 状态机 Reducer
 * 基于 InputInstance 的数据驱动状态管理
 */

import {
	type EditorState,
	type EditorAction,
	type UIMode,
	type InputInstance,
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isFileMode,
	isHelpMode,
	createEmptyInstance,
	createFileInstance,
	updateInstanceFromText,
	updateInstanceCursor,
	enterCommandLevel,
	exitCommandLevel,
	enterFileLevel,
	exitFileLevel,
	createCommandInstance,
	buildFileText,
	buildFileSegments,
} from "./types.js";

/**
 * 初始状态
 */
export const initialState: EditorState = {
	instance: createEmptyInstance(),
	uiMode: { type: "normal" },
	suggestion: null,
};

/**
 * 编辑器状态 Reducer
 */
export function editorReducer(
	state: EditorState,
	action: EditorAction,
): EditorState {
	switch (action.type) {
		// ====================================================================
		// 输入操作
		// ====================================================================

		case "SET_TEXT": {
			const { text, cursor } = action;
			const isSlash = text.startsWith("/");
			const wasSlash = state.instance.text.startsWith("/");
			const currentPath = state.instance.commandPath;
			const currentFilePath = state.instance.filePath;

			// 在历史模式下输入，退出历史模式
			if (isHistoryMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				const newMode: UIMode = isSlash
					? { type: "slash", selectedIndex: 0 }
					: { type: "normal" };
				return {
					...state,
					instance: newInstance,
					uiMode: newMode,
				};
			}

			// 从普通模式输入 /，进入 slash 模式
			if (isSlash && !wasSlash && isNormalMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				return {
					...state,
					instance: newInstance,
					suggestion: null,
					uiMode: { type: "slash", selectedIndex: 0 },
				};
			}

			// 从 slash 删除 /，回到普通模式
			if (!isSlash && wasSlash && isSlashMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				return {
					...state,
					instance: newInstance,
					uiMode: { type: "normal" },
				};
			}

			// 文件模式下更新，保持文件路径
			if (isFileMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(
					text,
					cursor,
					[],
					currentFilePath,
				);
				return {
					...state,
					instance: newInstance,
				};
			}

			// 普通文本更新
			const newInstance = updateInstanceFromText(
				text,
				cursor,
				currentPath,
				[],
			);
			return {
				...state,
				instance: newInstance,
			};
		}

		case "SET_CURSOR": {
			const newInstance = updateInstanceCursor(state.instance, action.cursor);
			return { ...state, instance: newInstance };
		}

		case "SET_SUGGESTION":
			return { ...state, suggestion: action.suggestion };

		// ====================================================================
		// 历史操作
		// ====================================================================

		case "ENTER_HISTORY":
			return {
				...state,
				instance: action.entry,
				suggestion: null,
				uiMode: {
					type: "history",
					index: action.index,
					savedInstance: state.instance,
				},
			};

		case "NAVIGATE_HISTORY":
			if (!isHistoryMode(state.uiMode)) return state;
			return {
				...state,
				instance: action.entry,
				uiMode: { ...state.uiMode, index: action.index },
			};

		case "EXIT_HISTORY":
			if (!isHistoryMode(state.uiMode)) return state;
			return {
				...state,
				instance: state.uiMode.savedInstance,
				uiMode: { type: "normal" },
			};

		// ====================================================================
		// 斜杠命令操作
		// ====================================================================

		case "ENTER_SLASH": {
			// 手动进入 slash 模式（通常由 SET_TEXT 自动处理）
			const newInstance = createCommandInstance([], true);
			return {
				...state,
				instance: newInstance,
				suggestion: null,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		case "SELECT_SLASH":
			if (!isSlashMode(state.uiMode)) return state;
			return {
				...state,
				uiMode: { ...state.uiMode, selectedIndex: action.index },
			};

		case "ENTER_SLASH_LEVEL": {
			if (!isSlashMode(state.uiMode)) return state;
			const newInstance = enterCommandLevel(state.instance, action.name);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		case "SELECT_FINAL_COMMAND": {
			// 选择最终命令（无子命令），更新 instance 为完整路径（不带尾部箭头）
			if (!isSlashMode(state.uiMode)) return state;
			const finalPath = [...state.instance.commandPath, action.name];
			const finalInstance = createCommandInstance(finalPath, false);
			return {
				...state,
				instance: finalInstance,
				// 保持 slash 模式，提交后会 RESET
			};
		}

		case "EXIT_SLASH_LEVEL": {
			if (!isSlashMode(state.uiMode)) return state;

			if (state.instance.commandPath.length === 0) {
				// 已经在根级，退出 slash 模式
				return {
					...state,
					instance: createEmptyInstance(),
					uiMode: { type: "normal" },
				};
			}

			// 返回上一级
			const newInstance = exitCommandLevel(state.instance);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		// ====================================================================
		// 其他操作
		// ====================================================================

		case "TOGGLE_HELP":
			if (isHelpMode(state.uiMode)) {
				return { ...state, uiMode: { type: "normal" } };
			}
			return { ...state, uiMode: { type: "help" } };

		// ====================================================================
		// 文件选择操作
		// ====================================================================

		case "ENTER_FILE": {
			// 创建文件选择模式实例，保留 @ 之前的前缀
			const { prefix } = action;
			const filePathText = buildFileText([], true); // "@"
			const newText = prefix + filePathText;
			const fileSegments = buildFileSegments([], true);
			const newSegments = prefix ? [{ text: prefix }, ...fileSegments] : fileSegments;
			const newInstance: InputInstance = {
				text: newText,
				cursor: newText.length,
				type: "message",
				segments: newSegments,
				commandPath: [],
				filePath: [],
			};
			return {
				...state,
				instance: newInstance,
				suggestion: null,
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: action.atPosition,
					prefix: action.prefix,
				},
			};
		}

		case "SELECT_FILE":
			if (!isFileMode(state.uiMode)) return state;
			return {
				...state,
				uiMode: { ...state.uiMode, selectedIndex: action.index },
			};

		case "ENTER_FILE_DIR": {
			if (!isFileMode(state.uiMode)) return state;
			// 进入子目录，保留前缀
			const { prefix } = state.uiMode;
			const newPath = [...state.instance.filePath, action.dirName];
			const filePathText = buildFileText(newPath, true);
			const newText = prefix + filePathText;
			const fileSegments = buildFileSegments(newPath, true);
			const newSegments = prefix ? [{ text: prefix }, ...fileSegments] : fileSegments;
			const newInstance: InputInstance = {
				text: newText,
				cursor: newText.length,
				type: "message",
				segments: newSegments,
				commandPath: [],
				filePath: newPath,
			};
			return {
				...state,
				instance: newInstance,
				uiMode: {
					...state.uiMode,
					selectedIndex: 0,
				},
			};
		}

		case "CONFIRM_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			// 构建完整文件路径，保留前缀
			const { prefix } = state.uiMode;
			const finalPath = [...state.instance.filePath, action.fileName];
			const filePath = finalPath.join("\\");
			// 最终文本：前缀 + 文件路径（不带 @，因为这是最终选择的文件）
			const newText = prefix + filePath;
			const newCursor = newText.length;
			const newInstance = updateInstanceFromText(newText, newCursor, [], []);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "CONFIRM_FOLDER": {
			// 选择当前文件夹（"." 条目）
			if (!isFileMode(state.uiMode)) return state;
			const { prefix } = state.uiMode;
			// 使用当前 filePath，不追加任何文件名
			const folderPath = state.instance.filePath.join("\\");
			// 最终文本：前缀 + 文件夹路径
			const newText = prefix + folderPath;
			const newCursor = newText.length;
			const newInstance = updateInstanceFromText(newText, newCursor, [], []);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "EXIT_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			const { prefix } = state.uiMode;
			const filePath = state.instance.filePath;
			if (filePath.length > 0) {
				// 有父目录，返回上一级，保留前缀
				const newPath = filePath.slice(0, -1);
				const filePathText = buildFileText(newPath, true);
				const newText = prefix + filePathText;
				const fileSegments = buildFileSegments(newPath, true);
				const newSegments = prefix ? [{ text: prefix }, ...fileSegments] : fileSegments;
				const newInstance: InputInstance = {
					text: newText,
					cursor: newText.length,
					type: "message",
					segments: newSegments,
					commandPath: [],
					filePath: newPath,
				};
				return {
					...state,
					instance: newInstance,
					uiMode: {
						...state.uiMode,
						selectedIndex: 0,
					},
				};
			}
			// 在根级，退出文件模式，恢复前缀（如果有的话）
			const newInstance = prefix
				? updateInstanceFromText(prefix, prefix.length, [], [])
				: createEmptyInstance();
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "EXIT_FILE_KEEP_AT": {
			// 退出文件模式但保留当前文本（包括 @path/）
			if (!isFileMode(state.uiMode)) return state;
			// 将当前路径文本转换为普通消息
			const currentText = state.instance.text;
			const newInstance = updateInstanceFromText(
				currentText,
				currentText.length,
				[],
				[],
			);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "RESET":
			return initialState;

		default:
			return state;
	}
}

// 为了向后兼容，导出别名
export const inputReducer = editorReducer;
