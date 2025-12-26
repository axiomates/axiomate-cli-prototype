/**
 * OpenAI 客户端实现
 * 支持 OpenAI API 及兼容 API (如 Azure OpenAI, vLLM, Ollama 等)
 */

import type {
	IAIClient,
	AIClientConfig,
	ChatMessage,
	AIResponse,
	AIStreamChunk,
	OpenAITool,
	FinishReason,
	ToolCall,
	StreamOptions,
} from "../types.js";
import { toOpenAIMessages, parseOpenAIToolCalls } from "../adapters/openai.js";
import { isThinkingEnabled, currentModelSupportsThinking } from "../../../utils/config.js";

/**
 * OpenAI API 响应类型
 */
type OpenAIAPIResponse = {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: string;
			content: string | null;
			tool_calls?: Array<{
				id: string;
				type: string;
				function: {
					name: string;
					arguments: string;
				};
			}>;
		};
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

/**
 * OpenAI 客户端
 */
export class OpenAIClient implements IAIClient {
	private config: AIClientConfig;

	constructor(config: AIClientConfig) {
		this.config = {
			baseUrl: "https://api.openai.com",
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
	): Promise<AIResponse> {
		// 构建 URL：baseUrl 应该已经包含 /v1，只需添加 /chat/completions
		const baseUrl =
			this.config.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
		const url = `${baseUrl}/chat/completions`;

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toOpenAIMessages(messages),
		};

		if (tools && tools.length > 0) {
			body.tools = tools;
			body.tool_choice = "auto";
		}

		// 如果启用思考模式且当前模型支持，添加 enable_thinking 参数
		if (isThinkingEnabled() && currentModelSupportsThinking()) {
			body.enable_thinking = true;
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
						Authorization: `Bearer ${this.config.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
					);
				}

				const data = (await response.json()) as OpenAIAPIResponse;
				return this.parseResponse(data);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// 如果是最后一次尝试或者是中止错误，直接抛出
				if (attempt === maxRetries - 1 || lastError.name === "AbortError") {
					throw lastError;
				}

				// 等待后重试
				await new Promise((resolve) =>
					setTimeout(resolve, Math.pow(2, attempt) * 1000),
				);
			}
		}

		throw lastError || new Error("Unknown error");
	}

	private parseResponse(data: OpenAIAPIResponse): AIResponse {
		const choice = data.choices[0];
		if (!choice) {
			throw new Error("No response from OpenAI API");
		}

		const message: ChatMessage = {
			role: "assistant",
			content: choice.message.content || "",
		};

		// 解析 tool_calls
		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			message.tool_calls = parseOpenAIToolCalls(choice.message.tool_calls);
		}

		// 转换 finish_reason
		const finishReason = this.parseFinishReason(choice.finish_reason);

		return {
			message,
			finish_reason: finishReason,
			usage: data.usage,
		};
	}

	/**
	 * 解析 finish_reason
	 */
	private parseFinishReason(reason: string | null | undefined): FinishReason {
		switch (reason) {
			case "stop":
				return "stop";
			case "eos":
				return "eos";
			case "tool_calls":
				return "tool_calls";
			case "length":
				return "length";
			default:
				return "stop";
		}
	}

	/**
	 * 流式聊天请求
	 * 使用 SSE (Server-Sent Events) 格式解析流式响应
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
			this.config.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
		const url = `${baseUrl}/chat/completions`;

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages: toOpenAIMessages(messages),
			stream: true, // 启用流式响应
		};

		if (tools && tools.length > 0) {
			body.tools = tools;
			body.tool_choice = "auto";
		}

		// 如果启用思考模式且当前模型支持，添加 enable_thinking 参数
		if (isThinkingEnabled() && currentModelSupportsThinking()) {
			body.enable_thinking = true;
		}

		// 创建内部 AbortController 用于超时
		const timeoutController = new AbortController();
		const timeoutId = setTimeout(
			() => timeoutController.abort(),
			this.config.timeout || 120000, // 流式响应使用更长的超时
		);

		// 如果有外部 signal，监听它并联动中止
		const externalSignal = options?.signal;
		let externalAbortHandler: (() => void) | undefined;

		if (externalSignal) {
			// 如果外部 signal 已经 aborted，立即中止
			if (externalSignal.aborted) {
				clearTimeout(timeoutId);
				throw new DOMException("Request was aborted", "AbortError");
			}
			// 监听外部 signal 的 abort 事件
			externalAbortHandler = () => timeoutController.abort();
			externalSignal.addEventListener("abort", externalAbortHandler);
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.config.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: timeoutController.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
				);
			}

			if (!response.body) {
				throw new Error("Response body is null");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			// 累积 tool_calls (流式响应中会分多个 chunk 返回)
			const accumulatedToolCalls: Map<
				number,
				{
					id: string;
					type: string;
					function: { name: string; arguments: string };
				}
			> = new Map();

			// 跟踪是否已经 yield 过带 finish_reason 的 chunk
			let hasYieldedFinish = false;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // 保留最后未完成的行

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith("data: ")) continue;

					const data = trimmed.slice(6); // 去掉 "data: "
					if (data === "[DONE]") {
						// 如果还没有 yield 过 finish_reason，补充一个 stop
						if (!hasYieldedFinish) {
							yield { delta: { content: "" }, finish_reason: "stop" };
						}
						return;
					}

					try {
						const chunk = JSON.parse(data);
						if (!chunk.choices?.length) continue;

						const choice = chunk.choices[0];
						const delta = choice.delta || {};

						// 处理 tool_calls 增量更新
						if (delta.tool_calls) {
							for (const tc of delta.tool_calls) {
								const existing = accumulatedToolCalls.get(tc.index);
								if (existing) {
									// 累积 arguments
									if (tc.function?.arguments) {
										existing.function.arguments += tc.function.arguments;
									}
									// 补充可能后来才收到的 id
									if (tc.id && !existing.id) {
										existing.id = tc.id;
									}
								} else {
									// 新的 tool_call
									// 某些 API 可能不返回 id，需要生成一个
									const callId =
										tc.id || `call_${Date.now()}_${tc.index}`;
									accumulatedToolCalls.set(tc.index, {
										id: callId,
										type: tc.type || "function",
										function: {
											name: tc.function?.name || "",
											arguments: tc.function?.arguments || "",
										},
									});
								}
							}
						}

						// 构建 AIStreamChunk（分离 reasoning_content 和 content）
						const streamChunk: AIStreamChunk = {
							delta: {
								content: delta.content || "",
								reasoning_content: delta.reasoning_content || "",
							},
						};

						// 如果是结束帧，设置 finish_reason
						if (choice.finish_reason) {
							hasYieldedFinish = true;

							// 如果有累积的 tool_calls，不管 finish_reason 是什么，都要附加
							// 某些 API（如 SiliconFlow）可能返回 finish_reason="stop" 但仍有 tool_calls
							if (accumulatedToolCalls.size > 0) {
								const toolCalls: ToolCall[] = [];
								for (const [, tc] of accumulatedToolCalls) {
									// 只添加有效的 tool call（name 不为空）
									if (tc.function.name) {
										toolCalls.push({
											id: tc.id,
											type: "function",
											function: {
												name: tc.function.name,
												arguments: tc.function.arguments,
											},
										});
									}
								}
								// 只有当有有效的 tool calls 时才设置
								if (toolCalls.length > 0) {
									streamChunk.delta.tool_calls = toolCalls;
									// 强制设置为 tool_calls，确保 service 层能正确处理
									streamChunk.finish_reason = "tool_calls";
								} else {
									streamChunk.finish_reason = this.parseFinishReason(
										choice.finish_reason,
									);
								}
							} else {
								streamChunk.finish_reason = this.parseFinishReason(
									choice.finish_reason,
								);
							}
						}

						yield streamChunk;
					} catch {
						// JSON 解析失败，跳过这行
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
			clearTimeout(timeoutId);
			// 清理外部 signal 监听器
			if (externalSignal && externalAbortHandler) {
				externalSignal.removeEventListener("abort", externalAbortHandler);
			}
		}
	}
}
