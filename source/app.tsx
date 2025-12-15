import { Box, useApp } from "ink";
import { useState, useCallback } from "react";
import AutocompleteInput from "./components/AutocompleteInput.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput from "./components/MessageOutput.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import { SLASH_COMMANDS } from "./constants/commands.js";

export default function App() {
	const { exit } = useApp();
	const [messages, setMessages] = useState<string[]>([]);
	const terminalHeight = useTerminalHeight();

	const handleMessage = useCallback((message: string) => {
		setMessages((prev) => [...prev, message]);
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
					onMessage={handleMessage}
					onClear={handleClear}
					onExit={clearAndExit}
					slashCommands={SLASH_COMMANDS}
				/>
			</Box>
		</Box>
	);
}
