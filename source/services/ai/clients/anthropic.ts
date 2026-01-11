/**
 * Anthropic 客户端实现
 * 支持 Claude API (包括流式响应)
 */

import type {
	IAIClient,
	AIClientConfig,
	ChatMessage,
	AIResponse,
	AIStreamChunk,
	OpenAITool,
	FinishReason,
	AnthropicTool,
	ToolCall,
	StreamOptions,
	ToolMaskState,
} from "../types.js";
import {
	toAnthropicMessages,
	extractSystemMessage,
	parseAnthropicToolUse,
} from "../adapters/anthropic.js";
import {
	isThinkingEnabled,
	currentModelSupportsThinking,
	currentModelSupportsToolChoice,
} from "../../../utils/config.js";
import { stableStringify } from "../../../utils/json.js";

/**
 * Anthropic API 响应类型
 */
type AnthropicAPIResponse = {
	id: string;
	type: "message";
	role: "assistant";
	content: Array<
		| { type: "text"; text: string }
		| { type: "thinking"; thinking: string }
		| {
				type: "tool_use";
				id: string;
				name: string;
				input: Record<string, unknown>;
		  }
	>;
	model: string;
	stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
	stop_sequence: string | null;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
};

/**
 * 将 OpenAI 工具格式转换为 Anthropic 格式
 */
function openAIToolsToAnthropic(tools: OpenAITool[]): AnthropicTool[] {
	return tools.map((tool) => ({
		name: tool.function.name,
		description: tool.function.description,
		input_schema: tool.function.parameters,
	}));
}

/**
 * Anthropic 客户端
 */
export class AnthropicClient implements IAIClient {
	private config: AIClientConfig;

	constructor(config: AIClientConfig) {
		this.config = {
			baseUrl: "https://api.anthropic.com",
			timeout: 60000,
			maxRetries: 3,
			...config,
		};
	}

	getConfig(): AIClientConfig {
		return { ...this.config };
	}

	async chat(
		messages: ChatMessage[],
		tools?: OpenAITool[],
		options?: StreamOptions,
	): Promise<AIResponse> {
		// 构建 URL：baseUrl 应该已经包含 /v1，只需添加 /messages
		const baseUrl =
			this.config.baseUrl?.replace(/\/$/, "") || "https://api.anthropic.com/v1";
		const url = `${baseUrl}/messages`;

		// 提取 system 消息
		const systemPrompt = extractSystemMessage(messages);

		// 如果不支持 tool_choice 但需要强制工具，使用 prefill
		const processedMessages = this.applyPrefillIfNeeded(messages, options?.toolMask);

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toAnthropicMessages(processedMessages),
			max_tokens: 4096,
		};

		if (systemPrompt) {
			body.system = systemPrompt;
		}

		if (tools && tools.length > 0) {
			body.tools = openAIToolsToAnthropic(tools);
			// 根据 toolMask 设置 tool_choice
			const toolChoice = this.buildToolChoice(options?.toolMask);
			if (toolChoice) {
				body.tool_choice = toolChoice;
			}
		}

		// 如果启用思考模式且当前模型支持，添加 thinking 参数
		if (isThinkingEnabled() && currentModelSupportsThinking()) {
			body.thinking = {
				type: "enabled",
				budget_tokens: 10000,
			};
		}

		let lastError: Error | null = null;
		const maxRetries = this.config.maxRetries || 3;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(
					() => controller.abort(),
					this.config.timeout || 60000,
				);

				const response = await fetch(url, {
					method: "POST",
					headers: {
						"x-api-key": this.config.apiKey ?? "",
						"anthropic-version": "2023-06-01",
						"anthropic-beta": "interleaved-thinking-2025-05-14",
						"Content-Type": "application/json",
					},
					// 使用 stableStringify 确保键顺序一致，提高 KV 缓存命中率
					body: stableStringify(body),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
					);
				}

