import { Box, Text } from "ink";
import { useTranslation } from "../hooks/useTranslation.js";

type FocusMode = "input" | "output";

type Props = {
	focusMode?: FocusMode;
	usedTokens?: number;
	contextWindow?: number;
	usagePercent?: number;
	isNearLimit?: boolean;
	isFull?: boolean;
};

/**
 * Format token number with k suffix for thousands
 * e.g., 500 -> "500", 1200 -> "1.2k", 32000 -> "32k"
 */
function formatTokens(tokens: number): string {
	if (tokens < 1000) {
		return String(tokens);
	}
	const k = tokens / 1000;
	// Show one decimal if less than 10k, otherwise whole number
	if (k < 10) {
		return `${k.toFixed(1)}k`;
	}
	return `${Math.round(k)}k`;
}

export default function StatusBar({
	focusMode = "input",
	usedTokens,
	contextWindow,
	usagePercent,
	isNearLimit,
	isFull,
}: Props) {
	const { t } = useTranslation();
	const isOutputMode = focusMode === "output";

	// Determine usage display color
	const getUsageColor = (): string => {
		if (isFull) return "red";
		if (isNearLimit) return "yellow";
		return "gray";
	};

	// Render usage display
	const renderUsage = () => {
		// Handle not configured case (contextWindow is 0 or undefined)
		if (!contextWindow || contextWindow === 0) {
			return <Text color="gray">{t("statusBar.notConfigured")} </Text>;
		}

		const used = usedTokens ?? 0;
		const percent = usagePercent ?? 0;
		const usageColor = getUsageColor();

		return (
			<Text color={usageColor}>
				{formatTokens(used)}/{formatTokens(contextWindow)} ({Math.round(percent)}%){" "}
			</Text>
		);
	};

	return (
		<Box flexShrink={0} justifyContent="flex-end" width="100%">
			{/* Usage 指示器 */}
			{renderUsage()}
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
