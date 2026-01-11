/**
 * Anthropic 工具格式适配器
 * 将本地 DiscoveredTool 转换为 Anthropic Tool Use 格式
 */

import type { DiscoveredTool } from "../../tools/types.js";
import type { AnthropicTool, ToolCall, ChatMessage } from "../types.js";
import { paramsToJsonSchema } from "./openai.js";
import { stableStringify } from "../../../utils/json.js";

/**
 * 将单个 DiscoveredTool 转换为 Anthropic 工具格式
 */
export function toolToAnthropic(tool: DiscoveredTool): AnthropicTool[] {
	if (!tool.installed) {
		return [];
	}

	return tool.actions.map((action) => ({
		name: `${tool.id}_${action.name}`,
		description: `[${tool.name}] ${action.description}`,
		input_schema: paramsToJsonSchema(action.parameters),
	}));
}

/**
 * 将 DiscoveredTool 数组转换为 Anthropic 工具格式
 */
export function toAnthropicTools(tools: DiscoveredTool[]): AnthropicTool[] {
	return tools.flatMap(toolToAnthropic);
}

/**
 * Anthropic tool_use 内容块类型
 */
type AnthropicToolUseBlock = {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
};

/**
 * 解析 Anthropic 响应中的 tool_use 块
 */
export function parseAnthropicToolUse(
	contentBlocks: Array<{ type: string } & Partial<AnthropicToolUseBlock>>,
): ToolCall[] {
	return contentBlocks
		.filter(
			(block): block is AnthropicToolUseBlock => block.type === "tool_use",
		)
		.map((block) => ({
			id: block.id,
			type: "function" as const,
			function: {
				name: block.name,
				// 使用 stableStringify 确保键顺序一致，提高 KV 缓存命中率
				arguments: stableStringify(block.input),
			},
		}));
}

/**
 * 构建 Anthropic 格式的工具结果消息
 */
export function buildAnthropicToolResultMessage(
	toolUseId: string,
	content: string,
	isError = false,
): ChatMessage {
	// Anthropic 使用 tool_result 类型，但我们统一为 ChatMessage 格式
	return {
		role: "tool",
		tool_call_id: toolUseId,
		content: isError ? `Error: ${content}` : content,
	};
}

/**
 * 将聊天消息转换为 Anthropic API 格式
 * Anthropic 的消息格式与 OpenAI 有所不同
 */
export function toAnthropicMessages(messages: ChatMessage[]): Array<{
	role: "user" | "assistant";
	content:
		| string
		| Array<{
				type: string;
				tool_use_id?: string;
				content?: string;
				text?: string;
				thinking?: string;
				id?: string;
				name?: string;
				input?: Record<string, unknown>;
		  }>;
}> {
	const result: Array<{
		role: "user" | "assistant";
		content:
			| string
			| Array<{
					type: string;
					tool_use_id?: string;
					content?: string;
					text?: string;
					thinking?: string;
					id?: string;
					name?: string;
					input?: Record<string, unknown>;
			  }>;
	}> = [];

	// 收集连续的 tool 消息
	let pendingToolResults: Array<{
		type: "tool_result";
		tool_use_id: string;
		content: string;
	}> = [];

	for (const msg of messages) {
		if (msg.role === "system") {
			// Anthropic 的 system 消息单独处理，不放在 messages 数组中
			continue;
		}

		if (msg.role === "tool") {
			// 收集 tool 结果
			pendingToolResults.push({
				type: "tool_result",
				tool_use_id: msg.tool_call_id || "",
				content: msg.content,
			});
			continue;
		}

		// 如果有待处理的 tool 结果，先添加为 user 消息
		if (pendingToolResults.length > 0) {
			result.push({
				role: "user",
				content: pendingToolResults,
			});
			pendingToolResults = [];
		}

		if (msg.role === "user") {
			result.push({
				role: "user",
				content: msg.content,
			});
		} else if (msg.role === "assistant") {
			// 检查是否需要使用 content 数组格式（有 thinking 或 tool_calls）
			const hasThinking = !!msg.reasoning_content;
			const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;

			if (hasThinking || hasToolCalls) {
				const content: Array<{
					type: string;
					text?: string;
					thinking?: string;
					id?: string;
					name?: string;
					input?: Record<string, unknown>;
				}> = [];

				// 1. 先添加 thinking 块（Anthropic 要求 thinking 在前）
				if (msg.reasoning_content) {
					content.push({
						type: "thinking",
						thinking: msg.reasoning_content,
					});
				}

				// 2. 添加 text 块
				if (msg.content) {
					content.push({
						type: "text",
						text: msg.content,
					});
				}

				// 3. 添加 tool_use 块
				for (const tc of msg.tool_calls || []) {
					content.push({
						type: "tool_use",
						id: tc.id,
						name: tc.function.name,
						// 确保 arguments 是有效的 JSON 字符串，空字符串替换为 "{}"
						input: JSON.parse(tc.function.arguments || "{}"),
					});
				}

				result.push({
					role: "assistant",
					content,
				});
			} else {
				// 纯文本消息
				result.push({
					role: "assistant",
					content: msg.content,
				});
			}
		}
	}

	// 处理末尾的 tool 结果
	if (pendingToolResults.length > 0) {
		result.push({
			role: "user",
			content: pendingToolResults,
		});
	}

	return result;
}

/**
 * 从 Anthropic 消息中提取 system 消息
 */
export function extractSystemMessage(
	messages: ChatMessage[],
): string | undefined {
	const systemMsg = messages.find((m) => m.role === "system");
	return systemMsg?.content;
}
