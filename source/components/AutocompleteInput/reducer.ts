/**
 * AutocompleteInput 状态机 Reducer
 * 基于 InputInstance 的数据驱动状态管理
 */

import {
	type EditorState,
	type EditorAction,
	type UIMode,
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isFileMode,
	isHelpMode,
	createEmptyInstance,
	updateInstanceFromText,
	updateInstanceCursor,
	enterCommandLevel,
	exitCommandLevel,
	createCommandInstance,
} from "./types.js";
import { join, dirname } from "path";

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

			// 在历史模式下输入，退出历史模式
			if (isHistoryMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, []);
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
				const newInstance = updateInstanceFromText(text, cursor, []);
				return {
					...state,
					instance: newInstance,
					suggestion: null,
					uiMode: { type: "slash", selectedIndex: 0 },
				};
			}

			// 从 slash 删除 /，回到普通模式
			if (!isSlash && wasSlash && isSlashMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, []);
				return {
					...state,
					instance: newInstance,
					uiMode: { type: "normal" },
				};
			}

			// 普通文本更新
			const newInstance = updateInstanceFromText(text, cursor, currentPath);
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

		case "ENTER_FILE":
			return {
				...state,
				suggestion: null,
				uiMode: {
					type: "file",
					selectedIndex: 0,
					basePath: action.basePath,
					atPosition: action.atPosition,
				},
			};

		case "SELECT_FILE":
			if (!isFileMode(state.uiMode)) return state;
			return {
				...state,
				uiMode: { ...state.uiMode, selectedIndex: action.index },
			};

		case "ENTER_FILE_DIR": {
			if (!isFileMode(state.uiMode)) return state;
			const newBasePath = state.uiMode.basePath
				? join(state.uiMode.basePath, action.dirName)
				: action.dirName;
			return {
				...state,
				uiMode: {
					...state.uiMode,
					selectedIndex: 0,
					basePath: newBasePath,
				},
			};
		}

		case "CONFIRM_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			// 构建完整文件路径
			const filePath = state.uiMode.basePath
				? join(state.uiMode.basePath, action.fileName)
				: action.fileName;
			// 将文件路径插入到 @ 位置
			const { atPosition } = state.uiMode;
			const beforeAt = state.instance.text.slice(0, atPosition);
			const afterAt = state.instance.text.slice(atPosition + 1); // +1 跳过 @
			// 查找 @ 后的过滤文本结束位置（空格或末尾）
			const filterEndMatch = afterAt.match(/^[^\s]*/);
			const filterLength = filterEndMatch ? filterEndMatch[0].length : 0;
			const afterFilter = afterAt.slice(filterLength);
			const newText = beforeAt + filePath + afterFilter;
			const newCursor = beforeAt.length + filePath.length;
			const newInstance = updateInstanceFromText(newText, newCursor, []);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "EXIT_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			// 如果有父目录，返回上一级；否则退出文件模式
			const { basePath, atPosition } = state.uiMode;
			if (basePath && basePath !== ".") {
				const parentPath = dirname(basePath);
				return {
					...state,
					uiMode: {
						...state.uiMode,
						selectedIndex: 0,
						basePath: parentPath === "." ? "" : parentPath,
					},
				};
			}
			// 退出文件模式，移除 @ 符号
			const beforeAt = state.instance.text.slice(0, atPosition);
			const afterAt = state.instance.text.slice(atPosition + 1);
			const newText = beforeAt + afterAt;
			const newInstance = updateInstanceFromText(newText, atPosition, []);
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
