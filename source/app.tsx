import { Box, Text, useApp, useStdout } from "ink";
import { useState, useCallback, useEffect } from "react";
import AutocompleteInput, {
	type AutocompleteProvider,
} from "./components/AutocompleteInput.js";
import type { CliFlags } from "./cli.js";

type Props = {
	flags: CliFlags;
};

// 示例命令列表用于自动补全
const COMMANDS = [
	"help",
	"exit",
	"quit",
	"clear",
	"history",
	"config",
	"config set",
	"config get",
	"config list",
	"status",
	"start",
	"stop",
	"restart",
	"logs",
	"version",
];

// 分隔线组件
function Divider() {
	const { stdout } = useStdout();
	const width = stdout.columns || 80;
	return <Text color="gray">{"─".repeat(width)}</Text>;
}

export default function App({ flags }: Props) {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [messages, setMessages] = useState<string[]>([]);
	const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
	const [, forceUpdate] = useState(0);

	// 清屏并退出
	const clearAndExit = useCallback(() => {
		exit();
	}, [exit]);

	// 初始化时强制更新一次，确保布局正确
	useEffect(() => {
		setTerminalHeight(stdout.rows || 24);
		forceUpdate((n) => n + 1);
	}, [stdout.rows]);

	useEffect(() => {
		const handleResize = () => {
			setTerminalHeight(stdout.rows || 24);
		};
		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	// 临时异步自动补全函数
	const autocompleteProvider: AutocompleteProvider = useCallback(
		async (input: string, signal: AbortSignal): Promise<string | null> => {
			// 模拟异步延迟
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(resolve, 100);
				signal.addEventListener("abort", () => {
					clearTimeout(timeout);
					reject(new DOMException("Aborted", "AbortError"));
				});
			});

			if (signal.aborted) {
				return null;
			}

			// 查找匹配的命令
			const lowerInput = input.toLowerCase();
			const match = COMMANDS.find(
				(cmd) => cmd.toLowerCase().startsWith(lowerInput) && cmd !== input,
			);

			if (match) {
				// 返回需要补全的部分（不包括已输入的内容）
				return match.slice(input.length);
			}

			return null;
		},
		[],
	);

	const handleSubmit = useCallback(
		(value: string) => {
			if (value.trim()) {
				setMessages((prev) => [...prev, `> ${value}`]);

				// 处理一些基本命令
				const cmd = value.trim().toLowerCase();
				if (cmd === "help") {
					setMessages((prev) => [
						...prev,
						"Available commands: " + COMMANDS.join(", "),
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
			<Box flexShrink={0}>
				<Text color="cyan" bold>
					axiomate-cli
				</Text>
				<Text color="gray"> - Type </Text>
				<Text color="yellow">help</Text>
				<Text color="gray"> for commands, </Text>
				<Text color="yellow">Tab</Text>
				<Text color="gray"> to autocomplete</Text>
			</Box>

			{/* 上分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输出区域 - 使用 flexGrow 填充剩余空间，overflow 自动裁剪 */}
			<Box
				flexDirection="column"
				flexGrow={1}
				justifyContent="flex-end"
				overflow="hidden"
			>
				{messages.map((msg, index) => (
					<Text key={index}>{msg}</Text>
				))}
			</Box>

			{/* 下分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 输入区域 - 固定在底部 */}
			<Box flexShrink={0}>
				<AutocompleteInput
					prompt="> "
					onSubmit={handleSubmit}
					onExit={clearAndExit}
					autocompleteProvider={autocompleteProvider}
				/>
			</Box>
		</Box>
	);
}
