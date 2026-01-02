import { Box, useApp, useInput } from "ink";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import AutocompleteInput from "./components/AutocompleteInput/index.js";
import Divider from "./components/Divider.js";
import StatusBar from "./components/StatusBar.js";
import MessageOutput, { type Message } from "./components/MessageOutput.js";
import { AskUserMenu } from "./components/AskUserMenu.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import useTerminalWidth from "./hooks/useTerminalWidth.js";
import { useCollapseState } from "./hooks/useCollapseState.js";
import { useSessionManager } from "./hooks/useSessionManager.js";
import { useAskUser } from "./hooks/useAskUser.js";
import { useMessageQueue } from "./hooks/useMessageQueue.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import { VERSION, APP_NAME } from "./constants/meta.js";
import {
	type UserInput,
	type FileReference,
	isMessageInput,
	isCommandInput,
} from "./models/input.js";
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
import type { InitResult } from "./utils/init.js";
import { resumeInput } from "./utils/stdin.js";
import { t } from "./i18n/index.js";
import {
	isThinkingEnabled,
	currentModelSupportsThinking,
	isPlanModeEnabled,
} from "./utils/config.js";
import { SessionStore } from "./services/ai/sessionStore.js";
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

	// Use extracted hooks for better separation of concerns
	const {
		pendingAskUser,
		handleAskUserSelect,
		handleAskUserCancel,
		createAskUserCallback,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
	} = useAskUser();

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

	// Collapse state management (extracted to hook)
	const {
		collapsedGroups,
		messageGroups,
		toggleCollapse,
		expandAll: expandAllGroups,
		collapseAll: collapseAllGroups,
		toggleReasoningCollapse: toggleReasoningCollapseBase,
		toggleAskUserCollapse: toggleAskUserCollapseBase,
		resetCollapseState,
	} = useCollapseState(messages);

	// Wrap collapse functions to pass setMessages
	const expandAll = useCallback(() => {
		expandAllGroups(setMessages);
	}, [expandAllGroups]);

	const collapseAll = useCallback(() => {
		collapseAllGroups(setMessages);
	}, [collapseAllGroups]);

	const toggleReasoningCollapse = useCallback(
		(msgIndex: number) => {
			toggleReasoningCollapseBase(msgIndex, setMessages);
		},
		[toggleReasoningCollapseBase],
	);

	const toggleAskUserCollapse = useCallback(
		(msgIndex: number) => {
			toggleAskUserCollapseBase(msgIndex, setMessages);
		},
		[toggleAskUserCollapseBase],
	);

	// AI 服务实例（从初始化结果获取）
	const aiServiceRef = useRef<IAIService | null>(initResult.aiService);

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

	// Session manager hook (handles session init, CRUD, and persistence)
	const {
		sessionStoreRef,
		sessionNew,
		sessionSwitch,
		sessionDelete,
		sessionClear,
		saveCurrentSession,
	} = useSessionManager({
		aiServiceRef,
		setMessages,
		resetCollapseState,
		updateUsageStatus,
		hasShownWelcomeRef,
	});

	// Message queue hook (handles message processing and streaming)
	const { messageQueueRef, stopProcessing } = useMessageQueue({
		aiServiceRef,
		setMessages,
		setIsLoading,
		compactRef,
		saveSessionRef,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
		updateUsageStatus,
		createAskUserCallback,
	});

	// 组件挂载后恢复 stdin 输入（之前在 cli.tsx 中被暂停）
	useEffect(() => {
		resumeInput();
	}, []);

	// 焦点模式切换（Escape 键）
	const toggleFocusMode = useCallback(() => {
		setFocusMode((prev) => (prev === "input" ? "output" : "input"));
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
			const showThinkingWarning =
				isThinkingEnabled() && !currentModelSupportsThinking();

			// 显示用户消息
			// 如果队列正在处理其他消息，标记为 queued 以显示等待指示器
			// 注意：需要在 enqueue 之前检查 isProcessing，因为 enqueue 会立即开始处理
			const isQueueProcessing = messageQueueRef.current.isProcessing();

			// 加入消息队列（异步处理）
			// Capture plan mode state at enqueue time (snapshot for concurrency safety)
			const messageId = messageQueueRef.current.enqueue(
				content,
				files,
				isPlanModeEnabled(),
			);

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
		// messageQueueRef 和 sessionStoreRef 是 ref，不会改变引用
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
						content:
							t("session.compactedNewSession", {
								oldName,
								newName: newInfo.name,
							}) +
							"\n\n---\n\n" +
							summary,
						type: "system",
					},
				]);
				resetCollapseState();

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
		// sessionStoreRef 是 ref，不会改变引用
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resetCollapseState]);

	// 设置 compactRef 以便 processMessage 可以调用 compact
	useEffect(() => {
		compactRef.current = compact;
	}, [compact]);

	// 设置 saveSessionRef 以便 MessageQueue 可以调用
	useEffect(() => {
		saveSessionRef.current = saveCurrentSession;
	}, [saveCurrentSession]);

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

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 输出区域 - 使用 flexGrow 自动占满剩余空间 */}
			<MessageOutput
				messages={messages}
				focusMode={focusMode}
				messageGroups={messageGroups}
				collapsedGroups={collapsedGroups}
				onToggleCollapse={toggleCollapse}
				onExpandAll={expandAll}
				onCollapseAll={collapseAll}
				onToggleReasoningCollapse={toggleReasoningCollapse}
				onToggleAskUserCollapse={toggleAskUserCollapse}
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
					/>
				</Box>
			)}

			{/* 输入框区域（始终挂载以保留输入历史，通过 display 控制显示） */}
			<Box
				flexShrink={0}
				display={isInputMode && !pendingAskUser ? "flex" : "none"}
			>
				<AutocompleteInput
					prompt="> "
					onSubmit={handleSubmit}
					onClear={handleClear}
					onExit={clearAndExit}
					slashCommands={SLASH_COMMANDS}
					isActive={isInputMode && !pendingAskUser}
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
					planMode={isPlanModeEnabled()}
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
