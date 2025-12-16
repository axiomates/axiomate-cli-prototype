/**
 * 富文本输入模型
 * 输入框的内容是结构化的，包含渲染和语义信息
 */

/**
 * 带颜色的文本片段
 */
export type ColoredSegment = {
	text: string;
	color?: string;
};

/**
 * 输入类型
 */
export type InputType = "message" | "command";

/**
 * 结构化输入 - 包含渲染和语义信息
 */
export type RichInput = {
	/** 文本片段（用于渲染） */
	segments: ColoredSegment[];
	/** 输入类型 */
	type: InputType;
	/** 命令路径（仅 type='command' 时有效） */
	commandPath: string[];
};

/**
 * 从 RichInput 获取纯文本
 */
export function getText(input: RichInput): string {
	return input.segments.map((s) => s.text).join("");
}

/**
 * 创建空的 RichInput
 */
export function createEmptyInput(): RichInput {
	return {
		segments: [],
		type: "message",
		commandPath: [],
	};
}

/**
 * 创建消息类型的 RichInput
 */
export function createMessageRichInput(text: string): RichInput {
	return {
		segments: [{ text }],
		type: "message",
		commandPath: [],
	};
}

// ============================================================================
// 颜色常量
// ============================================================================

/** 路径名颜色（金黄色） */
export const PATH_COLOR = "#e5c07b";

/** 箭头/分隔符颜色（灰色） */
export const ARROW_COLOR = "gray";

/**
 * 创建命令类型的 RichInput
 * @param path 命令路径，如 ["model", "openai"]
 * @param trailing 是否包含尾部箭头（表示还未完成选择）
 */
export function createCommandRichInput(
	path: string[],
	trailing: boolean = true,
): RichInput {
	// path 为空且不需要尾部箭头时，表示不在命令模式，返回空 segments
	if (path.length === 0 && !trailing) {
		return {
			segments: [],
			type: "command",
			commandPath: [],
		};
	}

	// path 为空但需要尾部箭头，表示刚输入 /，显示带颜色的 /
	if (path.length === 0) {
		return {
			segments: [{ text: "/", color: PATH_COLOR }],
			type: "command",
			commandPath: [],
		};
	}

	const segments: ColoredSegment[] = [{ text: "/", color: PATH_COLOR }];

	for (let i = 0; i < path.length; i++) {
		segments.push({ text: path[i]!, color: PATH_COLOR });
		// 中间的箭头，或者尾部箭头（如果 trailing=true）
		if (i < path.length - 1 || trailing) {
			segments.push({ text: " → ", color: ARROW_COLOR });
		}
	}

	return {
		segments,
		type: "command",
		commandPath: path,
	};
}
