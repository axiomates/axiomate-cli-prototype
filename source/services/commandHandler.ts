/**
 * 命令处理器
 * 根据 SlashCommand 的 action 类型分发处理逻辑
 */

import type {
	SlashCommand,
	CommandAction,
} from "../components/AutocompleteInput/index.js";
import { SLASH_COMMANDS } from "../constants/commands.js";
import { getToolRegistry } from "./tools/registry.js";
import {
	getModelById,
	getAllSeries,
	getModelsBySeries,
	getSeriesDisplayName,
	DEFAULT_MODEL_ID,
} from "../constants/models.js";
import { getCurrentModelId, setCurrentModelId } from "../utils/config.js";

/**
 * 命令执行结果（内部使用）
 */
type CommandResult =
	| { type: "message"; content: string } // 显示消息（内部处理完成）
	| { type: "prompt"; content: string } // 发送给 AI 的 prompt
	| { type: "config"; key: string; value: string } // 配置变更
	| { type: "action"; action: "clear" | "exit" } // 特殊动作
	| { type: "async"; handler: () => Promise<string> } // 异步命令
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
			"Available commands: /help, /exit, /clear, /version, /model, /tools, /compact",
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

	// 工具命令处理器
	tools_list: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			if (!registry.isDiscovered) {
				await registry.discover();
			}
			return registry.formatToolList(true);
		},
	}),

	tools_refresh: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			await registry.discover();
			const stats = registry.getStats();
			return `已重新扫描工具。\n已安装: ${stats.installed} 个\n未安装: ${stats.notInstalled} 个`;
		},
	}),

	tools_stats: () => ({
		type: "async",
		handler: async () => {
			const registry = getToolRegistry();
			if (!registry.isDiscovered) {
				await registry.discover();
			}
			const stats = registry.getStats();
			const lines = [
				`## 工具统计`,
				`- 总计: ${stats.total} 个`,
				`- 已安装: ${stats.installed} 个`,
				`- 未安装: ${stats.notInstalled} 个`,
				``,
				`### 按类别统计（已安装）`,
			];
			for (const [category, count] of Object.entries(stats.byCategory)) {
				lines.push(`- ${category}: ${count} 个`);
			}
			return lines.join("\n");
		},
	}),

	// AI 模型命令处理器
	model_list: () => ({
		type: "message",
		content: (() => {
			const currentModelId = getCurrentModelId() || DEFAULT_MODEL_ID;
			const currentModel = getModelById(currentModelId);

			const lines = ["## Available Models", ""];

			// 按系列分组显示
			for (const series of getAllSeries()) {
				const seriesModels = getModelsBySeries(series);
				lines.push(`### ${getSeriesDisplayName(series)}`);

				for (const model of seriesModels) {
					const isCurrent = model.id === currentModelId;
					const marker = isCurrent ? "→ " : "  ";

					// 能力标签
					const capabilities: string[] = [];
					if (model.supportsTools) capabilities.push("tools");
					if (model.thinkingToolsExclusive) {
						capabilities.push("thinking*"); // * 表示与 tools 互斥
					}
					const capStr =
						capabilities.length > 0 ? `[${capabilities.join(", ")}]` : "";

					// 描述
					const desc = model.description ? ` - ${model.description}` : "";

					lines.push(`${marker}**${model.id}** ${model.name}${desc} ${capStr}`);
				}
				lines.push("");
			}

			// 当前模型信息
			if (currentModel) {
				lines.push("---");
				lines.push(`**Current:** ${currentModel.name} (${currentModel.id})`);
				const exclusiveNote = currentModel.thinkingToolsExclusive
					? " (mutually exclusive)"
					: "";
				lines.push(
					`**Capabilities:** tools ${currentModel.supportsTools ? "✓" : "✗"}${exclusiveNote}`,
				);
				lines.push(`**Protocol:** ${currentModel.protocol}`);
			}

			return lines.join("\n");
		})(),
	}),

	// 模型选择处理器
	model_select: (path: string[]) => {
		// path = ["model", "gpt-4o"] -> modelId = "gpt-4o"
		const modelId = path[path.length - 1];
		if (!modelId) {
			return { type: "error" as const, message: "未指定模型" };
		}

		const model = getModelById(modelId);
		if (!model) {
			return { type: "error" as const, message: `未知模型: ${modelId}` };
		}

		// 保存到配置
		setCurrentModelId(modelId);

		// 返回成功消息，包含模型信息
		const capabilities: string[] = [];
		if (model.supportsTools) capabilities.push("tools");
		if (model.thinkingToolsExclusive) {
			capabilities.push("thinking (exclusive with tools)");
		}

		return {
			type: "message" as const,
			content: `已切换到 **${model.name}** (${model.id})\n\nCapabilities: ${capabilities.join(", ") || "none"}\nProtocol: ${model.protocol}`,
		};
	},
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
export async function handleCommand(
	path: string[],
	context: CommandContext,
	callbacks: CommandCallbacks,
	commands: SlashCommand[] = SLASH_COMMANDS,
): Promise<void> {
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

		case "async":
			try {
				const content = await result.handler();
				callbacks.showMessage(content);
			} catch (err) {
				callbacks.showMessage(
					`Error: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			break;

		case "error":
			callbacks.showMessage(`Error: ${result.message}`);
			break;
	}
}
