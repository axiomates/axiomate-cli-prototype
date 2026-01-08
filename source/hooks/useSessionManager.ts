import { useRef, useCallback, useEffect } from "react";
import type { Message } from "../components/StaticMessage.js";
import type { IAIService } from "../services/ai/index.js";
import { createAIServiceFromConfig } from "../services/ai/index.js";
import { getToolRegistry } from "../services/tools/registry.js";
import { initSessionStore, SessionStore } from "../services/ai/sessionStore.js";
import { clearCommandCache } from "../constants/commands.js";
import { clearScreen } from "../utils/platform.js";
import { t } from "../i18n/index.js";

export type SessionManagerState = {
	/** Reference to the SessionStore instance */
	sessionStoreRef: React.RefObject<SessionStore | null>;
	/** Create a new session */
	sessionNew: () => Promise<void>;
	/** Switch to a different session */
	sessionSwitch: (id: string) => Promise<void>;
	/** Delete a session */
	sessionDelete: (id: string) => void;
	/** Clear all sessions and create a new one */
	sessionClear: () => Promise<void>;
	/** Save the current session */
	saveCurrentSession: () => void;
};

type SessionManagerOptions = {
	aiServiceRef: React.RefObject<IAIService | null>;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	resetCollapseState: () => void;
	updateUsageStatus: () => void;
	hasShownWelcomeRef: React.RefObject<boolean>;
};

/**
 * Parse session history into UI messages
 */
function parseHistoryToUIMessages(
	history: Array<{
		role: string;
		content: string;
		displayContent?: string;
		reasoning_content?: string;
		tool_calls?: Array<{
			function: { name: string; arguments: string };
		}>;
	}>,
): Message[] {
	const uiMessages: Message[] = [];
	let pendingAskUserQuestion: {
		question: string;
		options: string[];
	} | null = null;

	for (const msg of history) {
		if (msg.role === "user") {
			// 使用 displayContent（原始用户输入）而非 content（可能包含文件内容）
			uiMessages.push({
				content: msg.displayContent ?? msg.content,
				type: "user",
			});
		} else if (msg.role === "assistant") {
			// Check for ask_user tool calls
			let hasAskUserToolCall = false;
			if (msg.tool_calls) {
				for (const toolCall of msg.tool_calls) {
					if (toolCall.function.name === "askuser_ask") {
						hasAskUserToolCall = true;
						try {
							const args = JSON.parse(toolCall.function.arguments);
							const question = args.question || "";
							let options: string[] = [];
							if (args.options) {
								try {
									const parsed = JSON.parse(args.options);
									if (Array.isArray(parsed)) {
										options = parsed.map(String);
									}
								} catch {
									// Ignore parse errors
								}
							}
							pendingAskUserQuestion = { question, options };
						} catch {
							// Ignore parse errors
						}
					}
				}
			}
			// Add assistant content if present
			if (msg.content || msg.reasoning_content || hasAskUserToolCall) {
				uiMessages.push({
					content: msg.content || "",
					reasoning: msg.reasoning_content || "",
					reasoningCollapsed: true, // Collapsed by default when restored
				});
			}
		} else if (msg.role === "tool" && msg.content) {
			// Parse tool message, extract ask_user answer
			const content = msg.content;
			const askUserMatch = content.match(/^\[Ask User\] User answered: (.+)$/s);
			if (askUserMatch && pendingAskUserQuestion) {
				// Attach Q&A to the last assistant message
				for (let i = uiMessages.length - 1; i >= 0; i--) {
					const uiMsg = uiMessages[i];
					if (uiMsg && uiMsg.type !== "user" && uiMsg.type !== "user-answer") {
						uiMessages[i] = {
							...uiMsg,
							askUserQA: {
								question: pendingAskUserQuestion.question,
								options: pendingAskUserQuestion.options,
								answer: askUserMatch[1]!,
							},
							askUserCollapsed: true, // Collapsed by default
						};
						break;
					}
				}
				pendingAskUserQuestion = null;
			}
		}
	}
	return uiMessages;
}

/**
 * Hook for managing session operations
 */
