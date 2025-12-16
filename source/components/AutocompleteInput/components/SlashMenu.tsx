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

	return (
		<Box flexDirection="column">
			<Text color="gray">{"─".repeat(columns)}</Text>
			{/* 显示当前路径（如果不在根级） */}
			{path.length > 0 && (
				<Box>
					<Text color="gray">{promptIndent}← </Text>
					<Text color="#e5c07b">/</Text>
					{path.map((name, i) => (
						<Text key={name}>
							<Text color="#e5c07b">{name}</Text>
							{i < path.length - 1 && <Text color="gray"> → </Text>}
						</Text>
					))}
				</Box>
			)}
			{commands.map((cmd, index) => (
				<Box key={cmd.name}>
					<Text
						backgroundColor={index === selectedIndex ? "blue" : undefined}
						color={index === selectedIndex ? "white" : undefined}
					>
						{promptIndent}
						{path.length === 0 ? "/" : "  "}
						{cmd.name}
					</Text>
					{cmd.description && <Text color="gray"> - {cmd.description}</Text>}
					{cmd.children && cmd.children.length > 0 && (
						<Text color="gray"> →</Text>
					)}
				</Box>
			))}
		</Box>
	);
}
