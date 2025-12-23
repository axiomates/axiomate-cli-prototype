/**
 * 快捷键帮助面板组件
 */

import { Box, Text } from "ink";
import { THEME_LIGHT_YELLOW } from "../../../constants/colors.js";
import { useTranslation } from "../../../hooks/useTranslation.js";

type HelpPanelProps = {
	/** 终端宽度 */
	columns: number;
};

export function HelpPanel({ columns }: HelpPanelProps) {
	const { t } = useTranslation();

	return (
		<Box flexDirection="column">
			<Text color="gray">{"─".repeat(columns)}</Text>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>/ </Text>
					<Text color="gray">{t("help.slashCommands")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>@ </Text>
					<Text color="gray">{t("help.atFiles")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Tab </Text>
					<Text color="gray">{t("help.tabComplete")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+Enter </Text>
					<Text color="gray">{t("help.ctrlEnter")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+C </Text>
					<Text color="gray">{t("help.ctrlCExit")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+A </Text>
					<Text color="gray">{t("help.ctrlA")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+E </Text>
					<Text color="gray">{t("help.ctrlE")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+U </Text>
					<Text color="gray">{t("help.ctrlU")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Ctrl+K </Text>
					<Text color="gray">{t("help.ctrlK")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>↑/↓ </Text>
					<Text color="gray">{t("help.upDownBrowse")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Enter </Text>
					<Text color="gray">{t("help.enterConfirm")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>PageUp/PageDown </Text>
					<Text color="gray">{t("help.pageUpDownScroll")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Escape </Text>
					<Text color="gray">{t("help.escapeBack")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>Shift+↑↓ </Text>
					<Text color="gray">{t("help.shiftUpDownSwitch")}</Text>
				</Box>
			</Box>
			<Box flexDirection="row" flexWrap="wrap">
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>e/c </Text>
					<Text color="gray">{t("help.ecExpandCollapse")}</Text>
				</Box>
				<Box width="50%">
					<Text color={THEME_LIGHT_YELLOW}>s/w </Text>
					<Text color="gray">{t("help.swSelectGroups")}</Text>
				</Box>
			</Box>
		</Box>
	);
}
