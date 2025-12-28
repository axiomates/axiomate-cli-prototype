/**
 * 工具调用处理器
 * 处理 AI 返回的 function call，执行工具并返回结果
 */

import type {
	IToolCallHandler,
	ToolCall,
	ChatMessage,
	ToolExecutionResult,
} from "./types.js";
import type {
	IToolRegistry,
	DiscoveredTool,
	ToolAction,
} from "../tools/types.js";
import { executeToolAction, getToolAction } from "../tools/executor.js";
import { t } from "../../i18n/index.js";

/**
 * 工具调用处理器实现
 */
export class ToolCallHandler implements IToolCallHandler {
	constructor(
		private registry: IToolRegistry,
		private options?: {
			cwd?: string;
			timeout?: number;
		},
	) {}

	/**
	 * 解析工具调用名称
	 * @param name 格式: toolId_actionName (如 "git_status")
	 */
	parseToolCallName(name: string): { toolId: string; actionName: string } {
		const underscoreIndex = name.indexOf("_");
		if (underscoreIndex === -1) {
			return { toolId: name, actionName: "default" };
		}
		return {
			toolId: name.substring(0, underscoreIndex),
			actionName: name.substring(underscoreIndex + 1),
		};
	}

	/**
	 * 执行单个工具调用
	 */
	private async executeSingleCall(call: ToolCall): Promise<{
		result: ToolExecutionResult;
		tool?: DiscoveredTool;
		action?: ToolAction;
	}> {
		const { toolId, actionName } = this.parseToolCallName(call.function.name);
		const tool = this.registry.getTool(toolId);

		if (!tool) {
			return {
				result: {
					success: false,
					output: "",
					error: t("errors.toolNotFound", { toolId }),
				},
			};
		}

		if (!tool.installed) {
			return {
				result: {
					success: false,
					output: "",
					error: t("errors.toolNotInstalled", {
						toolName: tool.name,
						hint: tool.installHint || "",
					}),
				},
				tool,
			};
		}

		const action = getToolAction(tool, actionName);
		if (!action) {
			return {
				result: {
					success: false,
					output: "",
					error: t("errors.toolActionNotFound", {
						toolName: tool.name,
						actionName,
					}),
				},
				tool,
			};
		}

		// 解析参数
		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(call.function.arguments);
		} catch (e) {
			return {
				result: {
					success: false,
					output: "",
					error: t("errors.paramParseFailed", {
						message: e instanceof Error ? e.message : String(e),
					}),
				},
				tool,
				action,
			};
		}

		// 执行工具
		const startTime = Date.now();
		const execResult = await executeToolAction(tool, action, args, {
			cwd: this.options?.cwd,
			timeout: this.options?.timeout,
		});
		const duration = Date.now() - startTime;

		return {
			result: {
				success: execResult.success,
				output: execResult.success
					? execResult.stdout
					: execResult.error ||
						execResult.stderr ||
						t("errors.executionFailed"),
				error: execResult.success
					? undefined
					: execResult.error || execResult.stderr,
				duration,
			},
			tool,
			action,
		};
	}

	/**
	 * 处理 AI 返回的工具调用
	 */
	async handleToolCalls(toolCalls: ToolCall[]): Promise<ChatMessage[]> {
		const results: ChatMessage[] = [];

		for (const call of toolCalls) {
			const { result, tool, action } = await this.executeSingleCall(call);

			// 构建工具结果消息
			let content: string;
			if (result.success) {
				content = result.output || t("common.executionSuccess");
			} else {
				content = `Error: ${result.error || t("errors.unknownError")}`;
			}

			// 添加执行信息
			if (tool && action) {
				const info = [`[${tool.name}:${action.name}]`];
				if (result.duration) {
					info.push(`(${result.duration}ms)`);
				}
				content = `${info.join(" ")}\n${content}`;
			}

			results.push({
				role: "tool",
				tool_call_id: call.id,
				content,
			});
		}

		return results;
	}
}

/**
 * 创建工具调用处理器
 */
export function createToolCallHandler(
	registry: IToolRegistry,
	options?: {
		cwd?: string;
		timeout?: number;
	},
): IToolCallHandler {
	return new ToolCallHandler(registry, options);
}
