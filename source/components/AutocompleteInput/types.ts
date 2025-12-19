/**
 * AutocompleteInput 类型定义
 */

import type { UserInput } from "../../models/input.js";
import type {
	InputInstance,
	HistoryEntry,
	SelectedFile,
} from "../../models/inputInstance.js";

// 重新导出 UserInput 相关类型
export type { UserInput };
export { isMessageInput, isCommandInput } from "../../models/input.js";

// 重新导出 InputInstance 相关类型
export type {
	InputInstance,
	HistoryEntry,
	SelectedFile,
} from "../../models/inputInstance.js";
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
	buildFileText,
	buildFileSegments,
	toHistoryEntry,
	fromHistoryEntry,
	toUserInput,
	updateSelectedFilesPositions,
	rebuildSegmentsWithFiles,
	findSelectedFileAtCursor,
	findSelectedFileEndingAt,
	findSelectedFileStartingAt,
	removeSelectedFile,
} from "../../models/inputInstance.js";

/**
 * 命令动作类型
 * - internal: 内部命令，由应用处理（如 /version, /clear）
 * - prompt: 转换成 prompt 发给 AI（如 /compact）
 * - config: 配置类命令（如 /model）
 */
export type CommandAction =
	| { type: "internal"; handler?: string }
	| { type: "prompt"; template: string }
	| { type: "config"; key: string };

/**
 * 斜杠命令类型（支持递归嵌套）
 */
export type SlashCommand = {
	name: string;
	description?: string;
	children?: SlashCommand[];
	/** 命令动作，叶子节点需要指定，分支节点可省略 */
	action?: CommandAction;
};

/**
 * UI 模式 - 仅影响 UI 行为，不存入历史
 * - normal: 普通输入模式（带自动补全）
 * - history: 历史浏览模式（上下键浏览历史记录，savedEntry 不含 cursor）
 * - slash: 斜杠命令选择模式（选择索引存在这里）
 * - file: 文件选择模式（@ 触发，路径存储在 instance.filePath，prefix 保存 @ 之前的文本，suffix 保存 @ 之后的文本）
 * - help: 快捷键帮助模式
 */
export type UIMode =
	| { type: "normal" }
	| { type: "history"; index: number; savedEntry: HistoryEntry }
	| { type: "slash"; selectedIndex: number }
	| {
			type: "file";
			selectedIndex: number;
			atPosition: number;
			prefix: string;
			suffix: string;
	  }
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
	| { type: "ENTER_HISTORY"; index: number; entry: HistoryEntry }
	| { type: "NAVIGATE_HISTORY"; index: number; entry: HistoryEntry }
	| { type: "EXIT_HISTORY" }
	// 斜杠命令操作
	| { type: "ENTER_SLASH" }
	| { type: "SELECT_SLASH"; index: number }
	| { type: "ENTER_SLASH_LEVEL"; name: string }
	| { type: "SELECT_FINAL_COMMAND"; name: string } // 选择最终命令（无子命令）
	| { type: "EXIT_SLASH_LEVEL" }
	// 文件选择操作
	| { type: "ENTER_FILE"; atPosition: number; prefix: string; suffix: string }
	| { type: "SELECT_FILE"; index: number }
	| { type: "ENTER_FILE_DIR"; dirName: string }
	| { type: "CONFIRM_FILE"; fileName: string }
	| { type: "CONFIRM_FOLDER" } // 选择当前文件夹（"." 条目）
	| { type: "EXIT_FILE" }
	| { type: "EXIT_FILE_KEEP_AT" } // 退出文件模式但保留 @ 符号
	| { type: "REMOVE_SELECTED_FILE"; file: SelectedFile } // 删除已选择的文件（整体删除）
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
	/** 是否激活键盘输入（默认 true）*/
	isActive?: boolean;
};

// ============================================================================
// 模式判断 Helper 函数
// ============================================================================

export const isNormalMode = (mode: UIMode): mode is { type: "normal" } =>
	mode.type === "normal";

export const isHistoryMode = (
	mode: UIMode,
): mode is { type: "history"; index: number; savedEntry: HistoryEntry } =>
	mode.type === "history";

export const isSlashMode = (
	mode: UIMode,
): mode is { type: "slash"; selectedIndex: number } => mode.type === "slash";

export const isFileMode = (
	mode: UIMode,
): mode is {
	type: "file";
	selectedIndex: number;
	atPosition: number;
	prefix: string;
	suffix: string;
} => mode.type === "file";

export const isHelpMode = (mode: UIMode): mode is { type: "help" } =>
	mode.type === "help";
