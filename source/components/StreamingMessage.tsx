import { Box, Text } from "ink";
import { useCallback, useEffect, useState, memo, useMemo } from "react";
import { THEME_PINK, THEME_LIGHT_YELLOW } from "../constants/colors.js";
import { useTranslation } from "../hooks/useTranslation.js";
import type { Message } from "./StaticMessage.js";

type Props = {
	message: Message;
	width: number;
};

// Braille 点阵旋转动画帧
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Spinner 动画间隔（ms）- 较高的值可减少滚动时的条纹问题
const SPINNER_INTERVAL = 120;

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
 * Spinner 组件 - 独立的动画组件，避免触发父组件重渲染
 */
const Spinner = memo(function Spinner({
	active,
	color = "yellowBright",
	prefix = " ",
}: {
	active: boolean;
	color?: string;
	prefix?: string;
}) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (!active) return;

		const timer = setInterval(() => {
			setIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
		}, SPINNER_INTERVAL);

		return () => clearInterval(timer);
	}, [active]);

	if (!active) return null;

	return (
		<Text color={color}>
			{prefix}
			{SPINNER_FRAMES[index]}
		</Text>
	);
});

/**
 * StreamingMessage - 渲染当前流式消息
 * 包含 Spinner 动画
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
			const isLastLine = idx === reasoningLines.length - 1;
			rows.push(
				<Box key={`reasoning-${idx}`}>
					<Text dimColor>{"  " + line}</Text>
					{/* 如果是思考内容的最后一行且正在流式输出，显示 spinner */}
					{isLastLine && message.streaming && !message.content && (
						<Spinner active={true} />
					)}
				</Box>,
			);
		});
	}

	// 2. 渲染正式内容
	if (message.content && message.content.trim()) {
		const msgLines = renderedContent.split("\n");

		msgLines.forEach((line, idx) => {
			const isFirstLine = idx === 0 && !message.reasoning;
			const isLastLine = idx === msgLines.length - 1;

			if (isFirstLine) {
				rows.push(
					<Box key={`content-${idx}`}>
						<Text color={prefixColor} bold>
							{">"}{" "}
						</Text>
						<Text>{line}</Text>
						{isLastLine && message.streaming && <Spinner active={true} />}
					</Box>,
				);
			} else {
				rows.push(
					<Box key={`content-${idx}`}>
						<Text>{line || " "}</Text>
						{isLastLine && message.streaming && <Spinner active={true} />}
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
					<Text dimColor>
						<Spinner active={true} color="gray" prefix="" />
						{" " + t("common.waiting")}
					</Text>
				</Box>,
			);
		} else if (message.streaming) {
			// 流式开始但还没有内容
			rows.push(
				<Box key="streaming-empty">
					<Text color={prefixColor} bold>
						{">"}{" "}
					</Text>
					<Spinner active={true} prefix="" />
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
