/**
 * 输入区域高度计算工具
 * 用于精确计算 AutocompleteInput 组件及其子组件的总高度
 */

import type { UIMode, SlashCommand } from "../types.js";
import type { FileItem } from "../hooks/useFileSelect.js";
import { isSlashMode, isFileMode, isHelpMode } from "../types.js";

export type HeightCalculationInput = {
	/** 输入行数（包括自动换行） */
	inputLines: number;
	/** 当前 UI 模式 */
	uiMode: UIMode;
	/** 过滤后的命令列表（SlashMenu 用） */
	filteredCommands: SlashCommand[];
	/** 过滤后的文件列表（FileMenu 用） */
	filteredFiles: FileItem[];
	/** 命令路径（用于判断是否显示 breadcrumb） */
	commandPath: string[];
	/** 文件路径（用于判断是否显示 breadcrumb） */
	filePath: string[];
	/** 文件是否正在加载 */
	filesLoading: boolean;
};

/**
 * 计算输入区域的总高度（行数）
 *
 * 包括：
 * - 输入行（支持多行）
 * - SlashMenu（divider + breadcrumb? + commands）
 * - FileMenu（divider + breadcrumb? + moreAbove? + files + moreBelow?）
 * - HelpPanel（divider + 6行内容）
 */
export function calculateInputAreaHeight(
	input: HeightCalculationInput,
): number {
	const {
		inputLines,
		uiMode,
		filteredCommands,
		filteredFiles,
		commandPath,
		filePath,
		filesLoading,
	} = input;

	// 基础高度：输入行数
	let height = inputLines;

	if (isSlashMode(uiMode) && filteredCommands.length > 0) {
		// SlashMenu: divider(1) + breadcrumb?(0-1) + moreAbove?(0-1) + commands(1-9) + moreBelow?(0-1)
		height += 1; // divider
		if (commandPath.length > 0) {
			height += 1; // breadcrumb
		}

		// 窗口计算逻辑（与 SlashMenu 组件保持一致）
		const maxVisible = 9;
		const selectedIndex = uiMode.selectedIndex;

		// 计算窗口起始位置
		let startIndex = 0;
		if (selectedIndex >= maxVisible) {
			startIndex = selectedIndex - maxVisible + 1;
		}
		const endIndex = Math.min(filteredCommands.length, startIndex + maxVisible);

		const hasMoreBefore = startIndex > 0;
		const hasMoreAfter = endIndex < filteredCommands.length;

		// 可见命令数
		height += endIndex - startIndex;

		// "more" 指示器
		if (hasMoreBefore) {
			height += 1;
		}
		if (hasMoreAfter) {
			height += 1;
		}
	} else if (isFileMode(uiMode)) {
		// FileMenu: divider(1) + content
		height += 1; // divider

		if (filesLoading) {
			// Loading 状态：只有一行 "Loading..."
			height += 1;
		} else if (filteredFiles.length === 0) {
			// 空状态：只有一行 "No files found"
			height += 1;
		} else {
			// 有文件：breadcrumb?(0-1) + moreAbove?(0-1) + files(1-9) + moreBelow?(0-1)
			if (filePath.length > 0) {
				height += 1; // breadcrumb
			}

			// 窗口计算逻辑（与 FileMenu 组件保持一致）
			const maxVisible = 9;
			const selectedIndex = uiMode.selectedIndex;

			// 计算窗口起始位置
			let startIndex = 0;
			if (selectedIndex >= maxVisible) {
				startIndex = selectedIndex - maxVisible + 1;
			}
			const endIndex = Math.min(filteredFiles.length, startIndex + maxVisible);

			const hasMoreBefore = startIndex > 0;
			const hasMoreAfter = endIndex < filteredFiles.length;

			// 可见文件数
			height += endIndex - startIndex;

			// "more" 指示器
			if (hasMoreBefore) {
				height += 1;
			}
			if (hasMoreAfter) {
				height += 1;
			}
		}
	} else if (isHelpMode(uiMode)) {
		// HelpPanel: divider(1) + 8行内容
		height += 1; // divider
		height += 8; // HelpPanel 固定8行
	}

	return height;
}
