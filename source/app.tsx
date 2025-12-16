import { Box, useApp } from "ink";
import { useState, useCallback } from "react";
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

export default function App() {
	const { exit } = useApp();
	const [messages, setMessages] = useState<string[]>([]);
	const terminalHeight = useTerminalHeight();

	const handleSubmit = useCallback((input: UserInput) => {
		if (isMessageInput(input)) {
			// 普通消息输入，未来发送给 AI 处理
			// TODO: 接入 AI 服务
			setMessages((prev) => [...prev, `> ${input.content}`]);
		} else if (isCommandInput(input)) {
			// 命令输入，由应用内部处理
			const [cmd, ...args] = input.command;
			switch (cmd) {
				case "help":
					setMessages((prev) => [
						...prev,
						"Available commands: /help, /exit, /clear, /version, /model",
					]);
					break;
				case "version":
					setMessages((prev) => [...prev, `${APP_NAME} v${VERSION}`]);
					break;
				case "config":
					setMessages((prev) => [...prev, "Config: (empty)"]);
					break;
				case "status":
					setMessages((prev) => [...prev, "Status: running"]);
					break;
				case "model":
					// 示例：处理 /model openai gpt-4
					if (args.length > 0) {
						setMessages((prev) => [
							...prev,
							`Model switched to: ${args.join(" ")}`,
						]);
					} else {
						setMessages((prev) => [
							...prev,
							"Usage: /model <provider> <model-name>",
						]);
					}
					break;
				default:
					setMessages((prev) => [...prev, `Unknown command: /${cmd}`]);
			}
		}
	}, []);

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
