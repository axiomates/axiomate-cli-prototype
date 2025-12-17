import { Box, useApp } from "ink";
import { useState, useCallback, useMemo } from "react";
import AutocompleteInput from "./components/AutocompleteInput/index.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput from "./components/MessageOutput.js";
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

export default function App() {
	const { exit } = useApp();
	const [messages, setMessages] = useState<string[]>([]);
	const terminalHeight = useTerminalHeight();

	// 发送消息给 AI（目前只是显示）
	const sendToAI = useCallback((content: string) => {
		// TODO: 接入 AI 服务
		setMessages((prev) => [...prev, `> ${content}`]);
	}, []);

	// 显示消息
	const showMessage = useCallback((content: string) => {
		setMessages((prev) => [...prev, content]);
	}, []);

	// 更新配置
	const setConfig = useCallback((key: string, value: string) => {
		// TODO: 实际更新配置
		setMessages((prev) => [...prev, `${key} set to: ${value}`]);
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
		(input: UserInput) => {
			if (isMessageInput(input)) {
				sendToAI(input.text);
			} else if (isCommandInput(input)) {
				handleCommand(
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

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 标题区域 */}
			<Header />

			{/* 标题与输出区域分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输出区域 */}
			<MessageOutput messages={messages} />

			{/* 输出区域与输入框分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输入框区域 */}
			<Box flexShrink={0}>
				<AutocompleteInput
					prompt="> "
					onSubmit={handleSubmit}
					onClear={handleClear}
					onExit={clearAndExit}
					slashCommands={SLASH_COMMANDS}
				/>
			</Box>
		</Box>
	);
}
