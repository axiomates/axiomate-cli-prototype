/**
 * 消息队列
 * 保证用户发送的多条消息按顺序处理
 */

import type { FileReference } from "../../models/input.js";

/**
 * 队列中的消息
 */
export type QueuedMessage = {
	/** 消息 ID */
	id: string;
	/** 消息内容 */
	content: string;
	/** 附带的文件 */
	files: FileReference[];
	/** 创建时间 */
	createdAt: number;
	/** Plan mode snapshot (captured at enqueue time) */
	planMode: boolean;
};

/**
 * 流式内容（分离思考和正式内容）
 */
export type StreamContent = {
	/** 思考内容（累积） */
	reasoning: string;
	/** 正式内容（累积） */
	content: string;
};

/**
 * 流式回调
 */
export type StreamingCallbacks = {
	/** 流式开始 */
	onStreamStart?: (id: string) => void;
	/** 流式内容更新 (content 是累积的完整内容，包含思考和正式内容) */
	onStreamChunk?: (id: string, content: StreamContent) => void;
	/** 流式结束 */
	onStreamEnd?: (id: string, finalContent: StreamContent) => void;
};

/**
 * 消息队列回调
 */
export type MessageQueueCallbacks = {
	/** 消息开始处理 */
	onMessageStart: (id: string) => void;
	/** 消息处理完成 */
	onMessageComplete: (id: string, response: string) => void;
	/** 消息处理失败 */
	onMessageError: (id: string, error: Error) => void;
	/** 队列已空 */
	onQueueEmpty: () => void;
	/** 队列被停止（可选），传递清空的消息数和当前流式内容（如果有） */
	onStopped?: (queuedCount: number, currentContent?: StreamContent) => void;
} & StreamingCallbacks;

/**
 * 消息处理器流式回调
 */
export type ProcessorStreamCallbacks = {
	onStart?: () => void;
	onChunk?: (content: StreamContent) => void;
	onEnd?: (finalContent: StreamContent) => void;
};

/**
 * 消息处理器选项
 */
export type ProcessorOptions = {
	/** 流式回调 */
	streamCallbacks?: ProcessorStreamCallbacks;
	/** 用于取消请求的 AbortSignal */
	signal?: AbortSignal;
};

/**
 * 消息处理器类型
 * @param message 消息
 * @param options 处理器选项（包含流式回调和 AbortSignal）
 */
export type MessageProcessor = (
	message: QueuedMessage,
	options?: ProcessorOptions,
) => Promise<string>;

/**
 * 正在处理的消息信息
 */
type ProcessingMessage = {
	/** 队列消息 */
	message: QueuedMessage;
	/** 用于取消请求的 AbortController */
	abortController: AbortController;
	/** 当前累积的流式内容 */
	currentContent: StreamContent;
};

/**
 * 消息队列类
 * 确保消息按顺序处理，一次只处理一条
 */
export class MessageQueue {
	private queue: QueuedMessage[] = [];
	private processing: boolean = false;
	private stopped: boolean = false;
	private callbacks: MessageQueueCallbacks;
	private processor: MessageProcessor;
	private idCounter: number = 0;
	/** 当前正在处理的消息及其 AbortController */
	private currentProcessing: ProcessingMessage | null = null;

	constructor(processor: MessageProcessor, callbacks: MessageQueueCallbacks) {
		this.processor = processor;
		this.callbacks = callbacks;
	}

	/**
	 * 添加消息到队列
	 * @param content 消息内容
	 * @param files 附带的文件
	 * @param planMode Plan mode snapshot (captured at enqueue time)
	 * @returns 消息 ID
	 */
	enqueue(content: string, files: FileReference[] = [], planMode: boolean = false): string {
		// 新消息入队时重置停止状态
		this.stopped = false;

		const id = `msg_${++this.idCounter}_${Date.now()}`;
		const message: QueuedMessage = {
			id,
			content,
			files,
			createdAt: Date.now(),
			planMode,
		};

		this.queue.push(message);

		// 如果当前没有在处理，开始处理
		if (!this.processing) {
			this.processNext();
		}

		return id;
	}

	/**
	 * 清空队列
	 */
	clear(): void {
		this.queue = [];
	}

	/**
	 * 停止当前处理并清空队列
	 * 当前正在执行的请求会被中止
	 * @returns 被清空的消息数量（不含当前正在处理的）
	 */
	stop(): number {
		const queuedCount = this.queue.length;
		this.stopped = true;
		this.queue = [];

		// 获取当前流式内容（如果有）
		const currentContent = this.currentProcessing?.currentContent;

		// 中止当前正在执行的请求
		if (this.currentProcessing) {
			this.currentProcessing.abortController.abort();
		}

		// 通知停止，传递当前流式内容
		this.callbacks.onStopped?.(queuedCount, currentContent);

		return queuedCount;
	}

	/**
	 * 是否已停止
	 */
	isStopped(): boolean {
		return this.stopped;
	}

	/**
	 * 获取队列长度
	 */
	getQueueLength(): number {
		return this.queue.length;
	}

	/**
	 * 是否正在处理
	 */
	isProcessing(): boolean {
		return this.processing;
	}

	/**
	 * 获取当前正在处理的消息 ID
	 * @returns 消息 ID，如果没有正在处理的消息则返回 null
	 */
	getCurrentMessageId(): string | null {
		return this.currentProcessing?.message.id ?? null;
	}

	/**
	 * 处理下一条消息
	 */
	private async processNext(): Promise<void> {
		if (this.processing || this.queue.length === 0 || this.stopped) {
			if (this.queue.length === 0 && !this.processing && !this.stopped) {
				this.callbacks.onQueueEmpty();
			}
			return;
		}

		this.processing = true;
		const message = this.queue.shift()!;

		// 创建 AbortController 用于取消请求
		const abortController = new AbortController();
		this.currentProcessing = {
			message,
			abortController,
			currentContent: { reasoning: "", content: "" },
		};

		this.callbacks.onMessageStart(message.id);

		// 构建流式回调（转发到队列回调，并跟踪当前内容）
		const streamCallbacks: ProcessorStreamCallbacks = {
			onStart: () => {
				if (!this.stopped) {
					this.callbacks.onStreamStart?.(message.id);
				}
			},
			onChunk: (content: StreamContent) => {
				// 更新当前处理的内容（用于 stop 时获取）
				if (this.currentProcessing) {
					this.currentProcessing.currentContent = content;
				}
				if (!this.stopped) {
					this.callbacks.onStreamChunk?.(message.id, content);
				}
			},
			onEnd: (finalContent: StreamContent) => {
				if (!this.stopped) {
					this.callbacks.onStreamEnd?.(message.id, finalContent);
				}
			},
		};

		try {
			const response = await this.processor(message, {
				streamCallbacks,
				signal: abortController.signal,
			});
			// 如果在处理过程中被停止，不调用完成回调
			if (!this.stopped) {
				this.callbacks.onMessageComplete(message.id, response);
			}
		} catch (error) {
			// 如果是中止错误且已停止，忽略
			const isAbortError =
				error instanceof Error && error.name === "AbortError";
			if (isAbortError && this.stopped) {
				// 请求被主动中止，不报错
				return;
			}
			// 如果在处理过程中被停止，不调用错误回调
			if (!this.stopped) {
				const err = error instanceof Error ? error : new Error(String(error));
				this.callbacks.onMessageError(message.id, err);
			}
		} finally {
			this.currentProcessing = null;
			this.processing = false;
			// 如果没有被停止，继续处理下一条
			if (!this.stopped) {
				this.processNext();
			}
		}
	}
}
