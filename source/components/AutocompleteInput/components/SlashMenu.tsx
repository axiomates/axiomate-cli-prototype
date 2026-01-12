/**
 * 斜杠命令菜单组件
 */

import { Box, Text } from "ink";
import type { SlashCommand } from "../types.js";

type SlashMenuProps = {
	/** 当前过滤后的命令列表 */
	commands: SlashCommand[];
	/** 当前选中的索引 */
	selectedIndex: number;
	/** 当前路径（用于显示面包屑） */
	path: string[];
	/** 终端宽度 */
	columns: number;
	/** prompt 缩进 */
	promptIndent: string;
};

export function SlashMenu({
	commands,
	selectedIndex,
	path,
	columns,
	promptIndent,
}: SlashMenuProps) {
	if (commands.length === 0) {
		return null;
	}

	// 窗口化逻辑：最多显示 9 个命令（与 FileMenu 一致）
	const maxVisible = 9;

	// 计算窗口起始位置（保持选中项可见）
	let startIndex = 0;
	if (selectedIndex >= maxVisible) {
		startIndex = selectedIndex - maxVisible + 1;
	}
	const endIndex = Math.min(commands.length, startIndex + maxVisible);

	// 判断是否有更多内容
	const hasMoreBefore = startIndex > 0;
	const hasMoreAfter = endIndex < commands.length;

	// 获取可见命令
	const visibleCommands = commands.slice(startIndex, endIndex);

	return (
		<Box flexDirection="column">
			<Text color="gray">{"─".repeat(columns)}</Text>
			{/* 显示当前路径（如果不在根级） */}
			{path.length > 0 && (
				<Box>
					<Text color="gray">{promptIndent}← </Text>
					<Text color="#ffd700">/</Text>
					{path.map((name, i) => (
						<Text key={name}>
							<Text color="#ffd700">{name}</Text>
							{i < path.length - 1 && <Text color="gray"> → </Text>}
						</Text>
					))}
				</Box>
			)}
			{/* 上方滚动指示器 */}
			{hasMoreBefore && (
				<Box>
					<Text dimColor>
						{promptIndent}↑ 还有 {startIndex} 项
					</Text>
				</Box>
			)}
			{visibleCommands.map((cmd, visibleIndex) => {
				const actualIndex = startIndex + visibleIndex;
				return (
					<Box key={cmd.name}>
						<Text
							backgroundColor={
								actualIndex === selectedIndex ? "blue" : undefined
							}
							color={actualIndex === selectedIndex ? "white" : undefined}
						>
							{promptIndent}
							{/* 显示前缀指示器或默认的 / 或空格 */}
							{cmd.prefix ?? (path.length === 0 ? "/" : "  ")}
							{cmd.name}
						</Text>
						{cmd.description && <Text color="gray"> - {cmd.description}</Text>}
						{cmd.children && cmd.children.length > 0 && (
							<Text color="gray"> →</Text>
						)}
					</Box>
				);
			})}
			{/* 下方滚动指示器 */}
			{hasMoreAfter && (
				<Box>
					<Text dimColor>
						{promptIndent}↓ 还有 {commands.length - endIndex} 项
					</Text>
				</Box>
			)}
		</Box>
	);
}
