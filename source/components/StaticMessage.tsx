import { Box, Text } from "ink";
import { useCallback, useEffect } from "react";
import { THEME_PINK, THEME_LIGHT_YELLOW } from "../constants/colors.js";
import { useTranslation } from "../hooks/useTranslation.js";

/**
 * ask_user 问答对
 */
export type AskUserQA = {
	question: string;
	options: string[];
	answer: string;
};

export type Message = {
	content: string;
	reasoning?: string;
	reasoningCollapsed?: boolean;
	askUserQA?: AskUserQA;
	askUserCollapsed?: boolean;
	type?: "user" | "system" | "welcome" | "user-answer";
	streaming?: boolean;
	queued?: boolean;
	queuedMessageId?: string;
	markdown?: boolean;
};

/**
 * 欢迎消息的彩色段落
 */
type WelcomeSegment = {
	text: string;
	color?: string;
};

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
 * StaticMessage - 渲染已完成的消息（用于 <Static> 组件）
 * 不包含滚动逻辑，所有内容始终展开显示
 */
export default function StaticMessage({ message, width }: Props) {
	const { t } = useTranslation();
	const effectiveWidth = width - 2;

	// 预加载 marked
	useEffect(() => {
		getMarkedInstance(width);
	}, [width]);

	// 渲染消息内容
	const renderContent = useCallback(
		(msg: Message): string => {
			const content =
				msg.markdown === false
					? msg.content
					: renderMarkdownSync(msg.content, effectiveWidth);
			return content;
		},
		[effectiveWidth],
	);

	const isUser = message.type === "user" || message.type === "user-answer";
	const isWelcome = message.type === "welcome";
	const prefixColor = isUser ? THEME_PINK : THEME_LIGHT_YELLOW;

	// 欢迎消息特殊渲染
	if (isWelcome && message.content) {
		const segments: WelcomeSegment[] = [];
		const regex = /\{\{(\w+):([^}]+)\}\}/g;
		let lastIndex = 0;
		let match;
		const content = message.content;

		while ((match = regex.exec(content)) !== null) {
			if (match.index > lastIndex) {
				segments.push({ text: content.slice(lastIndex, match.index) });
			}
			const colorKey = match[1];
			const text = match[2];
			let color: string | undefined;
			if (colorKey === "pink") {
				color = THEME_PINK;
			} else if (colorKey === "yellow") {
				color = THEME_LIGHT_YELLOW;
			}
			segments.push({ text: text!, color });
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < content.length) {
			segments.push({ text: content.slice(lastIndex) });
		}

		return (
			<Box flexDirection="column">
				<Box>
					{segments.map((seg, idx) =>
						seg.color ? (
							<Text key={idx} color={seg.color}>
								{seg.text}
							</Text>
						) : (
							<Text key={idx}>{seg.text}</Text>
						),
					)}
				</Box>
			</Box>
		);
	}

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
		const content = renderContent(message);
		const msgLines = content.split("\n");

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
	} else if (!message.reasoning && !message.askUserQA) {
		// 空消息
		const content = renderContent(message);
		const msgLines = content.split("\n");

		msgLines.forEach((line, idx) => {
			const isFirstLine = idx === 0;
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
	}

	// 3. 渲染 ask_user 问答（如果有）
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
