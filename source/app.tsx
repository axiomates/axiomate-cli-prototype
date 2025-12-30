import { Box, useApp, useInput } from "ink";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import AutocompleteInput from "./components/AutocompleteInput/index.js";
import Divider from "./components/Divider.js";
import StatusBar from "./components/StatusBar.js";
import MessageOutput, { type Message } from "./components/MessageOutput.js";
import { AskUserMenu } from "./components/AskUserMenu.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import useTerminalWidth from "./hooks/useTerminalWidth.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import { VERSION, APP_NAME } from "./constants/meta.js";
import {
	type UserInput,
	type FileReference,
	isMessageInput,
	isCommandInput,
} from "./models/input.js";
import { groupMessages, canCollapse } from "./models/messageGroup.js";
import {
	handleCommand,
	type CommandCallbacks,
} from "./services/commandHandler.js";
import { getToolRegistry } from "./services/tools/registry.js";
import {
	createAIServiceFromConfig,
	type IAIService,
	type MatchContext,
} from "./services/ai/index.js";
import { buildMessageContent } from "./services/ai/contentBuilder.js";
import {
	MessageQueue,
	type QueuedMessage,
	type ProcessorOptions,
	type StreamContent,
} from "./services/ai/messageQueue.js";
import type { InitResult } from "./utils/init.js";
import { resumeInput } from "./utils/stdin.js";
import { t } from "./i18n/index.js";
import { isThinkingEnabled, currentModelSupportsThinking, isPlanModeEnabled } from "./utils/config.js";
import {
	initSessionStore,
	SessionStore,
} from "./services/ai/sessionStore.js";
import { clearCommandCache } from "./constants/commands.js";

/**
 * 应用焦点模式
 * - input: 输入模式，↑/↓ 用于历史导航，输入框可用
 * - output: 输出查看模式，↑/↓ 用于滚动消息，输入框禁用
 */
type FocusMode = "input" | "output";

type Props = {
	initResult: InitResult;
};

// Compact prompt (English) - defined outside component to avoid recreation
const COMPACT_PROMPT =
	"Summarize our conversation so far in a concise but comprehensive way. " +
	"Include key decisions, code changes discussed, important context, and any unresolved questions. " +
	"This summary will become the context for our continued discussion. " +
	"Respond with only the summary, no additional commentary.";

