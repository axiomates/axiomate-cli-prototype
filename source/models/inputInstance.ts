/**
 * 输入实例模型
 * 用户输入的完整数据结构，包含渲染和语义信息
 */

import type { ColoredSegment } from "./richInput.js";
import { PATH_COLOR, ARROW_COLOR, FILE_AT_COLOR } from "../constants/colors.js";
import type { UserInput, MessageInput, CommandInput } from "./input.js";

/**
 * 输入类型
 */
export type InputType = "message" | "command";

/**
 * 已选择的文件引用
 * 跟踪每个通过 @ 选择的文件的位置信息
 */
export type SelectedFile = {
	/** 完整文件路径（如 "assets/icon.ico"） */
	path: string;

	/** 是否目录 */
	isDirectory: boolean;

	/** @ 符号在文本中的位置（0-based） */
	atPosition: number;

	/** 文件路径结束位置（不含，用于识别编辑区域） */
	endPosition: number;
};

/**
 * 输入实例 - 用户输入的完整数据
 * 这是整个输入系统的核心数据结构
 */
export type InputInstance = {
	/** 纯文本内容（用户实际输入的字符） */
	text: string;

	/** 光标位置（0-based，相对于 text） */
	cursor: number;

	/** 输入类型 */
	type: InputType;

	/** 渲染分段（带颜色） */
	segments: ColoredSegment[];

	/** 命令路径（仅 type='command' 时有意义） */
	commandPath: string[];

	/** 文件路径（文件选择模式下的导航路径） */
	filePath: string[];

	/** 已选择的文件列表（通过 @ 选择的文件） */
	selectedFiles: SelectedFile[];
};

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建空输入实例
 */
export function createEmptyInstance(): InputInstance {
	return {
		text: "",
		cursor: 0,
		type: "message",
		segments: [],
		commandPath: [],
		filePath: [],
		selectedFiles: [],
	};
}

/**
 * 创建消息类型输入实例
 */
export function createMessageInstance(
	text: string,
	cursor?: number,
): InputInstance {
	return {
		text,
		cursor: cursor ?? text.length,
		type: "message",
		segments: text ? [{ text }] : [],
		commandPath: [],
		filePath: [],
		selectedFiles: [],
	};
}

/**
 * 创建命令类型输入实例
 * @param path 命令路径，如 ["model", "openai"]
 * @param trailing 是否包含尾部箭头（表示还未完成选择）
 */
export function createCommandInstance(
	path: string[],
	trailing: boolean = true,
): InputInstance {
	const text = buildCommandText(path, trailing);
	return {
		text,
		cursor: text.length,
		type: "command",
		segments: buildCommandSegments(path, trailing),
		commandPath: path,
		filePath: [],
		selectedFiles: [],
	};
}

// ============================================================================
// 更新函数
// ============================================================================

/**
 * 从文本更新输入实例（智能判断类型）
 * @param text 新的文本内容
 * @param cursor 光标位置
 * @param currentPath 当前命令路径（用于命令模式）
 * @param currentFilePath 当前文件路径（用于文件选择模式）
 */
export function updateInstanceFromText(
	text: string,
	cursor: number,
	currentPath: string[] = [],
	currentFilePath: string[] = [],
): InputInstance {
	if (text.startsWith("/")) {
		// 命令模式：保持现有路径，segments 基于路径生成
		return {
			text,
			cursor,
			type: "command",
			segments: buildCommandSegments(currentPath, false),
			commandPath: currentPath,
			filePath: [],
			selectedFiles: [],
		};
	}
	// 文件选择模式：保持现有文件路径，segments 基于路径生成
	if (currentFilePath.length > 0) {
		return {
			text,
			cursor,
			type: "message",
			segments: buildFileSegments(currentFilePath, true),
			commandPath: [],
			filePath: currentFilePath,
			selectedFiles: [],
		};
	}
	// 消息模式
	return {
		text,
		cursor,
		type: "message",
		segments: text ? [{ text }] : [],
		commandPath: [],
		filePath: [],
		selectedFiles: [],
	};
}

/**
 * 更新实例的光标位置
 */
