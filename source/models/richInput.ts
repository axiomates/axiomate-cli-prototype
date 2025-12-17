/**
 * 富文本渲染相关类型和工具
 */

/**
 * 带颜色的文本片段
 */
export type ColoredSegment = {
	text: string;
	color?: string;
};

// ============================================================================
// 颜色常量
// ============================================================================

/** 路径名颜色（金黄色） */
export const PATH_COLOR = "#ffd700";

/** 箭头/分隔符颜色（灰色） */
export const ARROW_COLOR = "gray";

/** 文件 @ 符号颜色（浅蓝色） */
export const FILE_AT_COLOR = "#87ceeb";

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 颜色范围（用于渲染）
 */
export type ColorRange = {
	start: number;
	end: number;
	color?: string;
};

/**
 * 将 ColoredSegment[] 转换为 ColorRange[]
 * 便于渲染时按位置查找颜色
 */
export function segmentsToRanges(segments: ColoredSegment[]): ColorRange[] {
	const ranges: ColorRange[] = [];
	let pos = 0;
	for (const seg of segments) {
		if (seg.text.length > 0) {
			ranges.push({
				start: pos,
				end: pos + seg.text.length,
				color: seg.color,
			});
			pos += seg.text.length;
		}
	}
	return ranges;
}
