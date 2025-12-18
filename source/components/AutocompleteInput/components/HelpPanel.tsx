/**
 * 快捷键帮助面板组件
 */

import { Box, Text } from "ink";

type HelpPanelProps = {
	/** 终端宽度 */
	columns: number;
};

export function HelpPanel({ columns }: HelpPanelProps) {
	return (
		<Box flexDirection="column">
			<Text color="gray">{"─".repeat(columns)}</Text>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">/ </Text>
					<Text color="gray">for commands</Text>
				</Box>
				<Box width="50%">
					<Text color="#ffff00">@ </Text>
					<Text color="gray">to select files</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">Tab </Text>
					<Text color="gray">to autocomplete</Text>
				</Box>
				<Box width="50%">
					<Text color="#ffff00">Ctrl+Enter </Text>
					<Text color="gray">new line</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">Ctrl+C </Text>
					<Text color="gray">exit</Text>
				</Box>
				<Box width="50%">
					<Text color="#ffff00">Ctrl+A </Text>
					<Text color="gray">move to start</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">Ctrl+E </Text>
					<Text color="gray">move to end</Text>
				</Box>
				<Box width="50%">
					<Text color="#ffff00">Ctrl+U </Text>
					<Text color="gray">clear before cursor</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">Ctrl+K </Text>
					<Text color="gray">clear after cursor</Text>
				</Box>
				<Box width="50%">
					<Text color="#ffff00">↑/↓ </Text>
					<Text color="gray">browse history</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color="#ffff00">Escape </Text>
					<Text color="gray">go back / cancel</Text>
				</Box>
			</Box>
		</Box>
	);
}
