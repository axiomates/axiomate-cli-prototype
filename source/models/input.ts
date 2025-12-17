/**
 * 用户输入类型定义
 * UserInput 是 InputInstance 的语义子集，用于提交回调
 * 保留渲染信息（segments），便于显示历史/预览
 */

import type { ColoredSegment } from "./richInput.js";

/**
 * 输入类型枚举
 * - message: 普通消息输入（需要发送给 AI）
 * - command: 内部命令（由应用自身处理）
 */
export type InputType = "message" | "command";

/**
 * 文件引用
 * 结构化的文件信息，从 @ 选择的文件
 */
export type FileReference = {
	/** 完整路径（如 "assets/icon.ico"） */
	path: string;
	/** 是否目录 */
	isDirectory: boolean;
};

/**
 * 普通消息输入
 * 来自 normal 或 history 模式的输入，需要发送给 AI 处理
 */
export type MessageInput = {
	type: "message";
	/** 原始文本（包含 @path） */
	text: string;
	/** 渲染分段（带颜色，用于显示历史/预览） */
	segments: ColoredSegment[];
	/** 结构化的文件引用列表 */
	files: FileReference[];
};

/**
 * 命令输入
 * 来自 slash 模式的输入，由应用内部处理
 */
export type CommandInput = {
	type: "command";
	/** 原始文本 */
	text: string;
	/** 渲染分段（带颜色） */
	segments: ColoredSegment[];
	/** 命令路径，如 ["model", "openai", "gpt-4"] */
	commandPath: string[];
};

/**
 * 用户输入联合类型
 */
export type UserInput = MessageInput | CommandInput;

/**
 * 类型守卫：判断是否为消息输入
 */
export function isMessageInput(input: UserInput): input is MessageInput {
	return input.type === "message";
}

/**
 * 类型守卫：判断是否为命令输入
 */
export function isCommandInput(input: UserInput): input is CommandInput {
	return input.type === "command";
}

/**
 * 创建消息输入
 */
export function createMessageInput(
	text: string,
	segments: ColoredSegment[] = [],
	files: FileReference[] = [],
): MessageInput {
	return {
		type: "message",
		text,
		segments: segments.length > 0 ? segments : text ? [{ text }] : [],
		files,
	};
}

/**
 * 创建命令输入
 */
export function createCommandInput(
	commandPath: string[],
	text: string,
	segments: ColoredSegment[] = [],
): CommandInput {
	return {
		type: "command",
		text,
		segments,
		commandPath,
	};
}
