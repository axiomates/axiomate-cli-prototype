import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useState, useEffect, useRef, useCallback } from "react";

// 自定义 hook 获取终端宽度
function useTerminalWidth(): number {
	const { stdout } = useStdout();
	const [width, setWidth] = useState(stdout.columns || 80);

	useEffect(() => {
		const handleResize = () => {
			setWidth(stdout.columns || 80);
		};

		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	return width;
}

export type AutocompleteProvider = (
	input: string,
	signal: AbortSignal,
) => Promise<string | null>;

type Props = {
	prompt?: string;
	onSubmit?: (value: string) => void;
	onExit?: () => void;
	autocompleteProvider: AutocompleteProvider;
};

export default function AutocompleteInput({
	prompt = "> ",
	onSubmit,
	onExit,
	autocompleteProvider,
}: Props) {
	const { exit } = useApp();
	const [input, setInput] = useState("");
	const [cursorPosition, setCursorPosition] = useState(0);
	const [suggestion, setSuggestion] = useState<string | null>(null);
	const columns = useTerminalWidth();
	const abortControllerRef = useRef<AbortController | null>(null);

	// 触发自动补全
	const triggerAutocomplete = useCallback(
		async (text: string) => {
			// 取消之前的请求
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			if (!text) {
				setSuggestion(null);
				return;
			}

			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				const result = await autocompleteProvider(text, controller.signal);
				if (!controller.signal.aborted) {
					setSuggestion(result);
				}
			} catch {
				// 忽略取消错误
				if (!controller.signal.aborted) {
					setSuggestion(null);
				}
			}
		},
		[autocompleteProvider],
	);

	// 当输入变化时触发自动补全
	useEffect(() => {
		triggerAutocomplete(input);
	}, [input, triggerAutocomplete]);

	// 清理
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	useInput((inputChar, key) => {
		if (key.return) {
			// 回车提交
			onSubmit?.(input);
			setInput("");
			setCursorPosition(0);
			setSuggestion(null);
			return;
		}

		if (key.tab && suggestion) {
			// Tab 确认补全
			const newInput = input + suggestion;
			setInput(newInput);
			setCursorPosition(newInput.length);
			setSuggestion(null);
			return;
		}

		if (key.backspace || key.delete) {
			if (cursorPosition > 0) {
				const newInput =
					input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
				setInput(newInput);
				setCursorPosition(cursorPosition - 1);
			}
			return;
		}

		if (key.leftArrow) {
			if (cursorPosition > 0) {
				setCursorPosition(cursorPosition - 1);
			}
			return;
		}

		if (key.rightArrow) {
			if (suggestion && cursorPosition === input.length) {
				// 如果光标在末尾且有建议，向右移动接受一个字符
				const newInput = input + suggestion[0];
				setInput(newInput);
				setCursorPosition(newInput.length);
				setSuggestion(suggestion.slice(1) || null);
			} else if (cursorPosition < input.length) {
				setCursorPosition(cursorPosition + 1);
			}
			return;
		}

		if (key.upArrow || key.downArrow) {
			// 预留历史记录功能
			return;
		}

		if (key.ctrl && inputChar === "c") {
			if (onExit) {
				onExit();
			} else {
				exit();
			}
			return;
		}

		if (key.ctrl && inputChar === "u") {
			// Ctrl+U 清除光标前的内容
			setInput(input.slice(cursorPosition));
			setCursorPosition(0);
			return;
		}

		if (key.ctrl && inputChar === "k") {
			// Ctrl+K 清除光标后的内容
			setInput(input.slice(0, cursorPosition));
			return;
		}

		if (key.ctrl && inputChar === "a") {
			// Ctrl+A 移动到行首
			setCursorPosition(0);
			return;
		}

		if (key.ctrl && inputChar === "e") {
			// Ctrl+E 移动到行尾
			setCursorPosition(input.length);
			return;
		}

		if (key.escape) {
			// Escape 清除建议
			setSuggestion(null);
			return;
		}

		// 普通字符输入
		if (inputChar && !key.ctrl && !key.meta) {
			const newInput =
				input.slice(0, cursorPosition) + inputChar + input.slice(cursorPosition);
			setInput(newInput);
			setCursorPosition(cursorPosition + inputChar.length);
		}
	});

	// 计算显示内容，支持自动换行
	const displayText = input;
	const suggestionText = suggestion || "";
	const fullText = prompt + displayText + suggestionText;

	// 计算光标位置相对于显示文本
	const cursorOffset = prompt.length + cursorPosition;

	// 将文本分成多行
	const wrapText = (text: string, width: number): string[] => {
		if (width <= 0) return [text];
		const lines: string[] = [];
		let remaining = text;
		while (remaining.length > 0) {
			lines.push(remaining.slice(0, width));
			remaining = remaining.slice(width);
		}
		return lines.length > 0 ? lines : [""];
	};

	const effectiveWidth = columns;
	const lines = wrapText(fullText, effectiveWidth);

	// 找到光标所在的行和列
	const cursorLine = Math.floor(cursorOffset / effectiveWidth);
	const cursorCol = cursorOffset % effectiveWidth;

	return (
		<Box flexDirection="column">
			{lines.map((line, lineIndex) => {
				const inputEndInLine =
					lineIndex === Math.floor((prompt.length + input.length) / effectiveWidth);
				const suggestionStart =
					inputEndInLine ? (prompt.length + input.length) % effectiveWidth : -1;

				// 拆分行内容：用户输入部分 vs 建议部分
				let userPart = line;
				let suggestPart = "";

				if (suggestionStart >= 0 && suggestionStart < line.length) {
					userPart = line.slice(0, suggestionStart);
					suggestPart = line.slice(suggestionStart);
				}

				const isCursorLine = lineIndex === cursorLine;

				return (
					<Box key={lineIndex}>
						<Text>
							{isCursorLine ? (
								<>
									{userPart.slice(0, cursorCol)}
									<Text inverse>{userPart[cursorCol] || suggestPart[0] || " "}</Text>
									{cursorCol < userPart.length
										? userPart.slice(cursorCol + 1)
										: ""}
									{cursorCol >= userPart.length ? (
										<Text color="gray">
											{suggestPart.slice(cursorCol >= userPart.length ? 1 : 0)}
										</Text>
									) : (
										<Text color="gray">{suggestPart}</Text>
									)}
								</>
							) : (
								<>
									{userPart}
									<Text color="gray">{suggestPart}</Text>
								</>
							)}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
