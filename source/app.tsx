import { Box, useApp } from "ink";
import { useState, useCallback } from "react";
import AutocompleteInput from "./components/AutocompleteInput.js";
import Divider from "./components/Divider.js";
import Header from "./components/Header.js";
import MessageOutput from "./components/MessageOutput.js";
import useTerminalHeight from "./hooks/useTerminalHeight.js";
import { SLASH_COMMANDS } from "./constants/commands.js";
import type { CliFlags } from "./cli.js";

// 可用命令列表（用于 help 显示）
const AVAILABLE_COMMANDS = ["help", "exit", "quit", "clear", "version"];

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

	const handleSubmit = useCallback(
		(value: string) => {
			if (value.trim()) {
				setMessages((prev) => [...prev, `> ${value}`]);

				// 处理斜杠命令
				if (value.startsWith("/")) {
					const slashCmd = value.slice(1).toLowerCase();
					if (slashCmd === "help") {
						setMessages((prev) => [
							...prev,
							"Available commands: " + AVAILABLE_COMMANDS.join(", "),
						]);
					} else if (slashCmd === "exit") {
						clearAndExit();
					} else if (slashCmd === "clear") {
						setMessages([]);
					} else if (slashCmd === "version") {
						setMessages((prev) => [...prev, "axiomate-cli v1.0.0"]);
					} else if (slashCmd === "config") {
						setMessages((prev) => [...prev, "Config: (empty)"]);
					} else if (slashCmd === "status") {
						setMessages((prev) => [...prev, "Status: running"]);
					} else {
						setMessages((prev) => [...prev, `Unknown slash command: ${value}`]);
					}
					return;
				}

				// 处理普通命令
				const cmd = value.trim().toLowerCase();
				if (cmd === "help") {
					setMessages((prev) => [
						...prev,
						"Available commands: " + AVAILABLE_COMMANDS.join(", "),
					]);
				} else if (cmd === "exit" || cmd === "quit") {
					clearAndExit();
				} else if (cmd === "clear") {
					setMessages([]);
				} else if (cmd === "version") {
					setMessages((prev) => [...prev, "axiomate-cli v1.0.0"]);
				} else {
					setMessages((prev) => [...prev, `Unknown command: ${value}`]);
				}
			}
		},
		[clearAndExit],
	);

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
					onSubmit={handleSubmit}
					onExit={clearAndExit}
					slashCommands={SLASH_COMMANDS}
				/>
			</Box>
		</Box>
	);
}
