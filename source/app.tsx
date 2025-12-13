import { Box, useApp } from "ink";
import { useState, useCallback } from "react";
import AutocompleteInput from "./components/AutocompleteInput.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput from "./components/MessageOutput.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import type { CliFlags } from "./cli.js";

type Props = {
	flags: CliFlags;
};

export default function App({ flags }: Props) {
	const { exit } = useApp();
	const [messages, setMessages] = useState<string[]>([]);
	const terminalHeight = useTerminalHeight();

	const clearAndExit = useCallback(() => {
		exit();
	}, [exit]);

	const handleMessage = useCallback((message: string) => {
		setMessages((prev) => [...prev, message]);
	}, []);

	const handleClear = useCallback(() => {
		setMessages([]);
	}, []);

	// flags 保留但暂不处理，可以在这里访问 flags.name 等
	void flags;

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 标题区域 */}
			<Header />

			{/* 上分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输出区域 */}
			<MessageOutput messages={messages} />

			{/* 下分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输入区域 */}
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