export function useSessionManager(
	options: SessionManagerOptions,
): SessionManagerState {
	const {
		aiServiceRef,
		setMessages,
		resetCollapseState,
		updateUsageStatus,
		hasShownWelcomeRef,
	} = options;

	const sessionStoreRef = useRef<SessionStore | null>(null);

	// Initialize SessionStore
	useEffect(() => {
		const initStore = async () => {
			const contextWindow = aiServiceRef.current?.getContextWindow() ?? 32768;
			const store = await initSessionStore(contextWindow);
			sessionStoreRef.current = store;

			// Load active session
			const activeId = store.getActiveSessionId();
			let sessionIsEmpty = true;

			if (activeId && aiServiceRef.current) {
				const session = await store.loadSession(activeId);
				if (session) {
					// Restore session state to AI service
					aiServiceRef.current.restoreSession(session);

					// Convert session history to UI messages
					const history = session.getHistory();
					sessionIsEmpty = history.length === 0;

					if (!sessionIsEmpty) {
						const uiMessages = parseHistoryToUIMessages(history);
						setMessages(uiMessages);
					}
				}
			}

			// Show welcome message if session is empty
			if (sessionIsEmpty && !hasShownWelcomeRef.current) {
				hasShownWelcomeRef.current = true;
				setMessages([
					{
						content: t("app.welcomeMessage"),
						type: "welcome",
						markdown: false,
					},
				]);
			}

			// Update usage status after initialization
			updateUsageStatus();
		};
		initStore();
	}, [aiServiceRef, setMessages, updateUsageStatus, hasShownWelcomeRef]);

	// Save current session
	const saveCurrentSession = useCallback(() => {
		const store = sessionStoreRef.current;
		const aiService = aiServiceRef.current;
		if (!store || !aiService) return;

		const activeId = store.getActiveSessionId();
		if (!activeId) return;

		const session = aiService.getSession();
		store.saveSession(session, activeId);
	}, [aiServiceRef]);

	// Create new session
	const sessionNew = useCallback(async () => {
		const store = sessionStoreRef.current;
		if (!store) return;

		// Save current session
		saveCurrentSession();

		// Create new session
		const newInfo = store.createSession();
		store.setActiveSessionId(newInfo.id);

		// Rebuild AI service with new empty session
		const registry = getToolRegistry();
		(aiServiceRef as React.MutableRefObject<IAIService | null>).current =
			createAIServiceFromConfig(registry);

		// Clear terminal screen and UI
		clearScreen();
		setMessages([]);
		resetCollapseState();

		// Show success message
		setMessages([
			{
				content: t("session.created", { name: newInfo.name }),
				type: "system",
			},
		]);

		// Clear command cache to update session list
		clearCommandCache();

		// Update usage status
		updateUsageStatus();
	}, [
		aiServiceRef,
		saveCurrentSession,
		setMessages,
		resetCollapseState,
		updateUsageStatus,
	]);

	// Switch to a different session
	const sessionSwitch = useCallback(
		async (id: string) => {
			const store = sessionStoreRef.current;
			if (!store) return;

			// Save current session
			saveCurrentSession();

			// Load target session
			const session = await store.loadSession(id);
			if (!session) {
				setMessages((prev) => [
					...prev,
					{
						content: t("session.notFound"),
						type: "system",
						markdown: false,
					},
				]);
				return;
			}

			// Switch active session
			store.setActiveSessionId(id);
			const info = store.getSessionById(id);

			// Restore session to AI service
			if (aiServiceRef.current) {
				aiServiceRef.current.restoreSession(session);
			}

			// Clear terminal screen and UI, then load history
			clearScreen();
			setMessages([]);
			resetCollapseState();

			// Convert session history to UI messages
			const history = session.getHistory();
			const uiMessages = parseHistoryToUIMessages(history);
			setMessages(uiMessages);

			// Show switch success message
			setMessages((prev) => [
				...prev,
				{
					content: t("session.switched", { name: info?.name ?? id }),
					type: "system",
				},
			]);

			// Clear command cache
			clearCommandCache();

			// Update usage status
			updateUsageStatus();
		},
		[
			aiServiceRef,
			saveCurrentSession,
			setMessages,
			resetCollapseState,
			updateUsageStatus,
		],
	);

	// Delete a session
	const sessionDelete = useCallback(
		(id: string) => {
			const store = sessionStoreRef.current;
			if (!store) return;

			const info = store.getSessionById(id);
			if (!info) {
				setMessages((prev) => [
					...prev,
					{
						content: t("session.notFound"),
						type: "system",
						markdown: false,
					},
				]);
				return;
			}

			// Cannot delete active session
			if (info.id === store.getActiveSessionId()) {
				setMessages((prev) => [
					...prev,
					{
						content: t("session.cannotDeleteActive"),
						type: "system",
						markdown: false,
					},
				]);
				return;
			}

			// Delete session
			store.deleteSession(id);

			// Show success message
			setMessages((prev) => [
				...prev,
				{
					content: t("session.deleted", { name: info.name }),
					type: "system",
				},
			]);

			// Clear command cache
			clearCommandCache();
		},
		[setMessages],
	);

	// Clear all sessions and create a new one
	const sessionClear = useCallback(async () => {
		const store = sessionStoreRef.current;
		if (!store) return;

		// Clear all sessions and create new
		const newInfo = store.clearAllSessions();

		// Rebuild AI service
		const registry = getToolRegistry();
		(aiServiceRef as React.MutableRefObject<IAIService | null>).current =
			createAIServiceFromConfig(registry);

		// Clear terminal screen and UI
		clearScreen();
		setMessages([]);
		resetCollapseState();

		// Show success message
		setMessages([
			{
				content: t("session.allCleared", { name: newInfo.name }),
				type: "system",
			},
		]);

		// Clear command cache
		clearCommandCache();

		// Update usage status
		updateUsageStatus();
	}, [aiServiceRef, setMessages, resetCollapseState, updateUsageStatus]);

	return {
		sessionStoreRef,
		sessionNew,
		sessionSwitch,
		sessionDelete,
		sessionClear,
		saveCurrentSession,
	};
}