export function updateInstanceCursor(
	instance: InputInstance,
	cursor: number,
): InputInstance {
	return { ...instance, cursor };
}

/**
 * 进入下一级命令
 */
export function enterCommandLevel(
	instance: InputInstance,
	name: string,
): InputInstance {
	const newPath = [...instance.commandPath, name];
	const text = buildCommandText(newPath, true);
	return {
		text,
		cursor: text.length,
		type: "command",
		segments: buildCommandSegments(newPath, true),
		commandPath: newPath,
		filePath: [],
		selectedFiles: [],
	};
}

/**
 * 退出当前命令级别
 */
export function exitCommandLevel(instance: InputInstance): InputInstance {
	if (instance.commandPath.length === 0) {
		// 已经在根级，退出命令模式
		return createEmptyInstance();
	}
	const newPath = instance.commandPath.slice(0, -1);
	const text = buildCommandText(newPath, true);
	return {
		text,
		cursor: text.length,
		type: "command",
		segments: buildCommandSegments(newPath, true),
		commandPath: newPath,
		filePath: [],
		selectedFiles: [],
	};
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据路径构建命令文本
 */
export function buildCommandText(path: string[], trailing: boolean): string {
	if (path.length === 0) {
		return trailing ? "/" : "/";
	}
	const base = "/" + path.join(" → ");
	return trailing ? base + " → " : base;
}

/**
 * 根据路径构建带颜色的分段
 */
export function buildCommandSegments(
	path: string[],
	trailing: boolean,
): ColoredSegment[] {
	// 空路径且不需要尾部箭头，返回空 segments
	if (path.length === 0 && !trailing) {
		return [];
	}

	// 空路径但需要尾部箭头（刚输入 /）
	if (path.length === 0) {
		return [{ text: "/", color: PATH_COLOR }];
	}

	const segments: ColoredSegment[] = [{ text: "/", color: PATH_COLOR }];

	for (let i = 0; i < path.length; i++) {
		segments.push({ text: path[i]!, color: PATH_COLOR });
		// 中间的箭头，或者尾部箭头（如果 trailing=true）
		if (i < path.length - 1 || trailing) {
			segments.push({ text: " → ", color: ARROW_COLOR });
		}
	}

	return segments;
}

/**
 * 根据文件路径构建文本
 * @param path 文件路径数组，如 ["src", "components"]
 * @param trailing 是否包含尾部反斜杠
 * @returns 文本，如 "@src\components\"
 */
export function buildFileText(path: string[], trailing: boolean): string {
	if (path.length === 0) {
		return "@";
	}
	const base = "@" + path.join("\\");
	return trailing ? base + "\\" : base;
}

/**
 * 根据文件路径构建带颜色的分段
 * @param path 文件路径数组
 * @param trailing 是否包含尾部反斜杠
 * @param filterText 可选的过滤文本（路径后的输入）
 */
export function buildFileSegments(
	path: string[],
	trailing: boolean,
	filterText?: string,
): ColoredSegment[] {
	// 始终以 @ 开头（浅蓝色）
	const segments: ColoredSegment[] = [{ text: "@", color: FILE_AT_COLOR }];

	if (path.length === 0) {
		// 如果有过滤文本，追加为普通文本
		if (filterText) {
			segments.push({ text: filterText });
		}
		return segments;
	}

	for (let i = 0; i < path.length; i++) {
		segments.push({ text: path[i]!, color: PATH_COLOR }); // 目录名为金黄色
		// 中间的反斜杠，或者尾部反斜杠（如果 trailing=true）
		if (i < path.length - 1 || trailing) {
			segments.push({ text: "\\", color: ARROW_COLOR });
		}
	}

	// 如果有过滤文本，追加为普通文本
	if (filterText) {
		segments.push({ text: filterText });
	}

	return segments;
}

/**
 * 从 InputInstance 获取纯文本
 */
export function getInstanceText(instance: InputInstance): string {
	return instance.text;
}

/**
 * 更新 selectedFiles 的位置信息
 * 当文本变化时，通过搜索文件路径来更新位置
 * @returns 仍然有效的 selectedFiles（位置已更新）
 */
export function updateSelectedFilesPositions(
	newText: string,
	oldSelectedFiles: SelectedFile[],
): SelectedFile[] {
	return oldSelectedFiles
		.map((file) => {
			// 构建要搜索的文本（@path）
			const searchText = "@" + file.path;
			const newPosition = newText.indexOf(searchText);
			if (newPosition === -1) {
				// 文件路径不在新文本中
				return null;
			}
			return {
				...file,
				atPosition: newPosition,
				endPosition: newPosition + searchText.length,
			};
		})
		.filter((f): f is SelectedFile => f !== null);
}

/**
 * 查找光标位置对应的 selectedFile
 * @param text 当前文本（用于验证位置是否有效）
 * @returns 如果光标在某个文件路径区域内（包括 @），返回该文件；否则返回 null
 */
export function findSelectedFileAtCursor(
	cursor: number,
	selectedFiles: SelectedFile[],
	text: string,
): SelectedFile | null {
	for (const file of selectedFiles) {
		// 检查光标是否在文件路径区域内（atPosition 是 @ 的位置，endPosition 是路径结束位置）
		if (cursor > file.atPosition && cursor < file.endPosition) {
			// 验证位置是否有效（文本在该位置确实是 @path）
			const expectedText = "@" + file.path;
			const actualText = text.substring(file.atPosition, file.endPosition);
			if (expectedText === actualText) {
				return file;
			}
		}
	}
	return null;
}

/**
 * 检查光标是否紧邻某个 selectedFile 的末尾（用于退格删除判断）
 * @param text 当前文本（用于验证位置是否有效）
 * @returns 如果光标紧邻文件路径末尾，返回该文件；否则返回 null
 */
export function findSelectedFileEndingAt(
	cursor: number,
	selectedFiles: SelectedFile[],
	text: string,
): SelectedFile | null {
	for (const file of selectedFiles) {
		if (cursor === file.endPosition) {
			// 验证位置是否有效（文本在该位置确实是 @path）
			const expectedText = "@" + file.path;
			const actualText = text.substring(file.atPosition, file.endPosition);
			if (expectedText === actualText) {
				return file;
			}
		}
	}
	return null;
}

/**
 * 检查光标是否紧邻某个 selectedFile 的开头（用于删除键判断）
 * @param text 当前文本（用于验证位置是否有效）
 * @returns 如果光标紧邻文件路径开头（@ 位置），返回该文件；否则返回 null
 */
export function findSelectedFileStartingAt(
	cursor: number,
	selectedFiles: SelectedFile[],
	text: string,
): SelectedFile | null {
	for (const file of selectedFiles) {
		if (cursor === file.atPosition) {
			// 验证位置是否有效（文本在该位置确实是 @path）
			const expectedText = "@" + file.path;
			const actualText = text.substring(file.atPosition, file.endPosition);
			if (expectedText === actualText) {
				return file;
			}
		}
	}
	return null;
}

/**
 * 删除指定的 selectedFile 并重建文本和 segments
 * @returns 新的 text, cursor, selectedFiles, segments
 */
export function removeSelectedFile(
	text: string,
	fileToRemove: SelectedFile,
	selectedFiles: SelectedFile[],
): {
	text: string;
	cursor: number;
	selectedFiles: SelectedFile[];
	segments: ColoredSegment[];
} {
	// 从文本中删除该文件路径（从 atPosition 到 endPosition）
	const newText =
		text.slice(0, fileToRemove.atPosition) + text.slice(fileToRemove.endPosition);

	// 计算新光标位置（删除后光标在原文件位置）
	const newCursor = fileToRemove.atPosition;

	// 从 selectedFiles 中移除该文件，并更新其他文件的位置
	const removedLength = fileToRemove.endPosition - fileToRemove.atPosition;
	const newSelectedFiles = selectedFiles
		.filter((f) => f !== fileToRemove)
		.map((f) => {
			if (f.atPosition > fileToRemove.atPosition) {
				// 在被删除文件之后的文件，位置需要向前移动
				return {
					...f,
					atPosition: f.atPosition - removedLength,
					endPosition: f.endPosition - removedLength,
				};
			}
			return f;
		});

	// 重建 segments
	const newSegments = rebuildSegmentsWithFiles(newText, newSelectedFiles);

	return {
		text: newText,
		cursor: newCursor,
		selectedFiles: newSelectedFiles,
		segments: newSegments,
	};
}

/**
 * 根据 selectedFiles 重建带颜色的 segments
 * 文件路径显示颜色，其余部分为普通文本
 */
export function rebuildSegmentsWithFiles(
	text: string,
	selectedFiles: SelectedFile[],
): ColoredSegment[] {
	if (selectedFiles.length === 0 || text.length === 0) {
		return text ? [{ text }] : [];
	}

	// 按位置排序
	const sortedFiles = [...selectedFiles].sort(
		(a, b) => a.atPosition - b.atPosition,
	);

	const segments: ColoredSegment[] = [];
	let pos = 0;

	for (const file of sortedFiles) {
		// 添加文件前的普通文本
		if (file.atPosition > pos) {
			segments.push({ text: text.substring(pos, file.atPosition) });
		}

		// 添加 @ 符号（浅蓝色）
		segments.push({ text: "@", color: FILE_AT_COLOR });

		// 添加文件路径（金黄色）
		const pathText = text.substring(file.atPosition + 1, file.endPosition);
		if (pathText) {
			segments.push({ text: pathText, color: PATH_COLOR });
		}

		pos = file.endPosition;
	}

	// 添加最后一个文件之后的文本
	if (pos < text.length) {
		segments.push({ text: text.substring(pos) });
	}

	return segments;
}

/**
 * 判断是否为消息类型
 */
export function isMessageInstance(instance: InputInstance): boolean {
	return instance.type === "message";
}

/**
 * 判断是否为命令类型
 */
export function isCommandInstance(instance: InputInstance): boolean {
	return instance.type === "command";
}

// ============================================================================
// 历史记录类型
// ============================================================================

/**
 * 历史记录条目 - 不包含 cursor（恢复时设为 text.length）
 * 这是 InputInstance 的子集，用于历史存储
 */
export type HistoryEntry = {
	/** 纯文本内容 */
	text: string;

	/** 输入类型 */
	type: InputType;

	/** 渲染分段（带颜色） */
	segments: ColoredSegment[];

	/** 命令路径（仅 type='command' 时有意义） */
	commandPath: string[];

	/** 文件路径（文件选择模式下的导航路径） */
	filePath: string[];

	/** 已选择的文件列表（通过 @ 选择的文件） */
	selectedFiles: SelectedFile[];
};

/**
 * 从 InputInstance 创建 HistoryEntry（去除 cursor）
 */
export function toHistoryEntry(instance: InputInstance): HistoryEntry {
	return {
		text: instance.text,
		type: instance.type,
		segments: instance.segments,
		commandPath: instance.commandPath,
		filePath: instance.filePath,
		selectedFiles: instance.selectedFiles,
	};
}

/**
 * 从 HistoryEntry 恢复 InputInstance（cursor 设为 text.length）
 */
export function fromHistoryEntry(entry: HistoryEntry): InputInstance {
	return {
		text: entry.text,
		cursor: entry.text.length,
		type: entry.type,
		segments: entry.segments,
		commandPath: entry.commandPath,
		filePath: entry.filePath,
		selectedFiles: entry.selectedFiles,
	};
}

// ============================================================================
// UserInput 转换
// ============================================================================

/**
 * 从 InputInstance 创建 UserInput
 * UserInput 是 InputInstance 的语义子集，用于提交回调
 */
export function toUserInput(instance: InputInstance): UserInput {
	if (instance.type === "command") {
		const commandInput: CommandInput = {
			type: "command",
			text: instance.text,
			segments: instance.segments,
			commandPath: instance.commandPath,
		};
		return commandInput;
	}

	const messageInput: MessageInput = {
		type: "message",
		text: instance.text,
		segments: instance.segments,
		files: instance.selectedFiles.map((f) => ({
			path: f.path,
			isDirectory: f.isDirectory,
		})),
	};
	return messageInput;
}
