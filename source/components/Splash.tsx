/**
 * 启动页组件
 *
 * 在应用初始化完成前显示，避免布局抖动
 */

import { Box, Text } from "ink";
import { APP_NAME, VERSION } from "../constants/meta.js";
import useTerminalHeight from "../hooks/useTerminalHeight.js";
import useTerminalWidth from "../hooks/useTerminalWidth.js";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";

type Props = {
	message?: string;
};

export default function Splash({ message = "Loading..." }: Props) {
	const terminalHeight = useTerminalHeight();
	const terminalWidth = useTerminalWidth();

	// 计算垂直居中位置
	const contentHeight = 3; // 应用名 + 空行 + 加载提示
	const topPadding = Math.max(0, Math.floor((terminalHeight - contentHeight) / 2));

	return (
		<Box
			flexDirection="column"
			height={terminalHeight}
			width={terminalWidth}
		>
			{/* 顶部空白 */}
			<Box height={topPadding} />

			{/* 居中内容 */}
			<Box flexDirection="column" alignItems="center" width="100%">
				<Text bold color={THEME_PINK}>
					{APP_NAME} <Text color={THEME_LIGHT_YELLOW}>v{VERSION}</Text>
				</Text>
				<Text> </Text>
				<Text dimColor>{message}</Text>
			</Box>
		</Box>
	);
}
