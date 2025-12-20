/**
 * 快捷键帮助面板组件
 */

import { Box, Text } from "ink";
import { THEME_LIGHT_YELLOW } from "../../../constants/colors.js";

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
					<Text color={THEME_LIGHT_YELLOW}>/ </Text>
					<Text color="gray">for commands</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>@ </Text>
					<Text color="gray">to select files</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Tab </Text>
					<Text color="gray">to autocomplete</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+Enter </Text>
					<Text color="gray">new line</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+C </Text>
					<Text color="gray">exit</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+A </Text>
					<Text color="gray">move to start</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+E </Text>
					<Text color="gray">move to end</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+U </Text>
					<Text color="gray">clear before cursor</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+K </Text>
					<Text color="gray">clear after cursor</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>↑/↓ </Text>
					<Text color="gray">browse history</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Escape </Text>
					<Text color="gray">go back / cancel</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Shift+↑↓ </Text>
					<Text color="gray">switch Input/View mode</Text>
				</Box>
			</Box>
		</Box>
	);
}
