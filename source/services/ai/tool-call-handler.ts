/**
 * 工具调用处理器
 * 处理 AI 返回的 function call，执行工具并返回结果
 */

import type {
	IToolCallHandler,
	ToolCall,
	ChatMessage,
	ToolExecutionResult,
	AskUserCallback,
	ToolMaskState,
} from "./types.js";
import type {
	IToolRegistry,
	DiscoveredTool,
	ToolAction,
} from "../tools/types.js";
import { executeToolAction, getToolAction } from "../tools/executor.js";
import { isToolAllowed, getToolNotAllowedError } from "./toolMask.js";

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
					error: `Tool "${toolId}" not found`,
				},
			};
		}

		if (!tool.installed) {
			const hint = tool.installHint ? ` ${tool.installHint}` : "";
			return {
				result: {
					success: false,
					output: "",
					error: `Tool "${tool.name}" is not installed.${hint}`,
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
					error: `Tool "${tool.name}" has no action "${actionName}"`,
				},
				tool,
			};
		}

		// 解析参数
		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(call.function.arguments);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return {
				result: {
					success: false,
					output: "",
					error: `Parameter parsing failed: ${message}`,
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
					: execResult.error || execResult.stderr || "Execution failed",
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
	 * @param toolCalls 工具调用列表
	 * @param onAskUser 可选的 ask_user 回调，用于暂停执行等待用户输入
	 * @param toolMask 可选的工具遮蔽状态，用于验证工具是否被允许
	 */
	async handleToolCalls(
		toolCalls: ToolCall[],
		onAskUser?: AskUserCallback,
		toolMask?: ToolMaskState,
	): Promise<ChatMessage[]> {
		const results: ChatMessage[] = [];

		for (const call of toolCalls) {
			const { toolId, actionName } = this.parseToolCallName(call.function.name);

			// 验证工具是否在允许列表中
			if (toolMask && !isToolAllowed(toolId, toolMask)) {
				results.push({
					role: "tool",
					tool_call_id: call.id,
					content: getToolNotAllowedError(toolId, toolMask),
				});
				continue;
			}

			// Special handling for askuser tool
			if (toolId === "a-c-askuser" && actionName === "ask") {
				const askResult = await this.handleAskUser(call, onAskUser);
				results.push(askResult);
				continue;
			}

			const { result, tool, action } = await this.executeSingleCall(call);

			// 构建工具结果消息
			let content: string;
			if (result.success) {
				content = result.output || "(execution succeeded, no output)";
			} else {
				content = `Error: ${result.error || "Unknown error"}`;
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

	/**
	 * Handle ask_user tool call
	 * Pauses execution and waits for user input via callback
	 */
	private async handleAskUser(
		call: ToolCall,
		onAskUser?: AskUserCallback,
	): Promise<ChatMessage> {
		// Parse arguments
		let args: { question?: string; options?: string } = {};
		try {
			args = JSON.parse(call.function.arguments);
		} catch {
			return {
				role: "tool",
				tool_call_id: call.id,
				content: "[Ask User] Error: Failed to parse arguments",
			};
		}

		const question = args.question || "";
		let options: string[] = [];

		// Parse options if provided (JSON array string)
		if (args.options) {
			try {
				const parsed = JSON.parse(args.options);
				if (Array.isArray(parsed)) {
					options = parsed.map(String);
				}
			} catch {
				// Ignore parse error, use empty options
			}
		}

		// If no callback provided, return error
		if (!onAskUser) {
			return {
				role: "tool",
				tool_call_id: call.id,
				content:
					"[Ask User] Error: User interaction not available in this context",
			};
		}

		// Call the callback and wait for user response
		try {
			const userAnswer = await onAskUser(question, options);

			// User cancelled (empty string)
			if (userAnswer === "") {
				return {
					role: "tool",
					tool_call_id: call.id,
					content: "[Ask User] User cancelled the question",
				};
			}

			return {
				role: "tool",
				tool_call_id: call.id,
				content: `[Ask User] User answered: ${userAnswer}`,
			};
		} catch (error) {
			return {
				role: "tool",
				tool_call_id: call.id,
				content: `[Ask User] Error: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
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
