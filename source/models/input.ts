/**
 * 用户输入类型定义
 * 为用户输入提供结构化的元信息，区分不同的输入模式
 */

/**
 * 输入类型枚举
 * - message: 普通消息输入（需要发送给 AI）
 * - command: 内部命令（由应用自身处理）
 */
export type InputType = "message" | "command";

/**
 * 普通消息输入
 * 来自 normal 或 history 模式的输入，需要发送给 AI 处理
 */
export type MessageInput = {
	type: "message";
	content: string;
};

/**
 * 命令输入
 * 来自 slash 模式的输入，由应用内部处理
 */
export type CommandInput = {
	type: "command";
	/** 命令路径，如 ["model", "openai", "gpt-4"] */
	command: string[];
	/** 原始输入字符串 */
	raw: string;
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
export function createMessageInput(content: string): MessageInput {
	return {
		type: "message",
		content,
	};
}

/**
 * 创建命令输入
 */
export function createCommandInput(
	command: string[],
	raw: string,
): CommandInput {
	return {
		type: "command",
		command,
		raw,
	};
}

