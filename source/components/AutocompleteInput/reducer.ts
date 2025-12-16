/**
 * AutocompleteInput 状态机 Reducer
 */

import {
	type InputState,
	type InputAction,
	type InputMode,
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isHelpMode,
} from "./types.js";

/**
 * 初始状态
 */
export const initialState: InputState = {
	input: "",
	cursor: 0,
	suggestion: null,
	mode: { type: "normal" },
};

/**
 * 根据 path 生成输入框文本
 * 使用 " → " 分隔符表达层级关系
 */
export function buildInputFromPath(path: string[]): string {
	if (path.length === 0) return "/";
	return "/" + path.join(" → ") + " → ";
}

/**
 * 输入状态 Reducer
 */
export function inputReducer(
	state: InputState,
	action: InputAction,
): InputState {
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
					mode: { type: "slash", path: [], selectedIndex: 0 },
				};
			}

			// 从 slash 删除 /，回到普通模式
			if (!isSlash && wasSlash && isSlashMode(state.mode)) {
				return {
					...state,
					input: action.input,
					cursor: action.cursor,
					mode: { type: "normal" },
				};
			}

			// 在历史模式下输入，退出历史模式
			if (isHistoryMode(state.mode)) {
				const newMode: InputMode = isSlash
					? { type: "slash", path: [], selectedIndex: 0 }
					: { type: "normal" };
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

		case "SELECT_SLASH":
			if (!isSlashMode(state.mode)) return state;
			return {
				...state,
				mode: { ...state.mode, selectedIndex: action.index },
			};

		case "ENTER_SLASH_LEVEL": {
			if (!isSlashMode(state.mode)) return state;
			const newPath = [...state.mode.path, action.name];
			const newInput = buildInputFromPath(newPath);
			return {
				...state,
				input: newInput,
				cursor: newInput.length,
				mode: { type: "slash", path: newPath, selectedIndex: 0 },
			};
		}

		case "EXIT_SLASH_LEVEL": {
			if (!isSlashMode(state.mode)) return state;
			if (state.mode.path.length === 0) {
				// 已经在根级，退出 slash 模式
				return {
					...state,
					input: "",
					cursor: 0,
					mode: { type: "normal" },
				};
			}
			// 返回上一级
			const newPath = state.mode.path.slice(0, -1);
			const newInput = buildInputFromPath(newPath);
			return {
				...state,
				input: newInput,
				cursor: newInput.length,
				mode: { type: "slash", path: newPath, selectedIndex: 0 },
			};
		}

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
