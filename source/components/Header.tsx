import { Box, Text } from "ink";
import { APP_NAME } from "../constants/meta.js";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";

type FocusMode = "input" | "output";

type Props = {
	focusMode?: FocusMode;
};

export default function Header({ focusMode = "input" }: Props) {
	const isOutputMode = focusMode === "output";

	return (
		<Box flexShrink={0} justifyContent="space-between" width="100%">
			<Text>
				<Text color={THEME_PINK} bold>
					{APP_NAME}
				</Text>
				<Text color="gray"> - Type </Text>
				<Text color={THEME_LIGHT_YELLOW}>/</Text>
				<Text color="gray"> for commands, </Text>
				<Text color={THEME_LIGHT_YELLOW}>?</Text>
				<Text color="gray"> for shortcuts</Text>
			</Text>
			{/* 模式指示器 */}
			<Text>
				{isOutputMode ? (
					<Text color="cyan" bold>
						[View] Shift+↑↓
					</Text>
				) : (
					<Text color="gray">[Input] Shift+↑↓</Text>
				)}
			</Text>
		</Box>
	);
}