export default function App({ initResult }: Props) {
	const { exit } = useApp();
	const [messages, setMessages] = useState<Message[]>([]);
	const [focusMode, setFocusMode] = useState<FocusMode>("input");
	const terminalHeight = useTerminalHeight();
	const terminalWidth = useTerminalWidth();

	// ask_user 工具状态
	const [pendingAskUser, setPendingAskUser] = useState<{
		question: string;
		options: string[];
		onResolve: (answer: string) => void;
	} | null>(null);
	const [isAskUserCustomInput, setIsAskUserCustomInput] = useState(false);
	const [askUserInputLineCount, setAskUserInputLineCount] = useState(1);
	const [inputAreaHeight, setInputAreaHeight] = useState(1);

	// AI 加载状态（将来用于显示加载指示器）
	const [, setIsLoading] = useState(false);

	// Usage 状态 - 用于 StatusBar 显示
	const [usageStatus, setUsageStatus] = useState<{
		usedTokens: number;
		contextWindow: number;
		usagePercent: number;
		isNearLimit: boolean;
		isFull: boolean;
	} | null>(null);

	// 当前正在流式输出的消息 ID（用于正确更新 UI）
	const currentStreamingIdRef = useRef<string | null>(null);

	// 折叠状态管理
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);

	// 计算消息组（缓存）
	const messageGroups = useMemo(() => groupMessages(messages), [messages]);

	// 自动折叠：当新对话组到来时，只折叠前一个对话组
	const prevGroupCountRef = useRef(0);
	useEffect(() => {
		const currentCount = messageGroups.length;
		if (currentCount > prevGroupCountRef.current && currentCount > 1) {
			// 新消息组到来，只折叠前一个组（倒数第二个）
			const prevGroup = messageGroups[currentCount - 2];
			if (prevGroup && canCollapse(prevGroup)) {
				setCollapsedGroups((prev) => {
					const next = new Set(prev);
					next.add(prevGroup.id);
					return next;
				});
			}
		}
		prevGroupCountRef.current = currentCount;
	}, [messageGroups]);

	// 切换单个组的折叠状态
	const toggleCollapse = useCallback((groupId: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			return next;
		});
	}, []);

	// 展开所有组
	const expandAll = useCallback(() => {
		setCollapsedGroups(new Set());
	}, []);

	// 折叠所有可折叠的组
	const collapseAll = useCallback(() => {
		const toCollapse = messageGroups
			.filter((g) => canCollapse(g))
			.map((g) => g.id);
		setCollapsedGroups(new Set(toCollapse));
	}, [messageGroups]);

	// 切换消息思考内容的折叠状态
	const toggleReasoningCollapse = useCallback((msgIndex: number) => {
		setMessages((prev) => {
			const newMessages = [...prev];
			const msg = newMessages[msgIndex];
			if (msg) {
				newMessages[msgIndex] = {
					...msg,
					reasoningCollapsed: !msg.reasoningCollapsed,
				};
			}
			return newMessages;
		});
	}, []);

	// AI 服务实例（从初始化结果获取）
	const aiServiceRef = useRef<IAIService | null>(initResult.aiService);

	// SessionStore 引用
	const sessionStoreRef = useRef<SessionStore | null>(null);

	// 是否已显示过欢迎消息（app 生命周期内只显示一次）
	const hasShownWelcomeRef = useRef(false);

	// Auto-compact 引用（需要在 compact 定义后设置）
	const compactRef = useRef<(() => Promise<void>) | null>(null);

	// Auto-save 引用（需要在 saveCurrentSession 定义后设置）
	const saveSessionRef = useRef<(() => void) | null>(null);

	// 更新 usage 状态的辅助函数
	const updateUsageStatus = useCallback(() => {
		if (aiServiceRef.current) {
			const status = aiServiceRef.current.getSessionStatus();
			const contextWindow = aiServiceRef.current.getContextWindow();
			setUsageStatus({
				usedTokens: status.usedTokens,
				contextWindow,
				usagePercent: status.usagePercent,
				isNearLimit: status.isNearLimit,
				isFull: status.isFull,
			});
		} else {
			setUsageStatus(null);
		}
	}, []);

	// 初始化 SessionStore
	useEffect(() => {
		const initStore = async () => {
			const contextWindow =
				aiServiceRef.current?.getContextWindow() ?? 32768;
			const store = await initSessionStore(contextWindow);
			sessionStoreRef.current = store;

			// 加载活跃 session
			const activeId = store.getActiveSessionId();
			let sessionIsEmpty = true;

			if (activeId && aiServiceRef.current) {
				const session = await store.loadSession(activeId);
				if (session) {
					// 恢复 session 状态到 AI 服务
					aiServiceRef.current.restoreSession(session);

					// 将 session 历史转换为 UI 消息
					const history = session.getHistory();
					sessionIsEmpty = history.length === 0;

					if (!sessionIsEmpty) {
						const uiMessages: Message[] = [];
						for (const msg of history) {
							if (msg.role === "user") {
								uiMessages.push({ content: msg.content, type: "user" });
							} else if (msg.role === "assistant" && msg.content) {
								uiMessages.push({ content: msg.content });
							}
						}
						setMessages(uiMessages);
					}
				}
			}

			// 如果 session 为空且尚未显示过欢迎消息，显示欢迎消息
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

			// 初始化完成后更新 usage 状态
			updateUsageStatus();
		};
		initStore();
	}, [updateUsageStatus]);

	// 消息处理函数（用于消息队列）
	const processMessage = useCallback(
		async (
			queuedMessage: QueuedMessage,
			options?: ProcessorOptions,
		): Promise<string> => {
			const aiService = aiServiceRef.current;
			if (!aiService) {
				throw new Error(t("ai.notConfigured"));
			}

			const cwd = process.cwd();

			// 先粗略估算新消息大小，检查是否需要 compact
			// 这样可以在 compact 后获得更多空间，减少文件截断
			const roughEstimate = await buildMessageContent({
				userMessage: queuedMessage.content,
				files: queuedMessage.files,
				cwd,
				availableTokens: Infinity, // 不限制，获取完整大小估算
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
				// 执行自动 compact，释放空间
				await compactRef.current();
			}

			// compact 后重新获取可用空间，构建消息内容
			const availableTokens = aiService.getAvailableTokens();
			const buildResult = await buildMessageContent({
				userMessage: queuedMessage.content,
				files: queuedMessage.files,
				cwd,
				availableTokens,
			});

			// 如果有截断提示，显示给用户
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

			// 再次检查上下文是否已满（消息太大无法发送）
			compactCheck = aiService.shouldCompact(buildResult.estimatedTokens);
			if (compactCheck.isContextFull) {
				throw new Error(
					t("ai.contextFull", {
						percent: compactCheck.projectedPercent.toFixed(0),
					}),
				);
			}

			// 构建上下文
			const context: MatchContext = {
				cwd,
				selectedFiles: queuedMessage.files.map((f) => f.path),
			};

			// 使用流式 API 发送给 AI
			// Pass planMode from queued message snapshot
			// 创建 ask_user 回调
			const onAskUser = async (
				question: string,
				askOptions: string[],
			): Promise<string> => {
				// 添加 AI 的问题到消息历史
				setMessages((prev) => {
					// 移除空的流式消息（如果有的话）
					const newMessages = prev.filter((msg) => !(msg.streaming && !msg.content));
					// 添加 AI 的问题
					return [
						...newMessages,
						{ content: question, type: "system" as const, markdown: false },
					];
				});

				return new Promise((resolve) => {
					setPendingAskUser({
						question,
						options: askOptions,
						onResolve: (answer: string) => {
							// 用户回答后，添加回答到消息历史，然后恢复流式
							setMessages((prev) => [
								...prev,
								{ content: answer, type: "user-answer" as const },
								// 添加新的流式消息占位
								{ content: "", reasoning: "", streaming: true },
							]);
							resolve(answer);
						},
					});
				});
			};

			return aiService.streamMessage(
				buildResult.content,
				context,
				{
					onStart: options?.streamCallbacks?.onStart,
					onChunk: options?.streamCallbacks?.onChunk,
					onEnd: options?.streamCallbacks?.onEnd,
				},
				{ signal: options?.signal, planMode: queuedMessage.planMode },
				onAskUser,
			);
		},
		[],
	);

	// 消息队列实例
	const messageQueueRef = useRef<MessageQueue | null>(null);

	// 初始化消息队列
	useEffect(() => {
		messageQueueRef.current = new MessageQueue(processMessage, {
			onMessageStart: (id) => {
				setIsLoading(true);
				currentStreamingIdRef.current = id;
				// 移除对应用户消息的 queued 标记
				setMessages((prev) =>
					prev.map((msg) =>
						msg.queuedMessageId === id
							? { ...msg, queued: false, queuedMessageId: undefined }
							: msg,
					),
				);
			},
			onMessageComplete: (id) => {
				// 流式模式下，内容已通过 onStreamEnd 更新，这里只需重置加载状态
				if (currentStreamingIdRef.current === id) {
					currentStreamingIdRef.current = null;
				}
				setIsLoading(false);

				// 自动保存 session
				saveSessionRef.current?.();
			},
			onMessageError: (id, error) => {
				// 只处理当前消息的错误
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				currentStreamingIdRef.current = null;

				// 错误时查找并更新流式消息，或添加新消息
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex !== -1) {
						// 更新流式消息为错误状态
						const newMessages = [...prev];
						newMessages[streamingIndex] = {
							...newMessages[streamingIndex],
							content: newMessages[streamingIndex].content + `\n\nError: ${error.message}`,
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
				// 队列处理完毕
			},
			onStopped: (queuedCount, currentContent) => {
				currentStreamingIdRef.current = null;
				const msg =
					queuedCount > 0 || currentContent?.content
						? t("commandHandler.stopSuccess", { count: queuedCount })
						: t("commandHandler.stopNone");

				// 如果有部分内容，保存到 session 中
				if (currentContent?.content && aiServiceRef.current) {
					aiServiceRef.current.savePartialResponse(currentContent.content);
					// 自动保存 session
					saveSessionRef.current?.();
				}

				// 查找并标记流式消息为结束
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((m) => m.streaming);
					if (streamingIndex !== -1) {
						const newMessages = [...prev];
						newMessages[streamingIndex] = {
							...newMessages[streamingIndex],
							streaming: false,
							// 有思考内容时自动折叠
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

				// Stop 后更新 usage 状态（使用估算值，下次完整回复时会被精确值覆盖）
				updateUsageStatus();
			},
			// 流式回调
			onStreamStart: (id) => {
				// 只处理当前消息
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				// 添加一条空的流式消息
				setMessages((prev) => [
					...prev,
					{ content: "", reasoning: "", streaming: true },
				]);
			},
			onStreamChunk: (id, streamContent: StreamContent) => {
				// 只更新当前消息
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				// 查找并更新流式消息（可能不是最后一条，因为用户可能发送了新消息）
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex === -1) {
						return prev;
					}
					const newMessages = [...prev];
					newMessages[streamingIndex] = {
						...newMessages[streamingIndex],
						content: streamContent.content,
						reasoning: streamContent.reasoning,
						reasoningCollapsed: false, // 流式中不折叠
					};
					return newMessages;
				});
			},
			onStreamEnd: (id, finalContent: StreamContent) => {
				// 只更新当前消息
				if (currentStreamingIdRef.current !== id) {
					return;
				}
				// 查找并标记流式结束（可能不是最后一条，因为用户可能发送了新消息）
				setMessages((prev) => {
					const streamingIndex = prev.findIndex((msg) => msg.streaming);
					if (streamingIndex === -1) {
						return prev;
					}
					const newMessages = [...prev];
					newMessages[streamingIndex] = {
						...newMessages[streamingIndex],
						content: finalContent.content,
						reasoning: finalContent.reasoning,
						streaming: false,
						// 有思考内容时自动折叠
						reasoningCollapsed: finalContent.reasoning.length > 0,
					};
					return newMessages;
				});
				// 流式结束后更新 usage 状态
				updateUsageStatus();
			},
		});

		return () => {
			messageQueueRef.current?.clear();
		};
	}, [processMessage, updateUsageStatus]);

	// 组件挂载后恢复 stdin 输入（之前在 cli.tsx 中被暂停）
	useEffect(() => {
		resumeInput();
	}, []);

	// 焦点模式切换（Escape 键）
	const toggleFocusMode = useCallback(() => {
		setFocusMode((prev) => (prev === "input" ? "output" : "input"));
	}, []);

	// ask_user 选择处理
	const handleAskUserSelect = useCallback((answer: string) => {
		if (pendingAskUser) {
			// onResolve 内部已经处理了消息添加，这里只需调用它
			pendingAskUser.onResolve(answer);
			setPendingAskUser(null);
			setIsAskUserCustomInput(false);
		}
	}, [pendingAskUser]);

	// ask_user 取消处理
	const handleAskUserCancel = useCallback(() => {
		if (pendingAskUser) {
			pendingAskUser.onResolve(""); // 返回空字符串表示取消
			setPendingAskUser(null);
			setIsAskUserCustomInput(false);
		}
	}, [pendingAskUser]);

	// ask_user 自定义输入模式变化
	const handleAskUserCustomInputModeChange = useCallback((isCustomInput: boolean) => {
		setIsAskUserCustomInput(isCustomInput);
		// 重置行数
		if (!isCustomInput) {
			setAskUserInputLineCount(1);
		}
	}, []);

	// ask_user 输入行数变化
	const handleAskUserInputLineCountChange = useCallback((lineCount: number) => {
		setAskUserInputLineCount(lineCount);
	}, []);

	// 输入区域高度变化回调
	const handleInputHeightChange = useCallback((height: number) => {
		setInputAreaHeight(height);
	}, []);

	// 用于从 View 模式注入文本到输入框
	const [injectText, setInjectText] = useState<string>("");
	const handleInjectTextHandled = useCallback(() => {
		setInjectText("");
	}, []);

	// 全局键盘监听（模式切换 + View 模式快捷键）
	useInput(
		(input, key) => {
			// Shift+↑ 或 Shift+↓ 切换焦点模式
			if (key.shift && (key.upArrow || key.downArrow)) {
				toggleFocusMode();
				return;
			}

			// View 模式下按 / 切换到 Input 模式并输入 /
			if (focusMode === "output" && input === "/") {
				setFocusMode("input");
				setInjectText("/");
			}
		},
		{ isActive: true },
	);

	// 发送消息给 AI（支持文件附件）
	const sendToAI = useCallback(
		(content: string, files: FileReference[] = [], isUserMessage = true) => {
			// 检查 AI 服务是否可用
			if (!aiServiceRef.current) {
				// 显示用户消息
				if (isUserMessage) {
					setMessages((prev) => [...prev, { content, type: "user" }]);
				}
				setMessages((prev) => [
					...prev,
					{ content: t("ai.notConfigured"), markdown: false },
				]);
				return;
			}

			// 检查消息队列是否可用
			if (!messageQueueRef.current) {
				// 显示用户消息
				if (isUserMessage) {
					setMessages((prev) => [...prev, { content, type: "user" }]);
				}
				setMessages((prev) => [
					...prev,
					{ content: "Message queue not initialized", markdown: false },
				]);
				return;
			}

			// 如果是用户消息且 session 名称还是默认的，根据消息内容更新名称
			if (isUserMessage) {
				const store = sessionStoreRef.current;
				if (store) {
					const activeSession = store.getActiveSession();
					if (activeSession && activeSession.name === "New Session") {
						const newName = SessionStore.generateTitleFromMessage(content);
						store.updateSessionName(activeSession.id, newName);
						clearCommandCache(); // 更新命令缓存以显示新名称
					}
				}
			}

			// 检查思考模式与模型支持
			const showThinkingWarning = isThinkingEnabled() && !currentModelSupportsThinking();

			// 显示用户消息
			// 如果队列正在处理其他消息，标记为 queued 以显示等待指示器
			// 注意：需要在 enqueue 之前检查 isProcessing，因为 enqueue 会立即开始处理
			const isQueueProcessing = messageQueueRef.current.isProcessing();

			// 加入消息队列（异步处理）
			// Capture plan mode state at enqueue time (snapshot for concurrency safety)
			const messageId = messageQueueRef.current.enqueue(content, files, isPlanModeEnabled());

			if (isUserMessage) {
				setMessages((prev) => {
					const newMessages = [
						...prev,
						{
							content,
							type: "user" as const,
							queued: isQueueProcessing,
							queuedMessageId: isQueueProcessing ? messageId : undefined,
						},
					];
					// 如果用户开启了 thinking 但当前模型不支持，在用户消息后显示提示
					// 这样提示会和 AI 回复在同一组，不会被折叠
					if (showThinkingWarning) {
						newMessages.push({
							content: t("commandHandler.thinkingAutoDisabled"),
							type: "system" as const,
							markdown: false,
						});
					}
					return newMessages;
				});
			} else if (showThinkingWarning) {
				// 非用户消息时也显示提示
				setMessages((prev) => [
					...prev,
					{
						content: t("commandHandler.thinkingAutoDisabled"),
						type: "system",
						markdown: false,
					},
				]);
			}
		},
		[],
	);

	// 显示消息（Markdown 渲染）
	const showMessage = useCallback((content: string) => {
		setMessages((prev) => [...prev, { content }]);
	}, []);

	// 更新配置（遗留接口，保留用于其他配置项）
	const setConfig = useCallback((key: string, value: string) => {
		setMessages((prev) => [...prev, { content: `${key} set to: ${value}` }]);
	}, []);

	// 重建 AI 服务（模型切换后需要）
	const recreateAIService = useCallback(() => {
		const registry = getToolRegistry();
		aiServiceRef.current = createAIServiceFromConfig(registry);
		// 模型切换后更新 usage 状态
		updateUsageStatus();
	}, [updateUsageStatus]);

	// 执行 compact（总结并压缩会话，创建新 session）
	const compact = useCallback(async () => {
		const aiService = aiServiceRef.current;
		const store = sessionStoreRef.current;
		if (!aiService) {
			setMessages((prev) => [
				...prev,
				{
					content: t("ai.notConfigured"),
					type: "system",
					markdown: false,
				},
			]);
			return;
		}

		// 检查是否有足够的真实消息需要 compact
		// 使用 realMessageCount（排除 compact summary）
		const compactCheck = aiService.shouldCompact(0);
		if (compactCheck.realMessageCount < 2) {
			setMessages((prev) => [
				...prev,
				{
					content: t("commandHandler.compactNotEnough"),
					type: "system",
					markdown: false,
				},
			]);
			return;
		}

		// 显示正在压缩的消息
		setMessages((prev) => [
			...prev,
			{
				content: t("commandHandler.compactInProgress"),
				type: "system",
				markdown: false,
			},
		]);

		try {
			// 发送 compact prompt 给 AI（不显示为用户消息）
			const cwd = process.cwd();
			const context: MatchContext = { cwd };
			const summary = await aiService.sendMessage(COMPACT_PROMPT, context);

			// 获取旧 session 信息
			const oldInfo = store?.getActiveSession();
			const oldName = oldInfo?.name ?? "previous session";

			// 保存旧 session
			if (store && oldInfo) {
				const oldSession = aiService.getSession();
				store.saveSession(oldSession, oldInfo.id);
			}

			// 创建新 session
			if (store) {
				const newInfo = store.createSession();
				store.setActiveSessionId(newInfo.id);

				// 重建 AI 服务
				const registry = getToolRegistry();
				aiServiceRef.current = createAIServiceFromConfig(registry);

				// 使用总结初始化新 session
				aiServiceRef.current?.compactWith(summary);

				// 保存新 session
				if (aiServiceRef.current) {
					store.saveSession(aiServiceRef.current.getSession(), newInfo.id);
				}

				// 清空 UI 并显示成功消息
				setMessages([
					{
						content: t("session.compactedNewSession", {
							oldName,
							newName: newInfo.name,
						}) + "\n\n---\n\n" + summary,
						type: "system",
					},
				]);
				setCollapsedGroups(new Set());
				prevGroupCountRef.current = 0;

				// 清除命令缓存以更新 session 列表
				clearCommandCache();
			} else {
				// 没有 SessionStore 时的降级行为：仅 compact 当前 session
				aiService.compactWith(summary);

				// 清空 UI 并显示总结
				setMessages([
					{
						content:
							t("commandHandler.compactSuccess") + "\n\n---\n\n" + summary,
						type: "system",
					},
				]);
			}
		} catch (error) {
			setMessages((prev) => [
				...prev,
				{
					content: t("commandHandler.compactFailed", {
						error: error instanceof Error ? error.message : String(error),
					}),
					type: "system",
					markdown: false,
				},
			]);
		}
	}, []);

	// 设置 compactRef 以便 processMessage 可以调用 compact
	useEffect(() => {
		compactRef.current = compact;
	}, [compact]);

	// 停止当前处理并清空消息队列
	const stopProcessing = useCallback(() => {
		messageQueueRef.current?.stop();
	}, []);

	// 保存当前 session
	const saveCurrentSession = useCallback(() => {
		const store = sessionStoreRef.current;
		const aiService = aiServiceRef.current;
		if (!store || !aiService) return;

		const activeId = store.getActiveSessionId();
		if (!activeId) return;

		const session = aiService.getSession();
		store.saveSession(session, activeId);
	}, []);

	// 设置 saveSessionRef 以便 MessageQueue 可以调用
	useEffect(() => {
		saveSessionRef.current = saveCurrentSession;
	}, [saveCurrentSession]);

	// Session 命令回调：创建新 session
	const sessionNew = useCallback(async () => {
		const store = sessionStoreRef.current;
		if (!store) return;

		// 保存当前 session
		saveCurrentSession();

		// 创建新 session
		const newInfo = store.createSession();
		store.setActiveSessionId(newInfo.id);

		// 重建 AI 服务（使用新的空 session）
		const registry = getToolRegistry();
		aiServiceRef.current = createAIServiceFromConfig(registry);

		// 清空 UI
		setMessages([]);
		setCollapsedGroups(new Set());
		prevGroupCountRef.current = 0;

		// 显示成功消息
		setMessages([
			{
				content: t("session.created", { name: newInfo.name }),
				type: "system",
			},
		]);

		// 清除命令缓存以更新 session 列表
		clearCommandCache();

		// 新 session 创建后更新 usage 状态
		updateUsageStatus();
	}, [saveCurrentSession, updateUsageStatus]);

	// Session 命令回调：切换 session
	const sessionSwitch = useCallback(
		async (id: string) => {
			const store = sessionStoreRef.current;
			if (!store) return;

			// 保存当前 session
			saveCurrentSession();

			// 加载目标 session
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

			// 切换活跃 session
			store.setActiveSessionId(id);
			const info = store.getSessionById(id);

			// 恢复 session 到 AI 服务
			if (aiServiceRef.current) {
				aiServiceRef.current.restoreSession(session);
			}

			// 清空 UI 并加载历史
			setMessages([]);
			setCollapsedGroups(new Set());
			prevGroupCountRef.current = 0;

			// 将 session 历史转换为 UI 消息
			const history = session.getHistory();
			const uiMessages: Message[] = [];
			for (const msg of history) {
				if (msg.role === "user") {
					uiMessages.push({ content: msg.content, type: "user" });
				} else if (msg.role === "assistant" && msg.content) {
					uiMessages.push({ content: msg.content });
				}
			}
			setMessages(uiMessages);

			// 显示切换成功消息
			setMessages((prev) => [
				...prev,
				{
					content: t("session.switched", { name: info?.name ?? id }),
					type: "system",
				},
			]);

			// 清除命令缓存以更新 session 列表
			clearCommandCache();

			// Session 切换后更新 usage 状态
			updateUsageStatus();
		},
		[saveCurrentSession, updateUsageStatus],
	);

	// Session 命令回调：删除 session
	const sessionDelete = useCallback((id: string) => {
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

		// 不能删除活跃 session
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

		// 删除 session
		store.deleteSession(id);

		// 显示成功消息
		setMessages((prev) => [
			...prev,
			{
				content: t("session.deleted", { name: info.name }),
				type: "system",
			},
		]);

		// 清除命令缓存以更新 session 列表
		clearCommandCache();
	}, []);

	// Session 命令回调：清除所有 session 并创建新的
	const sessionClear = useCallback(async () => {
		const store = sessionStoreRef.current;
		if (!store) return;

		// 清除所有 session 并创建新的
		const newInfo = store.clearAllSessions();

		// 重建 AI 服务（使用新的空 session）
		const registry = getToolRegistry();
		aiServiceRef.current = createAIServiceFromConfig(registry);

		// 清空 UI
		setMessages([]);
		setCollapsedGroups(new Set());
		prevGroupCountRef.current = 0;

		// 显示成功消息
		setMessages([
			{
				content: t("session.allCleared", { name: newInfo.name }),
				type: "system",
			},
		]);

		// 清除命令缓存以更新 session 列表
		clearCommandCache();

		// 清除 session 后更新 usage 状态
		updateUsageStatus();
	}, [updateUsageStatus]);

	// 命令回调集合
	const commandCallbacks: CommandCallbacks = useMemo(
		() => ({
			showMessage,
			sendToAI,
			setConfig,
			compact,
			stop: stopProcessing,
			recreateAIService,
			exit,
			sessionNew,
			sessionSwitch,
			sessionDelete,
			sessionClear,
		}),
		[
			showMessage,
			sendToAI,
			setConfig,
			compact,
			stopProcessing,
			recreateAIService,
			exit,
			sessionNew,
			sessionSwitch,
			sessionDelete,
			sessionClear,
		],
	);

	const handleSubmit = useCallback(
		async (input: UserInput) => {
			if (isMessageInput(input)) {
				// 发送消息给 AI（带文件附件）
				sendToAI(input.text, input.files);
			} else if (isCommandInput(input)) {
				// 除了 exit 命令，都先显示用户输入（但不发送给 AI）
				const isExit = input.commandPath[0]?.toLowerCase() === "exit";
				if (!isExit) {
					setMessages((prev) => [
						...prev,
						{ content: input.text, type: "user" },
					]);
				}
				await handleCommand(
					input.commandPath,
					{ appName: APP_NAME, version: VERSION },
					commandCallbacks,
				);
			}
		},
		[sendToAI, commandCallbacks],
	);

	const handleClear = useCallback(() => {
		setMessages([]);
	}, []);

	const clearAndExit = useCallback(() => {
		exit();
	}, [exit]);

	// 派生状态
	const isInputMode = focusMode === "input";
	const isOutputMode = focusMode === "output";

	// 计算 MessageOutput 的可用高度
	// 输入模式: MessageOutput + Divider(1) + InputArea(动态) + Divider(1) + StatusBar(1)
	// 浏览模式: MessageOutput + Divider(1) + StatusBar(1) = 2 行固定
	// AskUser 模式: MessageOutput + AskUserMenu(...) + Divider(1) + StatusBar(1)
	const getFixedHeight = () => {
		if (isOutputMode) return 2;
		if (pendingAskUser) {
			// AskUserMenu 高度计算:
			// - divider: 1
			// - question: 1
			// - content: options list OR custom input (动态行数)
			// - hints: 1
			if (isAskUserCustomInput) {
				// Custom input mode: divider + question + input lines + hints
				const askUserHeight = 1 + 1 + askUserInputLineCount + 1;
				return askUserHeight + 2; // + bottom divider + statusbar
			}
			// Options mode: divider + question + options + hints
			const optionsCount = Math.min(pendingAskUser.options.length, 3) + 1; // max 3 options + custom input
			const askUserHeight = 1 + 1 + optionsCount + 1;
			return askUserHeight + 2; // + bottom divider + statusbar
		}
		return 3 + inputAreaHeight;
	};
	const fixedHeight = getFixedHeight();
	const messageOutputHeight = Math.max(1, terminalHeight - fixedHeight);

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 输出区域 - 使用计算的固定高度，位于最顶部 */}
			<MessageOutput
				messages={messages}
				height={messageOutputHeight}
				focusMode={focusMode}
				collapsedGroups={collapsedGroups}
				onToggleCollapse={toggleCollapse}
				onExpandAll={expandAll}
				onCollapseAll={collapseAll}
				onToggleReasoningCollapse={toggleReasoningCollapse}
			/>

			{/* 输出区域与输入框分隔线（输入模式且无 ask_user 菜单时显示，AskUserMenu 内部有自己的 divider） */}
			{isInputMode && !pendingAskUser && (
				<Box flexShrink={0}>
					<Divider />
				</Box>
			)}

			{/* ask_user 菜单（AI 等待用户回答时显示） */}
			{pendingAskUser && (
				<Box flexShrink={0}>
					<AskUserMenu
						question={pendingAskUser.question}
						options={pendingAskUser.options}
						onSelect={handleAskUserSelect}
						onCancel={handleAskUserCancel}
						columns={terminalWidth}
						onCustomInputModeChange={handleAskUserCustomInputModeChange}
						onInputLineCountChange={handleAskUserInputLineCountChange}
					/>
				</Box>
			)}

			{/* 输入框区域（始终挂载以保留输入历史，通过 display 控制显示） */}
			<Box flexShrink={0} display={isInputMode && !pendingAskUser ? "flex" : "none"}>
				<AutocompleteInput
					prompt="> "
					onSubmit={handleSubmit}
					onClear={handleClear}
					onExit={clearAndExit}
					slashCommands={SLASH_COMMANDS}
					isActive={isInputMode && !pendingAskUser}
					onHeightChange={handleInputHeightChange}
					injectText={injectText}
					onInjectTextHandled={handleInjectTextHandled}
				/>
			</Box>

			{/* 状态栏上方分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 状态栏 - 固定在底部 */}
			<Box flexShrink={0}>
				<StatusBar
					focusMode={focusMode}
					usedTokens={usageStatus?.usedTokens}
					contextWindow={usageStatus?.contextWindow}
					usagePercent={usageStatus?.usagePercent}
					isNearLimit={usageStatus?.isNearLimit}
					isFull={usageStatus?.isFull}
				/>
			</Box>
		</Box>
	);
}
