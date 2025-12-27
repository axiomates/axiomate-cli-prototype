import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	MessageQueue,
	type MessageProcessor,
	type MessageQueueCallbacks,
	type QueuedMessage,
	type StreamContent,
} from "../../../source/services/ai/messageQueue.js";

describe("MessageQueue", () => {
	let mockProcessor: MessageProcessor;
	let mockCallbacks: MessageQueueCallbacks;

	beforeEach(() => {
		mockProcessor = vi.fn().mockResolvedValue("response");
		mockCallbacks = {
			onMessageStart: vi.fn(),
			onMessageComplete: vi.fn(),
			onMessageError: vi.fn(),
			onQueueEmpty: vi.fn(),
			onStopped: vi.fn(),
			onStreamStart: vi.fn(),
			onStreamChunk: vi.fn(),
			onStreamEnd: vi.fn(),
		};
	});

	describe("constructor", () => {
		it("should create a message queue", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			expect(queue).toBeInstanceOf(MessageQueue);
		});
	});

	describe("enqueue", () => {
		it("should add message to queue and return id", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			const id = queue.enqueue("test message");

			expect(id).toMatch(/^msg_\d+_\d+$/);
		});

		it("should start processing immediately if not already processing", async () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			queue.enqueue("test message");

			// 等待处理完成
			await vi.waitFor(() => {
				expect(mockCallbacks.onMessageStart).toHaveBeenCalled();
			});
		});

		it("should include files in message", () => {
			let capturedMessage: QueuedMessage | null = null;
			const processor: MessageProcessor = vi.fn().mockImplementation((msg) => {
				capturedMessage = msg;
				return Promise.resolve("response");
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			const files = [{ path: "/test/file.txt", displayPath: "file.txt" }];
			queue.enqueue("test", files);

			expect(capturedMessage).not.toBeNull();
			expect(capturedMessage!.files).toEqual(files);
		});

		it("should reset stopped state on new enqueue", async () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			queue.stop();
			expect(queue.isStopped()).toBe(true);

			queue.enqueue("new message");
			expect(queue.isStopped()).toBe(false);
		});
	});

	describe("clear", () => {
		it("should clear all pending messages", () => {
			// 使用一个永不 resolve 的 processor 来保持处理状态
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			queue.enqueue("message 1");
			queue.enqueue("message 2");
			queue.enqueue("message 3");

			// 清空队列（第一条正在处理，其余两条在队列中）
			queue.clear();

			expect(queue.getQueueLength()).toBe(0);
		});
	});

	describe("stop", () => {
		it("should stop processing and clear queue", () => {
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			queue.enqueue("message 1");
			queue.enqueue("message 2");

			const clearedCount = queue.stop();

			expect(queue.isStopped()).toBe(true);
			expect(clearedCount).toBe(1); // 第二条消息被清空
		});

		it("should call onStopped callback", () => {
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			queue.enqueue("message 1");
			queue.enqueue("message 2");

			queue.stop();

			expect(mockCallbacks.onStopped).toHaveBeenCalled();
		});

		it("should abort current request", async () => {
			let abortSignal: AbortSignal | undefined;
			const processor: MessageProcessor = vi.fn().mockImplementation((_, options) => {
				abortSignal = options?.signal;
				return new Promise(() => {}); // 永不 resolve
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			queue.enqueue("message");

			await vi.waitFor(() => {
				expect(abortSignal).toBeDefined();
			});

			queue.stop();

			expect(abortSignal!.aborted).toBe(true);
		});
	});

	describe("getQueueLength", () => {
		it("should return 0 for empty queue", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			expect(queue.getQueueLength()).toBe(0);
		});

		it("should return correct count", () => {
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			queue.enqueue("message 1");
			queue.enqueue("message 2");
			queue.enqueue("message 3");

			// 第一条正在处理，其余两条在队列中
			expect(queue.getQueueLength()).toBe(2);
		});
	});

	describe("isProcessing", () => {
		it("should return false initially", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			expect(queue.isProcessing()).toBe(false);
		});

		it("should return true when processing", () => {
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			queue.enqueue("message");

			expect(queue.isProcessing()).toBe(true);
		});
	});

	describe("getCurrentMessageId", () => {
		it("should return null when not processing", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			expect(queue.getCurrentMessageId()).toBeNull();
		});

		it("should return current message id when processing", () => {
			const slowProcessor: MessageProcessor = () => new Promise(() => {});
			const queue = new MessageQueue(slowProcessor, mockCallbacks);

			const id = queue.enqueue("message");

			expect(queue.getCurrentMessageId()).toBe(id);
		});
	});

	describe("isStopped", () => {
		it("should return false initially", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			expect(queue.isStopped()).toBe(false);
		});

		it("should return true after stop", () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			queue.stop();
			expect(queue.isStopped()).toBe(true);
		});
	});

	describe("message processing", () => {
		it("should call onMessageStart when processing begins", async () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onMessageStart).toHaveBeenCalledWith(id);
			});
		});

		it("should call onMessageComplete on success", async () => {
			mockProcessor = vi.fn().mockResolvedValue("success response");
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onMessageComplete).toHaveBeenCalledWith(id, "success response");
			});
		});

		it("should call onMessageError on failure", async () => {
			const error = new Error("test error");
			mockProcessor = vi.fn().mockRejectedValue(error);
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onMessageError).toHaveBeenCalledWith(id, error);
			});
		});

		it("should call onQueueEmpty when all messages processed", async () => {
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onQueueEmpty).toHaveBeenCalled();
			});
		});

		it("should process messages in order", async () => {
			const processedIds: string[] = [];
			const processor: MessageProcessor = vi.fn().mockImplementation((msg) => {
				processedIds.push(msg.id);
				return Promise.resolve("done");
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			const id1 = queue.enqueue("message 1");
			const id2 = queue.enqueue("message 2");
			const id3 = queue.enqueue("message 3");

			await vi.waitFor(() => {
				expect(processedIds).toHaveLength(3);
			});

			expect(processedIds).toEqual([id1, id2, id3]);
		});
	});

	describe("streaming callbacks", () => {
		it("should forward stream start callback", async () => {
			const processor: MessageProcessor = vi.fn().mockImplementation((_, options) => {
				options?.streamCallbacks?.onStart?.();
				return Promise.resolve("done");
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onStreamStart).toHaveBeenCalledWith(id);
			});
		});

		it("should forward stream chunk callback", async () => {
			const content: StreamContent = { reasoning: "thinking", content: "response" };
			const processor: MessageProcessor = vi.fn().mockImplementation((_, options) => {
				options?.streamCallbacks?.onChunk?.(content);
				return Promise.resolve("done");
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onStreamChunk).toHaveBeenCalledWith(id, content);
			});
		});

		it("should forward stream end callback", async () => {
			const finalContent: StreamContent = { reasoning: "done thinking", content: "final" };
			const processor: MessageProcessor = vi.fn().mockImplementation((_, options) => {
				options?.streamCallbacks?.onEnd?.(finalContent);
				return Promise.resolve("done");
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			const id = queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onStreamEnd).toHaveBeenCalledWith(id, finalContent);
			});
		});

		it("should not forward callbacks when stopped", async () => {
			let triggerChunk: (() => void) | null = null;
			const processor: MessageProcessor = vi.fn().mockImplementation((_, options) => {
				return new Promise((resolve) => {
					triggerChunk = () => {
						options?.streamCallbacks?.onChunk?.({ reasoning: "", content: "chunk" });
						resolve("done");
					};
				});
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			queue.enqueue("message");

			await vi.waitFor(() => {
				expect(triggerChunk).not.toBeNull();
			});

			queue.stop();

			// 停止后触发 chunk，不应该调用回调
			triggerChunk?.();

			// onStreamChunk 不应该被调用（因为已停止）
			expect(mockCallbacks.onStreamChunk).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should convert non-Error objects to Error", async () => {
			mockProcessor = vi.fn().mockRejectedValue("string error");
			const queue = new MessageQueue(mockProcessor, mockCallbacks);
			queue.enqueue("message");

			await vi.waitFor(() => {
				expect(mockCallbacks.onMessageError).toHaveBeenCalled();
			});

			const [, error] = (mockCallbacks.onMessageError as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("string error");
		});

		it("should not call onMessageError for abort when stopped", async () => {
			const abortError = new Error("Aborted");
			abortError.name = "AbortError";

			let rejectPromise: ((error: Error) => void) | null = null;
			const processor: MessageProcessor = vi.fn().mockImplementation(() => {
				return new Promise((_, reject) => {
					rejectPromise = reject;
				});
			});

			const queue = new MessageQueue(processor, mockCallbacks);
			queue.enqueue("message");

			await vi.waitFor(() => {
				expect(rejectPromise).not.toBeNull();
			});

			queue.stop();
			rejectPromise!(abortError);

			// 等待一下确保错误被处理
			await new Promise((r) => setTimeout(r, 10));

			// onMessageError 不应该被调用（因为是主动中止且已停止）
			expect(mockCallbacks.onMessageError).not.toHaveBeenCalled();
		});
	});
});