				const data = (await response.json()) as AnthropicAPIResponse;
				return this.parseResponse(data);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt === maxRetries - 1 || lastError.name === "AbortError") {
					throw lastError;
				}

				await new Promise((resolve) =>
					setTimeout(resolve, Math.pow(2, attempt) * 1000),
				);
			}
		}

		throw lastError || new Error("Unknown error");
	}

	private parseResponse(data: AnthropicAPIResponse): AIResponse {
		// 提取文本内容
		const textContent = data.content
			.filter(
				(block): block is { type: "text"; text: string } =>
					block.type === "text",
			)
			.map((block) => block.text)
			.join("");

		// 提取思考内容 (thinking blocks)
		const thinkingContent = data.content
			.filter(
				(block): block is { type: "thinking"; thinking: string } =>
					block.type === "thinking",
			)
			.map((block) => block.thinking)
			.join("");

		const message: ChatMessage = {
			role: "assistant",
			content: textContent,
		};

		// 如果有思考内容，添加到消息中（使用 reasoning_content 字段保持一致性）
		if (thinkingContent) {
			message.reasoning_content = thinkingContent;
		}

		// 解析 tool_use 块
		const toolUseBlocks = data.content.filter(
			(
				block,
			): block is {
				type: "tool_use";
				id: string;
				name: string;
				input: Record<string, unknown>;
			} => block.type === "tool_use",
		);

		if (toolUseBlocks.length > 0) {
			message.tool_calls = parseAnthropicToolUse(toolUseBlocks);
		}

		// 转换 stop_reason
		let finishReason: FinishReason = "stop";
		switch (data.stop_reason) {
			case "end_turn":
				finishReason = "stop";
				break;
			case "tool_use":
				finishReason = "tool_calls";
				break;
			case "max_tokens":
				finishReason = "length";
				break;
			default:
				finishReason = "stop";
		}

		return {
			message,
			finish_reason: finishReason,
			usage: {
				prompt_tokens: data.usage.input_tokens,
				completion_tokens: data.usage.output_tokens,
				total_tokens: data.usage.input_tokens + data.usage.output_tokens,
			},
		};
	}

	/**
	 * 解析 stop_reason 到统一的 FinishReason
	 */
	private parseStopReason(reason: string | null | undefined): FinishReason {
		switch (reason) {
			case "end_turn":
				return "stop";
			case "tool_use":
				return "tool_calls";
			case "max_tokens":
				return "length";
			default:
				return "stop";
		}
	}

	/**
	 * 根据 toolMask 构建 Anthropic tool_choice 参数
	 * Anthropic 使用不同的格式：{ type: "auto" | "any" | "tool", name?: string }
	 */
	private buildToolChoice(
		toolMask?: ToolMaskState,
	): { type: "auto" | "any" | "tool"; name?: string } | undefined {
		// 如果没有 toolMask 或不支持 tool_choice
		if (!toolMask || !currentModelSupportsToolChoice()) {
			return undefined; // 使用默认行为
		}

		// 如果有强制工具，使用 tool_choice 指定
		if (toolMask.requiredTool) {
			return {
				type: "tool",
				name: toolMask.requiredTool,
			};
		}

		return { type: "auto" };
	}

	/**
	 * 如果不支持 tool_choice 但需要强制工具，使用 Prefill Response 技术
	 * 在消息末尾添加预填充的 assistant 消息
	 * 注意：Anthropic 扩展思考模式不支持预填充
	 */
	/**
	 * 如果不支持 tool_choice 但需要引导工具调用，使用 Prefill Response 技术
	 *
	 * tool_choice vs prefill 的区别：
	 * - tool_choice: 需要完整工具名，强制调用特定工具
	 * - prefill: 使用共同前缀，让模型在同类工具中选择
	 */
	private applyPrefillIfNeeded(
		messages: ChatMessage[],
		toolMask?: ToolMaskState,
	): ChatMessage[] {
		// 如果支持 tool_choice，不需要 prefill
		if (currentModelSupportsToolChoice()) {
			return messages;
		}

		// 如果没有工具前缀，不需要 prefill
		if (!toolMask?.toolPrefix) {
			return messages;
		}

		// 如果启用了扩展思考模式，不能使用 prefill
		if (isThinkingEnabled() && currentModelSupportsThinking()) {
			return messages;
		}

		// 使用 prefill 引导模型调用指定前缀的工具
		// 例如 toolPrefix = "plan_" 会引导模型调用 plan_read/plan_write/plan_edit
		return [
			...messages,
			{
				role: "assistant",
				content: `I'll call the ${toolMask.toolPrefix}`,
			},
		];
	}

	/**
	 * 流式聊天请求
	 * 使用 SSE (Server-Sent Events) 格式解析 Anthropic 流式响应
	 * @param messages 消息列表
	 * @param tools 工具列表（可选）
	 * @param options 流式选项，包含可选的 AbortSignal 用于外部取消
	 */
	async *streamChat(
		messages: ChatMessage[],
		tools?: OpenAITool[],
		options?: StreamOptions,
	): AsyncGenerator<AIStreamChunk> {
		const baseUrl =
			this.config.baseUrl?.replace(/\/$/, "") || "https://api.anthropic.com/v1";
		const url = `${baseUrl}/messages`;

		// 提取 system 消息
		const systemPrompt = extractSystemMessage(messages);

		// 如果不支持 tool_choice 但需要强制工具，使用 prefill
		const processedMessages = this.applyPrefillIfNeeded(messages, options?.toolMask);

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toAnthropicMessages(processedMessages),
			max_tokens: 4096,
			stream: true, // 启用流式响应
		};

		if (systemPrompt) {
			body.system = systemPrompt;
		}

		if (tools && tools.length > 0) {
			body.tools = openAIToolsToAnthropic(tools);
			// 根据 toolMask 设置 tool_choice
			const toolChoice = this.buildToolChoice(options?.toolMask);
			if (toolChoice) {
				body.tool_choice = toolChoice;
			}
		}

		// 如果启用思考模式且当前模型支持，添加 thinking 参数
		// Anthropic 使用 thinking 参数（与 OpenAI 的 enable_thinking 不同）
		if (isThinkingEnabled() && currentModelSupportsThinking()) {
			body.thinking = {
				type: "enabled",
				budget_tokens: 10000, // 默认思考预算
			};
		}

		// 创建内部 AbortController 用于超时
		const timeoutController = new AbortController();
		// 连接超时：等待服务器响应（使用配置的 timeout）
		const connectionTimeoutId = setTimeout(
			() => timeoutController.abort(),
			this.config.timeout || 180000,
		);

		// 如果有外部 signal，监听它并联动中止
		const externalSignal = options?.signal;
		let externalAbortHandler: (() => void) | undefined;

		if (externalSignal) {
			if (externalSignal.aborted) {
				clearTimeout(connectionTimeoutId);
				throw new DOMException("Request was aborted", "AbortError");
			}
			externalAbortHandler = () => timeoutController.abort();
			externalSignal.addEventListener("abort", externalAbortHandler);
		}

		// 活动超时：流式传输期间，每次收到数据重置
		const streamTimeout = this.config.timeout || 600000;
		let activityTimeoutId: ReturnType<typeof setTimeout> | null = null;

		const resetActivityTimeout = () => {
			if (activityTimeoutId) {
				clearTimeout(activityTimeoutId);
			}
			activityTimeoutId = setTimeout(() => {
				timeoutController.abort();
			}, streamTimeout);
		};

		const clearActivityTimeout = () => {
			if (activityTimeoutId) {
				clearTimeout(activityTimeoutId);
				activityTimeoutId = null;
			}
		};

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"x-api-key": this.config.apiKey ?? "",
					"anthropic-version": "2023-06-01",
					"anthropic-beta": "interleaved-thinking-2025-05-14",
					"Content-Type": "application/json",
				},
				// 使用 stableStringify 确保键顺序一致，提高 KV 缓存命中率
				body: stableStringify(body),
				signal: timeoutController.signal,
			});

			clearTimeout(connectionTimeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
				);
			}

			if (!response.body) {
				throw new Error("Response body is null");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			// 跟踪当前内容块状态
			// Anthropic 的流式响应使用 content_block 来区分不同类型的内容
			type ContentBlock = {
				index: number;
				type: "text" | "tool_use" | "thinking";
				// text block
				text?: string;
				// tool_use block
				id?: string;
				name?: string;
				input?: string; // JSON string, accumulated
				// thinking block
				thinking?: string;
			};

			const contentBlocks: Map<number, ContentBlock> = new Map();
			let currentStopReason: string | null = null;
			let hasYieldedFinish = false;
			// 跟踪 usage 信息
			let inputTokens = 0;
			let outputTokens = 0;

			// 开始流式读取，启动活动超时
			resetActivityTimeout();

			while (true) {
				const { done, value } = await reader.read();

				// 每次收到数据时重置活动超时
				if (!done) {
					resetActivityTimeout();
				}
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();

					// 解析事件类型
					if (trimmed.startsWith("event: ")) {
						// 事件类型在下一行的 data 中处理
						continue;
					}

					if (!trimmed.startsWith("data: ")) continue;

					const data = trimmed.slice(6);
					if (!data || data === "[DONE]") continue;

					try {
						const event = JSON.parse(data);

						switch (event.type) {
							case "message_start":
								// 消息开始，获取初始 usage 信息
								if (event.message?.usage) {
									inputTokens = event.message.usage.input_tokens || 0;
									outputTokens = event.message.usage.output_tokens || 0;
								}
								break;

							case "content_block_start": {
								// 新的内容块开始
								const index = event.index as number;
								const blockType = event.content_block?.type as string;
								const block: ContentBlock = {
									index,
									type: blockType as "text" | "tool_use" | "thinking",
								};

								if (blockType === "text") {
									block.text = event.content_block?.text || "";
								} else if (blockType === "tool_use") {
									block.id = event.content_block?.id || "";
									block.name = event.content_block?.name || "";
									block.input = "";
								} else if (blockType === "thinking") {
									block.thinking = event.content_block?.thinking || "";
								}

								contentBlocks.set(index, block);
								break;
							}

							case "content_block_delta": {
								// 内容块增量更新
								const index = event.index as number;
								const block = contentBlocks.get(index);
								if (!block) break;

								const delta = event.delta;
								if (!delta) break;

								if (delta.type === "text_delta" && delta.text) {
									block.text = (block.text || "") + delta.text;
									// 立即 yield 文本内容
									yield {
										delta: { content: delta.text },
									};
								} else if (
									delta.type === "input_json_delta" &&
									delta.partial_json
								) {
									block.input = (block.input || "") + delta.partial_json;
								} else if (delta.type === "thinking_delta" && delta.thinking) {
									block.thinking = (block.thinking || "") + delta.thinking;
									// yield 思考内容
									yield {
										delta: { reasoning_content: delta.thinking },
									};
								}
								break;
							}

							case "content_block_stop":
								// 内容块结束，不需要特别处理
								break;

							case "message_delta": {
								// 消息增量，包含 stop_reason 和 usage
								if (event.delta?.stop_reason) {
									currentStopReason = event.delta.stop_reason;
								}
								// 更新 output_tokens（Anthropic 在 message_delta 中返回累积的 output_tokens）
								if (event.usage?.output_tokens) {
									outputTokens = event.usage.output_tokens;
								}
								break;
							}

							case "message_stop": {
								// 消息结束
								hasYieldedFinish = true;

								// 收集所有 tool_use 块
								const toolCalls: ToolCall[] = [];
								for (const [, block] of contentBlocks) {
									if (block.type === "tool_use" && block.id && block.name) {
										toolCalls.push({
											id: block.id,
											type: "function",
											function: {
												name: block.name,
												arguments: block.input || "{}",
											},
										});
									}
								}

								const finishReason = this.parseStopReason(currentStopReason);

								// 构建 usage 信息
								const usageInfo =
									inputTokens > 0 || outputTokens > 0
										? {
												prompt_tokens: inputTokens,
												completion_tokens: outputTokens,
												total_tokens: inputTokens + outputTokens,
											}
										: undefined;

								if (toolCalls.length > 0) {
									yield {
										delta: {
											content: "",
											tool_calls: toolCalls,
										},
										finish_reason: "tool_calls",
										usage: usageInfo,
									};
								} else {
									yield {
										delta: { content: "" },
										finish_reason: finishReason,
										usage: usageInfo,
									};
								}
								return;
							}

							case "error": {
								throw new Error(
									`Anthropic streaming error: ${event.error?.message || "Unknown error"}`,
								);
							}
						}
					} catch (e) {
						// JSON 解析失败或其他错误，继续处理下一行
						if (
							e instanceof Error &&
							e.message.startsWith("Anthropic streaming error")
						) {
							throw e;
						}
						continue;
					}
				}
			}

			// 流正常结束（reader.read() 返回 done: true）
			// 如果还没有 yield 过 finish_reason，补充一个 stop
			if (!hasYieldedFinish) {
				yield { delta: { content: "" }, finish_reason: "stop" };
			}
		} finally {
			clearTimeout(connectionTimeoutId);
			clearActivityTimeout();
			if (externalSignal && externalAbortHandler) {
				externalSignal.removeEventListener("abort", externalAbortHandler);
			}
		}
	}
}
