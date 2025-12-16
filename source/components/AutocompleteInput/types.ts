/**
 * AutocompleteInput 类型定义
 */

import type { UserInput } from "../../models/input.js";
import type { InputInstance } from "../../models/inputInstance.js";

// 重新导出 UserInput 相关类型
export type { UserInput };
export { isMessageInput, isCommandInput } from "../../models/input.js";

// 重新导出 InputInstance 相关类型
export type { InputInstance };
export {
	createEmptyInstance,
	createMessageInstance,
	createCommandInstance,
	updateInstanceFromText,
	updateInstanceCursor,
	enterCommandLevel,
	exitCommandLevel,
	buildCommandText,
	buildCommandSegments,
} from "../../models/inputInstance.js";

/**
 * 斜杠命令类型（支持递归嵌套）
 */
export type SlashCommand = {
	name: string;
	description?: string;
	children?: SlashCommand[];
};

/**
 * UI 模式 - 仅影响 UI 行为，不存入历史
 * - normal: 普通输入模式（带自动补全）
 * - history: 历史浏览模式（上下键浏览历史记录）
 * - slash: 斜杠命令选择模式（选择索引存在这里）
 * - help: 快捷键帮助模式
 */
export type UIMode =
	| { type: "normal" }
	| { type: "history"; index: number; savedInstance: InputInstance }
	| { type: "slash"; selectedIndex: number }
	| { type: "help" };

/**
 * 编辑器状态（取代原 InputState）
 */
export type EditorState = {
	/** 当前输入实例 */
	instance: InputInstance;

	/** UI 模式 */
	uiMode: UIMode;

	/** 自动补全建议 */
	suggestion: string | null;
};

/**
 * Reducer Action 类型
 */
export type EditorAction =
	// 输入操作
	| { type: "SET_TEXT"; text: string; cursor: number }
	| { type: "SET_CURSOR"; cursor: number }
	| { type: "SET_SUGGESTION"; suggestion: string | null }
	// 历史操作
	| { type: "ENTER_HISTORY"; index: number; entry: InputInstance }
	| { type: "NAVIGATE_HISTORY"; index: number; entry: InputInstance }
	| { type: "EXIT_HISTORY" }
	// 斜杠命令操作
	| { type: "ENTER_SLASH" }
	| { type: "SELECT_SLASH"; index: number }
	| { type: "ENTER_SLASH_LEVEL"; name: string }
	| { type: "SELECT_FINAL_COMMAND"; name: string } // 选择最终命令（无子命令）
	| { type: "EXIT_SLASH_LEVEL" }
	// 其他
	| { type: "TOGGLE_HELP" }
	| { type: "RESET" };

/**
 * AutocompleteInput 组件 Props
 */
export type AutocompleteInputProps = {
	prompt?: string;
	/** 用户输入提交回调，提供结构化的输入信息 */
	onSubmit?: (input: UserInput) => void;
	onClear?: () => void;
	onExit?: () => void;
	slashCommands?: SlashCommand[];
};

// ============================================================================
// 模式判断 Helper 函数
// ============================================================================

export const isNormalMode = (mode: UIMode): mode is { type: "normal" } =>
	mode.type === "normal";

export const isHistoryMode = (
	mode: UIMode,
): mode is { type: "history"; index: number; savedInstance: InputInstance } =>
	mode.type === "history";

export const isSlashMode = (
	mode: UIMode,
): mode is { type: "slash"; selectedIndex: number } => mode.type === "slash";

export const isHelpMode = (mode: UIMode): mode is { type: "help" } =>
	mode.type === "help";
