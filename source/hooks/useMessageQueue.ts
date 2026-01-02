import { useRef, useEffect, useCallback } from "react";
import type { Message } from "../components/MessageOutput.js";
import type { IAIService, MatchContext } from "../services/ai/index.js";
import type { FileReference } from "../models/input.js";
import { buildMessageContent } from "../services/ai/contentBuilder.js";
import {
	MessageQueue,
	type QueuedMessage,
	type ProcessorOptions,
	type StreamContent,
} from "../services/ai/messageQueue.js";
import { t } from "../i18n/index.js";

export type MessageQueueState = {
	/** Reference to the message queue */
	messageQueueRef: React.RefObject<MessageQueue | null>;
	/** Stop processing and clear queue */
	stopProcessing: () => void;
	/** Check if queue is processing */
	isProcessing: () => boolean;
	/** Enqueue a message */
	enqueue: (
		content: string,
		files: FileReference[],
		planMode: boolean,
	) => string;
};

type MessageQueueOptions = {
	aiServiceRef: React.RefObject<IAIService | null>;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
	compactRef: React.RefObject<(() => Promise<void>) | null>;
	saveSessionRef: React.RefObject<(() => void) | null>;
	askUserContentOffsetRef: React.RefObject<number>;
	askUserReasoningOffsetRef: React.RefObject<number>;
	updateUsageStatus: () => void;
	createAskUserCallback: (
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => (question: string, options: string[]) => Promise<string>;
};

/**
 * Hook for managing the message queue and streaming
 */
export function useMessageQueue(
	options: MessageQueueOptions,
): MessageQueueState {
	const {
		aiServiceRef,
		setMessages,
		setIsLoading,
		compactRef,
		saveSessionRef,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
		updateUsageStatus,
		createAskUserCallback,
	} = options;

	const messageQueueRef = useRef<MessageQueue | null>(null);
	const currentStreamingIdRef = useRef<string | null>(null);

	// Message processor function
	const processMessage = useCallback(
		async (
			queuedMessage: QueuedMessage,
			processorOptions?: ProcessorOptions,
		): Promise<string> => {
			const aiService = aiServiceRef.current;
			if (!aiService) {
				throw new Error(t("ai.notConfigured"));
			}

			const cwd = process.cwd();

			// Estimate message size first, check if compact is needed
			const roughEstimate = await buildMessageContent({
				userMessage: queuedMessage.content,
				files: queuedMessage.files,
				cwd,
				availableTokens: Infinity,
			});

			let compactCheck = aiService.shouldCompact(roughEstimate.estimatedTokens);
			if (compactCheck.shouldCompact && compactRef.current) {
				setMessages((prev) => [
					...prev,
					{
						content: t("ai.contextWarning", {
							percent: compactCheck.usagePercent.toFixed(0),
						}),
						type: "system" as const,
						markdown: false,
					},
				]);
				await compactRef.current();
			}

			// Build message content after potential compact
			const availableTokens = aiService.getAvailableTokens();
			const buildResult = await buildMessageContent({
				userMessage: queuedMessage.content,
				files: queuedMessage.files,
				cwd,
				availableTokens,
			});

			// Show truncation notice if needed
			if (buildResult.wasTruncated) {
				setMessages((prev) => [
					...prev,
					{
						content: `${buildResult.truncationNotice}`,
						type: "system" as const,
						markdown: false,
					},
				]);
			}

			// Check if context is full
			compactCheck = aiService.shouldCompact(buildResult.estimatedTokens);
			if (compactCheck.isContextFull) {
				throw new Error(
					t("ai.contextFull", {
						percent: compactCheck.projectedPercent.toFixed(0),
					}),
				);
			}

			// Build context
			const context: MatchContext = {
				cwd,
				selectedFiles: queuedMessage.files.map((f) => f.path),
			};

			// Create ask_user callback
			const onAskUser = createAskUserCallback(setMessages);

			// displayContent 是用户的原始输入（已包含 @文件路径），用于 UI 显示和会话恢复
			// 注意：queuedMessage.content 已经是用户输入的完整内容，不需要再追加文件引用
			const displayContent = queuedMessage.content;

			return aiService.streamMessage(
				buildResult.content,
				context,
				{
					onStart: processorOptions?.streamCallbacks?.onStart,
					onChunk: processorOptions?.streamCallbacks?.onChunk,
					onEnd: processorOptions?.streamCallbacks?.onEnd,
				},
				{ signal: processorOptions?.signal, planMode: queuedMessage.planMode },
				onAskUser,
				displayContent,
			);
		},
		[aiServiceRef, setMessages, compactRef, createAskUserCallback],
	);

	// Initialize message queue
	useEffect(() => {
		messageQueueRef.current = new MessageQueue(processMessage, {
			onMessageStart: (id) => {
				setIsLoading(true);
				currentStreamingIdRef.current = id;
				// Remove queued marker from user message
				setMessages((prev) =>
					prev.map((msg) =>
						msg.queuedMessageId === id
							? { ...msg, queued: false, queuedMessageId: undefined }
							: msg,
					),
				);
			},
			onMessageComplete: (id) => {
				if (currentStreamingIdRef.current === id) {
					currentStreamingIdRef.current = null;
				}
				setIsLoading(false);
				saveSessionRef.current?.();
			},
			onMessageError: (id, error) => {
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				currentStreamingIdRef.current = null;

				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex !== -1) {
						const newMessages = [...prev];
						newMessages[streamingIndex] = {
							...newMessages[streamingIndex],
							content:
								newMessages[streamingIndex].content +
								`\n\nError: ${error.message}`,
							streaming: false,
						};
						return newMessages;
					}
					return [
						...prev,
						{ content: `Error: ${error.message}`, markdown: false },
					];
				});
				setIsLoading(false);
			},
			onQueueEmpty: () => {
				// Queue finished processing
			},
			onStopped: (queuedCount, currentContent) => {
				currentStreamingIdRef.current = null;
				const msg =
					queuedCount > 0 || currentContent?.content
						? t("commandHandler.stopSuccess", { count: queuedCount })
						: t("commandHandler.stopNone");

				// Save partial content if any
				if (currentContent?.content && aiServiceRef.current) {
					aiServiceRef.current.savePartialResponse(currentContent.content);
					saveSessionRef.current?.();
				}

				// Mark streaming message as ended
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((m) => m.streaming);
					if (streamingIndex !== -1) {
						const newMessages = [...prev];
						newMessages[streamingIndex] = {
							...newMessages[streamingIndex],
							streaming: false,
							reasoningCollapsed:
								(newMessages[streamingIndex]?.reasoning?.length ?? 0) > 0,
						};
						return [
							...newMessages,
							{ content: msg, type: "system", markdown: false },
						];
					}
					return [...prev, { content: msg, type: "system", markdown: false }];
				});
				setIsLoading(false);
				updateUsageStatus();
			},
			// Stream callbacks
			onStreamStart: (id) => {
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				// Reset askuser offsets
				askUserContentOffsetRef.current = 0;
				askUserReasoningOffsetRef.current = 0;
				// Add empty streaming message
				setMessages((prev) => [
					...prev,
					{ content: "", reasoning: "", streaming: true },
				]);
			},
			onStreamChunk: (id, streamContent: StreamContent) => {
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex === -1) {
						return prev;
					}
					// Apply askuser offset if any
					const contentOffset = askUserContentOffsetRef.current;
					const reasoningOffset = askUserReasoningOffsetRef.current;
					const displayContent =
						contentOffset > 0
							? streamContent.content.substring(contentOffset)
							: streamContent.content;
					const displayReasoning =
						reasoningOffset > 0
							? streamContent.reasoning.substring(reasoningOffset)
							: streamContent.reasoning;
					const newMessages = [...prev];
					newMessages[streamingIndex] = {
						...newMessages[streamingIndex],
						content: displayContent,
						reasoning: displayReasoning,
						reasoningCollapsed: false,
					};
					return newMessages;
				});
			},
			onStreamEnd: (id, finalContent: StreamContent) => {
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex === -1) {
						return prev;
					}
					// Apply askuser offset if any
					const contentOffset = askUserContentOffsetRef.current;
					const reasoningOffset = askUserReasoningOffsetRef.current;
					const displayContent =
						contentOffset > 0
							? finalContent.content.substring(contentOffset)
							: finalContent.content;
					const displayReasoning =
						reasoningOffset > 0
							? finalContent.reasoning.substring(reasoningOffset)
							: finalContent.reasoning;
					const newMessages = [...prev];
					newMessages[streamingIndex] = {
						...newMessages[streamingIndex],
						content: displayContent,
						reasoning: displayReasoning,
						streaming: false,
						reasoningCollapsed: displayReasoning.length > 0,
					};
					// Auto-fold previous messages' reasoning and askUserQA
					for (let i = streamingIndex - 1; i >= 0; i--) {
						const msg = newMessages[i];
						if (!msg) continue;
						const needsFoldReasoning =
							(msg.reasoning?.length ?? 0) > 0 && !msg.reasoningCollapsed;
						const needsFoldAskUser =
							msg.askUserQA && msg.askUserCollapsed === false;
						if (needsFoldReasoning || needsFoldAskUser) {
							newMessages[i] = {
								...msg,
								reasoningCollapsed: needsFoldReasoning
									? true
									: msg.reasoningCollapsed,
								askUserCollapsed: needsFoldAskUser
									? true
									: msg.askUserCollapsed,
							};
						}
						if (msg.type === "user") {
							break;
						}
					}
					return newMessages;
				});
				// Reset askuser offsets
				askUserContentOffsetRef.current = 0;
				askUserReasoningOffsetRef.current = 0;
				updateUsageStatus();
			},
		});

		return () => {
			messageQueueRef.current?.clear();
		};
	}, [
		processMessage,
		aiServiceRef,
		setMessages,
		setIsLoading,
		saveSessionRef,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
		updateUsageStatus,
	]);

	// Stop processing
	const stopProcessing = useCallback(() => {
		messageQueueRef.current?.stop();
	}, []);

	// Check if processing
	const isProcessing = useCallback(() => {
		return messageQueueRef.current?.isProcessing() ?? false;
	}, []);

	// Enqueue a message
	const enqueue = useCallback(
		(content: string, files: FileReference[], planMode: boolean) => {
			return messageQueueRef.current?.enqueue(content, files, planMode) ?? "";
		},
		[],
	);

	return {
		messageQueueRef,
		stopProcessing,
		isProcessing,
		enqueue,
	};
}
