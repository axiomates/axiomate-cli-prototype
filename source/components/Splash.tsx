/**
 * 启动页组件
 *
 * 在应用初始化完成前显示的独立页面
 * 与 App 组件完全分离，由 cli.tsx 控制切换
 *
 * 注意：stdin 在 cli.tsx 中被暂停，Splash 不接受任何输入
 */

import { Text } from "ink";
import { APP_NAME, VERSION } from "../constants/meta.js";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";

type Props = {
	message?: string;
};

export default function Splash({ message = "Loading..." }: Props) {
	return (
		<Text bold>
			<Text color={THEME_PINK}>{APP_NAME}</Text>
			<Text color={THEME_LIGHT_YELLOW}> v{VERSION}</Text>
			<Text dimColor> {message}</Text>
		</Text>
	);
}
