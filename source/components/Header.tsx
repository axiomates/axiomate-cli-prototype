import { Box, Text } from "ink";
import { APP_NAME } from "../constants/meta.js";

type FocusMode = "input" | "output";

type Props = {
	focusMode?: FocusMode;
};

export default function Header({ focusMode = "input" }: Props) {
	const isOutputMode = focusMode === "output";

	return (
		<Box flexShrink={0} justifyContent="space-between">
			<Text>
				<Text color="#ff69b4" bold>
					{APP_NAME}
				</Text>
				<Text color="gray"> - Type </Text>
				<Text color="#ffff00">/</Text>
				<Text color="gray"> for commands, </Text>
				<Text color="#ffff00">Tab</Text>
				<Text color="gray"> to autocomplete, </Text>
				<Text color="#ffff00">?</Text>
				<Text color="gray"> for shortcuts</Text>
			</Text>
			{/* 模式指示器 */}
			<Text>
				{isOutputMode ? (
					<Text color="cyan" bold>
						[浏览] Shift+↑↓ 切换
					</Text>
				) : (
					<Text color="gray">[输入] Shift+↑↓ 切换</Text>
				)}
			</Text>
		</Box>
	);
}
