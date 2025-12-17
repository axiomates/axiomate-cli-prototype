/**
 * 命令处理器
 * 根据 SlashCommand 的 action 类型分发处理逻辑
 */

import type {
	SlashCommand,
	CommandAction,
} from "../components/AutocompleteInput/index.js";
import { SLASH_COMMANDS } from "../constants/commands.js";

/**
 * 命令执行结果（内部使用）
 */
type CommandResult =
	| { type: "message"; content: string } // 显示消息（内部处理完成）
	| { type: "prompt"; content: string } // 发送给 AI 的 prompt
	| { type: "config"; key: string; value: string } // 配置变更
	| { type: "action"; action: "clear" | "exit" } // 特殊动作
	| { type: "error"; message: string }; // 错误

/**
 * 内部命令处理器映射
 */
type InternalHandler = (
	path: string[],
	context: CommandContext,
) => CommandResult;

/**
 * 命令执行上下文（静态信息）
 */
export type CommandContext = {
	appName: string;
	version: string;
};

/**
 * 命令执行回调（App 提供的业务逻辑）
 */
export type CommandCallbacks = {
	/** 显示消息 */
	showMessage: (content: string) => void;
	/** 发送给 AI */
	sendToAI: (content: string) => void;
	/** 更新配置 */
	setConfig: (key: string, value: string) => void;
	/** 清屏 */
	clear: () => void;
	/** 退出 */
	exit: () => void;
};

/**
 * 内部命令处理器注册表
 */
const internalHandlers: Record<string, InternalHandler> = {
	help: () => ({
		type: "message",
		content:
			"Available commands: /help, /exit, /clear, /version, /model, /compact",
	}),

	version: (_path, ctx) => ({
		type: "message",
		content: `${ctx.appName} v${ctx.version}`,
	}),

	clear: () => ({
		type: "action",
		action: "clear",
	}),

	exit: () => ({
		type: "action",
		action: "exit",
	}),
};

/**
 * 根据命令路径查找对应的 SlashCommand
 */
export function findCommandByPath(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): SlashCommand | null {
	if (path.length === 0) return null;

	const [first, ...rest] = path;
	const cmd = commands.find((c) => c.name === first);

	if (!cmd) return null;
	if (rest.length === 0) return cmd;
	if (!cmd.children) return null;

	return findCommandByPath(rest, cmd.children);
}

/**
 * 获取命令的 action，支持继承父级 action
 */
export function getCommandAction(
	path: string[],
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandAction | null {
	const cmd = findCommandByPath(path, commands);
	return cmd?.action ?? null;
}

/**
 * 执行命令（内部）
 */
function executeCommandInternal(
	path: string[],
	context: CommandContext,
	commands: SlashCommand[] = SLASH_COMMANDS,
): CommandResult {
	if (path.length === 0) {
		return { type: "error", message: "Empty command path" };
	}

	const action = getCommandAction(path, commands);

	if (!action) {
		// 没有 action 的命令（可能是分支节点）
		return {
			type: "error",
			message: `Command /${path.join(" ")} has no action`,
		};
	}

	switch (action.type) {
		case "internal": {
			const handler = action.handler ? internalHandlers[action.handler] : null;
			if (!handler) {
				return {
					type: "error",
					message: `Unknown internal handler: ${action.handler}`,
				};
			}
			return handler(path, context);
		}

		case "prompt": {
			return {
				type: "prompt",
				content: action.template,
			};
		}

		case "config": {
			// 对于 model 命令，value 是完整路径（如 "openai gpt-4o"）
			const value = path.slice(1).join(" ");
			return {
				type: "config",
				key: action.key,
				value,
			};
		}

		default:
			return { type: "error", message: "Unknown action type" };
	}
}

/**
 * 执行命令并调用对应的回调
 */
export function handleCommand(
	path: string[],
	context: CommandContext,
	callbacks: CommandCallbacks,
	commands: SlashCommand[] = SLASH_COMMANDS,
): void {
	const result = executeCommandInternal(path, context, commands);

	switch (result.type) {
		case "message":
			callbacks.showMessage(result.content);
			break;

		case "prompt":
			callbacks.sendToAI(result.content);
			break;

		case "config":
			callbacks.setConfig(result.key, result.value);
			break;

		case "action":
			if (result.action === "clear") {
				callbacks.clear();
			} else if (result.action === "exit") {
				callbacks.exit();
			}
			break;

		case "error":
			callbacks.showMessage(`Error: ${result.message}`);
			break;
	}
}
