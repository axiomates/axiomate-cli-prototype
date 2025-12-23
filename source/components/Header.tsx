import { Box, Text } from "ink";
import { APP_NAME } from "../constants/meta.js";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";
import { useTranslation } from "../hooks/useTranslation.js";

type FocusMode = "input" | "output";

type Props = {
	focusMode?: FocusMode;
};

export default function Header({ focusMode = "input" }: Props) {
	const { t } = useTranslation();
	const isOutputMode = focusMode === "output";

	return (
		<Box flexShrink={0} justifyContent="space-between" width="100%">
			<Text>
				<Text color={THEME_PINK} bold>
					{APP_NAME}
				</Text>
				<Text color="gray"> - {t("app.headerHintType")} </Text>
				<Text color={THEME_LIGHT_YELLOW}>/</Text>
				<Text color="gray"> {t("app.headerHintForCommands")} </Text>
				<Text color={THEME_LIGHT_YELLOW}>?</Text>
				<Text color="gray"> {t("app.headerHintForShortcuts")}</Text>
			</Text>
			{/* 模式指示器 */}
			<Text>
				{isOutputMode ? (
					<Text color="cyan" bold>
						[{t("app.browseMode")}] {t("app.modeSwitchHint")}
					</Text>
				) : (
					<Text color="gray">
						[{t("app.inputMode")}] {t("app.modeSwitchHint")}
					</Text>
				)}
			</Text>
		</Box>
	);
}
