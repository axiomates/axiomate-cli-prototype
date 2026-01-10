import { Box, Text } from "ink";
import { useEffect, useMemo } from "react";
import { THEME_PINK, THEME_LIGHT_YELLOW } from "../constants/colors.js";
import { useTranslation } from "../hooks/useTranslation.js";
import type { Message } from "./StaticMessage.js";

type Props = {
	message: Message;
	width: number;
};

// 延迟加载 marked 和 marked-terminal
let markedInstance: {
	parse: (content: string) => string | Promise<string>;
} | null = null;

async function getMarkedInstance(width: number) {
	if (!markedInstance) {
		const { Marked } = await import("marked");
		const { markedTerminal } = await import("marked-terminal");
		const m = new Marked();
		m.use(markedTerminal({ width, reflowText: true }));
		markedInstance = m;
	}
	return markedInstance;
}

function renderMarkdownSync(content: string, width: number): string {
	if (!markedInstance) {
		getMarkedInstance(width);
		return content;
	}
	const result = markedInstance.parse(content);
	if (typeof result === "string") {
		return result.replace(/\s+$/, "");
	}
	return content;
}

/**
 * StreamingMessage - 渲染当前流式消息
 */
export default function StreamingMessage({ message, width }: Props) {
	const { t } = useTranslation();
	const effectiveWidth = width - 2;

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染消息内容 - 使用 useMemo 缓存
	const renderedContent = useMemo(() => {
		if (message.markdown === false) {
			return message.content;
		}
		return renderMarkdownSync(message.content, effectiveWidth);
	}, [message.content, message.markdown, effectiveWidth]);

	const isUser = message.type === "user" || message.type === "user-answer";
	const prefixColor = isUser ? THEME_PINK : THEME_LIGHT_YELLOW;

	const rows: React.ReactNode[] = [];

	// 1. 渲染思考内容（如果有）
	if (message.reasoning && message.reasoning.length > 0) {
		rows.push(
			<Box key="reasoning-header">
				<Text dimColor>▼ {t("message.thinkingProcess")}</Text>
			</Box>,
		);
		const reasoningLines = message.reasoning.split("\n");
		reasoningLines.forEach((line, idx) => {
			rows.push(
				<Box key={`reasoning-${idx}`}>
					<Text dimColor>{"  " + line}</Text>
				</Box>,
			);
		});
	}

	// 2. 渲染正式内容
	if (message.content && message.content.trim()) {
		const msgLines = renderedContent.split("\n");

		msgLines.forEach((line, idx) => {
			const isFirstLine = idx === 0 && !message.reasoning;

			if (isFirstLine) {
				rows.push(
					<Box key={`content-${idx}`}>
						<Text color={prefixColor} bold>
							{">"}{" "}
						</Text>
						<Text>{line}</Text>
					</Box>,
				);
			} else {
				rows.push(
					<Box key={`content-${idx}`}>
						<Text>{line || " "}</Text>
					</Box>,
				);
			}
		});
	} else if (!message.reasoning) {
		// 没有内容也没有思考（空消息或仅有 queued 状态）
		if (message.queued) {
			rows.push(
				<Box key="queued">
					<Text color={prefixColor} bold>
						{">"}{" "}
					</Text>
					<Text dimColor>{" " + t("common.waiting")}</Text>
				</Box>,
			);
		} else if (message.streaming) {
			// 流式开始但还没有内容
			rows.push(
				<Box key="streaming-empty">
					<Text color={prefixColor} bold>
						{">"}{" "}
					</Text>
				</Box>,
			);
		}
	}

	// 3. 渲染 ask_user 问答（如果有）- 流式消息通常不会有这个
	if (message.askUserQA) {
		const qa = message.askUserQA;
		rows.push(
			<Box key="askuser-header">
				<Text dimColor>▼ {t("message.askUserQA")}</Text>
			</Box>,
		);
		rows.push(
			<Box key="askuser-q">
				<Text dimColor>{"  Q: " + qa.question}</Text>
			</Box>,
		);
		if (qa.options.length > 0) {
			qa.options.forEach((opt, idx) => {
				rows.push(
					<Box key={`askuser-opt-${idx}`}>
						<Text dimColor>{"     " + (idx + 1) + ". " + opt}</Text>
					</Box>,
				);
			});
		}
		rows.push(
			<Box key="askuser-a">
				<Text dimColor>{"  A: " + qa.answer}</Text>
			</Box>,
		);
	}

	return <Box flexDirection="column">{rows}</Box>;
}
