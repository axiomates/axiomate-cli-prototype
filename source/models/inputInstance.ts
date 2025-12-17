/**
 * 输入实例模型
 * 用户输入的完整数据结构，包含渲染和语义信息
 */

import type { ColoredSegment } from "./richInput.js";
import { PATH_COLOR, ARROW_COLOR, FILE_AT_COLOR } from "./richInput.js";

/**
 * 输入类型
 */
export type InputType = "message" | "command";

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
	};
}

/**
 * 创建文件选择模式输入实例
 * @param path 文件路径，如 ["src", "components"]
 * @param trailing 是否包含尾部斜杠（表示目录）
 */
export function createFileInstance(
	path: string[] = [],
	trailing: boolean = true,
): InputInstance {
	const text = buildFileText(path, trailing);
	return {
		text,
		cursor: text.length,
		type: "message",
		segments: buildFileSegments(path, trailing),
		commandPath: [],
		filePath: path,
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
	};
}

/**
 * 进入下一级文件目录
 */
export function enterFileLevel(
	instance: InputInstance,
	dirName: string,
): InputInstance {
	const newPath = [...instance.filePath, dirName];
	const text = buildFileText(newPath, true);
	return {
		text,
		cursor: text.length,
		type: "message",
		segments: buildFileSegments(newPath, true),
		commandPath: [],
		filePath: newPath,
	};
}

/**
 * 退出当前文件目录级别
 */
export function exitFileLevel(instance: InputInstance): InputInstance {
	if (instance.filePath.length === 0) {
		// 已经在根级，返回只有 @ 的状态
		return createFileInstance([], true);
	}
	const newPath = instance.filePath.slice(0, -1);
	const text = buildFileText(newPath, true);
	return {
		text,
		cursor: text.length,
		type: "message",
		segments: buildFileSegments(newPath, true),
		commandPath: [],
		filePath: newPath,
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
 */
export function buildFileSegments(
	path: string[],
	trailing: boolean,
): ColoredSegment[] {
	// 始终以 @ 开头（浅蓝色）
	const segments: ColoredSegment[] = [{ text: "@", color: FILE_AT_COLOR }];

	if (path.length === 0) {
		return segments;
	}

	for (let i = 0; i < path.length; i++) {
		segments.push({ text: path[i]!, color: PATH_COLOR }); // 目录名为金黄色
		// 中间的反斜杠，或者尾部反斜杠（如果 trailing=true）
		if (i < path.length - 1 || trailing) {
			segments.push({ text: "\\", color: ARROW_COLOR });
		}
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
