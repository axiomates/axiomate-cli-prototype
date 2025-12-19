import { Box, useApp, useInput } from "ink";
import { useState, useCallback, useMemo } from "react";
import AutocompleteInput from "./components/AutocompleteInput/index.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput, { type Message } from "./components/MessageOutput.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import { VERSION, APP_NAME } from "./constants/meta.js";
import {
	type UserInput,
	isMessageInput,
	isCommandInput,
} from "./models/input.js";
import {
	handleCommand,
	type CommandCallbacks,
} from "./services/commandHandler.js";

/**
 * 应用焦点模式
 * - input: 输入模式，↑/↓ 用于历史导航，输入框可用
 * - output: 输出查看模式，↑/↓ 用于滚动消息，输入框禁用
 */
type FocusMode = "input" | "output";

export default function App() {
	const { exit } = useApp();
	const [messages, setMessages] = useState<Message[]>([]);
	const [focusMode, setFocusMode] = useState<FocusMode>("input");
	const terminalHeight = useTerminalHeight();
	const [inputAreaHeight, setInputAreaHeight] = useState(1);

	// 焦点模式切换（Escape 键）
	const toggleFocusMode = useCallback(() => {
		setFocusMode((prev) => (prev === "input" ? "output" : "input"));
	}, []);

	// 输入区域高度变化回调
	const handleInputHeightChange = useCallback((height: number) => {
		setInputAreaHeight(height);
	}, []);

	// 全局键盘监听（仅处理模式切换）
	useInput(
		(_input, key) => {
			// Shift+↑ 或 Shift+↓ 切换焦点模式
			if (key.shift && (key.upArrow || key.downArrow)) {
				toggleFocusMode();
			}
		},
		{ isActive: true },
	);

	// 发送消息给 AI（目前只是显示）
	const sendToAI = useCallback((content: string) => {
		// TODO: 接入 AI 服务
		setMessages((prev) => [...prev, { content: `> ${content}` }]);
	}, []);

	// 显示消息（Markdown 渲染）
	const showMessage = useCallback((content: string) => {
		setMessages((prev) => [...prev, { content }]);
	}, []);

	// 更新配置
	const setConfig = useCallback((key: string, value: string) => {
		// TODO: 实际更新配置
		setMessages((prev) => [...prev, { content: `${key} set to: ${value}` }]);
	}, []);

	// 清屏
	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	// 命令回调集合
	const commandCallbacks: CommandCallbacks = useMemo(
		() => ({
			showMessage,
			sendToAI,
			setConfig,
			clear: clearMessages,
			exit,
		}),
		[showMessage, sendToAI, setConfig, clearMessages, exit],
	);

	const handleSubmit = useCallback(
		async (input: UserInput) => {
			if (isMessageInput(input)) {
				sendToAI(input.text);
			} else if (isCommandInput(input)) {
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
	// 输入模式: Header(1) + Divider(1) + MessageOutput + Divider(1) + InputArea(动态)
	// 浏览模式: Header(1) + Divider(1) + MessageOutput = 2 行固定
	const fixedHeight = isOutputMode ? 2 : 2 + 1 + inputAreaHeight;
	const messageOutputHeight = Math.max(1, terminalHeight - fixedHeight);

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 标题区域 - 固定高度 */}
			<Box flexShrink={0}>
				<Header focusMode={focusMode} />
			</Box>

			{/* 标题与输出区域分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输出区域 - 使用计算的固定高度 */}
			<MessageOutput
				messages={messages}
				height={messageOutputHeight}
				focusMode={focusMode}
			/>

			{/* 输出区域与输入框分隔线（仅输入模式显示） */}
			{isInputMode && (
				<Box flexShrink={0}>
					<Divider />
				</Box>
			)}

			{/* 输入框区域（仅输入模式显示） */}
			{isInputMode && (
				<Box flexShrink={0}>
					<AutocompleteInput
						prompt="> "
						onSubmit={handleSubmit}
						onClear={handleClear}
						onExit={clearAndExit}
						slashCommands={SLASH_COMMANDS}
						isActive={isInputMode}
						onHeightChange={handleInputHeightChange}
					/>
				</Box>
			)}
		</Box>
	);
}
