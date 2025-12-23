/**
 * 消息分组模型
 *
 * 将消息按"问答对"分组，支持折叠/展开功能
 */

import type { Message } from "../components/MessageOutput.js";
import { t } from "../i18n/index.js";

/**
 * 消息组
 */
export type MessageGroup = {
	id: string; // 唯一标识 (基于起始消息索引生成)
	startIndex: number; // 起始消息索引
	endIndex: number; // 结束消息索引（exclusive）
	userMessage: Message | null; // 用户消息（可能为空，如系统消息组）
	responses: Message[]; // 回复消息（AI 回复 + 系统消息）
	isLast: boolean; // 是否是最后一组
	hasStreaming: boolean; // 是否包含流式消息
};

/**
 * 将消息数组分组为问答对
 *
 * 规则：每个 user 类型消息开始一个新组，后续非 user 消息归入该组
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
	const groups: MessageGroup[] = [];
	let currentGroup: MessageGroup | null = null;

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]!;

		if (msg.type === "user") {
			// 用户消息开始新组
			if (currentGroup) {
				groups.push(currentGroup);
			}
			currentGroup = {
				id: `group-${i}`,
				startIndex: i,
				endIndex: i + 1,
				userMessage: msg,
				responses: [],
				isLast: false,
				hasStreaming: false,
			};
		} else {
			// 非用户消息
			if (!currentGroup) {
				// 没有前置用户消息（如启动时的系统消息）
				currentGroup = {
					id: `group-${i}`,
					startIndex: i,
					endIndex: i + 1,
					userMessage: null,
					responses: [msg],
					isLast: false,
					hasStreaming: msg.streaming || false,
				};
			} else {
				currentGroup.responses.push(msg);
				currentGroup.endIndex = i + 1;
				if (msg.streaming) {
					currentGroup.hasStreaming = true;
				}
			}
		}
	}

	if (currentGroup) {
		groups.push(currentGroup);
	}

	// 标记最后一组
	if (groups.length > 0) {
		groups[groups.length - 1]!.isLast = true;
	}

	return groups;
}

/**
 * 截断文本到指定长度
 */
function truncateText(text: string, maxLen: number): string {
	// 移除换行，取第一行
	const firstLine = text.split("\n")[0] || "";
	// 移除 Markdown 格式符号
	const cleanLine = firstLine
		.replace(/^#+\s*/, "") // 移除标题符号
		.replace(/\*\*/g, "") // 移除加粗
		.replace(/\*/g, "") // 移除斜体
		.replace(/`/g, "") // 移除代码
		.trim();

	if (cleanLine.length <= maxLen) return cleanLine;
	return cleanLine.slice(0, maxLen - 3) + "...";
}

/**
 * 计算消息组的总行数
 */
export function countGroupLines(group: MessageGroup): number {
	const contents: string[] = [];

	if (group.userMessage) {
		contents.push(group.userMessage.content);
	}

	for (const response of group.responses) {
		contents.push(response.content);
	}

	return contents.join("\n").split("\n").length;
}

/**
 * 消息组头部信息（用于渲染折叠/展开头部行）
 */
export type GroupHeaderParts = {
	arrow: string; // ▶ (折叠) 或 ▼ (展开)
	userPreview: string; // 用户消息预览
	separator: string; // →
	responsePreview: string; // AI 回复预览
	lineCount: string; // (N 行)
};

/**
 * 生成消息组头部的各部分（用于分别着色）
 *
 * @param group - 消息组
 * @param maxWidth - 最大宽度
 * @param isCollapsed - 是否处于折叠状态
 */
export function generateGroupHeaderParts(
	group: MessageGroup,
	maxWidth: number,
	isCollapsed: boolean,
): GroupHeaderParts {
	// 预留固定部分的宽度: "▶ " + " → " + " (N 行)"
	const fixedWidth = 2 + 3 + 10; // 约 15 字符
	const availableWidth = Math.max(20, maxWidth - fixedWidth);

	const userPreview = group.userMessage
		? truncateText(group.userMessage.content, Math.floor(availableWidth * 0.45))
		: "(系统)";

	const responsePreview =
		group.responses.length > 0
			? truncateText(
					group.responses[0]!.content,
					Math.floor(availableWidth * 0.45),
				)
			: "";

	const lineCount = countGroupLines(group);

	return {
		arrow: isCollapsed ? "▶" : "▼",
		userPreview,
		separator: "→",
		responsePreview,
		lineCount: t("messageOutput.groupLineCount", { count: lineCount }),
	};
}

/**
 * 生成折叠摘要的各个部分（向后兼容）
 * @deprecated 使用 generateGroupHeaderParts 代替
 */
export type CollapsedSummaryParts = GroupHeaderParts;

/**
 * 生成折叠摘要的各部分（向后兼容）
 * @deprecated 使用 generateGroupHeaderParts 代替
 */
export function generateCollapsedSummaryParts(
	group: MessageGroup,
	maxWidth: number,
): CollapsedSummaryParts {
	return generateGroupHeaderParts(group, maxWidth, true);
}

/**
 * 生成折叠摘要行（纯文本版本）
 */
export function generateCollapsedSummary(
	group: MessageGroup,
	maxWidth: number,
): string {
	const parts = generateCollapsedSummaryParts(group, maxWidth);
	return `${parts.arrow} ${parts.userPreview} ${parts.separator} ${parts.responsePreview} ${parts.lineCount}`;
}

/**
 * 判断消息组是否可以折叠
 *
 * 不可折叠的情况：
 * - 包含流式消息（正在生成中）
 *
 * 注意：最后一组也可以折叠（只要不是流式生成中）
 */
export function canCollapse(group: MessageGroup): boolean {
	return !group.hasStreaming;
}
