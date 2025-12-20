/**
 * 启动页组件
 *
 * 在应用初始化完成前显示，避免布局抖动
 */

import { Box, Text } from "ink";
import { APP_NAME, VERSION } from "../constants/meta.js";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";

type Props = {
	message?: string;
};

export default function Splash({ message = "Loading..." }: Props) {
	return (
		<Box>
			<Text bold color={THEME_PINK}>
					{APP_NAME} <Text color={THEME_LIGHT_YELLOW}>v{VERSION}</Text>
				</Text>
				<Text> </Text>
			<Text dimColor>{message}</Text>
		</Box>
	);
}
