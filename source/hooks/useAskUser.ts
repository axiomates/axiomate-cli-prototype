import { useState, useCallback, useRef } from "react";
import type { Message } from "../components/MessageOutput.js";

export type AskUserState = {
	/** Current pending ask_user request, or null if none */
	pendingAskUser: {
		question: string;
		options: string[];
		onResolve: (answer: string) => void;
	} | null;
	/** Handle user selection from ask_user menu */
	handleAskUserSelect: (answer: string) => void;
	/** Handle user cancellation of ask_user menu */
	handleAskUserCancel: () => void;
	/** Create an onAskUser callback for AI service */
	createAskUserCallback: (
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => (question: string, options: string[]) => Promise<string>;
	/** Content offset ref for resuming stream after askuser */
	askUserContentOffsetRef: React.RefObject<number>;
	/** Reasoning offset ref for resuming stream after askuser */
	askUserReasoningOffsetRef: React.RefObject<number>;
};

/**
 * Hook for managing ask_user interaction state
 */
export function useAskUser(): AskUserState {
	const [pendingAskUser, setPendingAskUser] = useState<{
		question: string;
		options: string[];
		onResolve: (answer: string) => void;
	} | null>(null);

	// Offsets for resuming stream content after askuser response
	const askUserContentOffsetRef = useRef<number>(0);
	const askUserReasoningOffsetRef = useRef<number>(0);

	// Handle user selection
	const handleAskUserSelect = useCallback(
		(answer: string) => {
			if (pendingAskUser) {
				pendingAskUser.onResolve(answer);
				setPendingAskUser(null);
			}
		},
		[pendingAskUser],
	);

	// Handle user cancellation
	const handleAskUserCancel = useCallback(() => {
		if (pendingAskUser) {
			pendingAskUser.onResolve(""); // Empty string indicates cancellation
			setPendingAskUser(null);
		}
	}, [pendingAskUser]);

	// Create the onAskUser callback for AI service
	const createAskUserCallback = useCallback(
		(setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
			return async (
				question: string,
				askOptions: string[],
			): Promise<string> => {
				// When AI calls ask_user, temporarily end the streaming message
				setMessages((prev) => {
					return prev.map((msg) => {
						if (msg.streaming) {
							// Temporarily end streaming (waiting for user input)
							return { ...msg, streaming: false };
						}
						return msg;
					});
				});

				return new Promise((resolve) => {
					setPendingAskUser({
						question,
						options: askOptions,
						onResolve: (answer: string) => {
							// After user answers:
							// 1. Attach Q&A to current AI message (streaming stays false)
							// 2. Create a new streaming message for AI's follow-up
							// 3. Record current content length as offset for onChunk
							setMessages((prev) => {
								const newMessages = [...prev];
								// Find the last non-user message (should be AI's reply)
								for (let i = newMessages.length - 1; i >= 0; i--) {
									const msg = newMessages[i];
									if (
										msg &&
										msg.type !== "user" &&
										msg.type !== "user-answer"
									) {
										// Record current content length as offset
										const currentContentLen = msg.content?.length ?? 0;
										const currentReasoningLen = msg.reasoning?.length ?? 0;
										askUserContentOffsetRef.current =
											currentContentLen > 0 ? currentContentLen + 1 : 0;
										askUserReasoningOffsetRef.current = currentReasoningLen;
										// Attach Q&A to this message
										newMessages[i] = {
											...msg,
											askUserQA: {
												question,
												options: askOptions,
												answer,
											},
											askUserCollapsed: false, // Expanded by default
										};
										break;
									}
								}
								// Add a new streaming message for AI's follow-up
								newMessages.push({
									content: "",
									reasoning: "",
									streaming: true,
								});
								return newMessages;
							});
							resolve(answer);
						},
					});
				});
			};
		},
		[],
	);

	return {
		pendingAskUser,
		handleAskUserSelect,
		handleAskUserCancel,
		createAskUserCallback,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
	};
}
