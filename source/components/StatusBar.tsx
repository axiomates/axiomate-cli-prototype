import { Box, Text } from "ink";
import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation.js";

type Props = {
	planMode?: boolean;
	usedTokens?: number;
	contextWindow?: number;
	usagePercent?: number;
	isNearLimit?: boolean;
	isFull?: boolean;
	isWorking?: boolean;
};

// 脉动点的不同大小状态
const PULSE_DOTS = ["·", "•", "●", "•"];
const IDLE_DOT = "·";
const PULSE_INTERVAL = 200; // ms

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

/**
 * 脉动点组件 - 显示工作状态
 */
function PulseDot({ isWorking }: { isWorking: boolean }) {
	const [dotIndex, setDotIndex] = useState(0);

	useEffect(() => {
		if (!isWorking) {
			setDotIndex(0);
			return;
		}

		const timer = setInterval(() => {
			setDotIndex((prev) => (prev + 1) % PULSE_DOTS.length);
		}, PULSE_INTERVAL);

		return () => clearInterval(timer);
	}, [isWorking]);

	const dot = isWorking ? PULSE_DOTS[dotIndex] : IDLE_DOT;
	const color = isWorking ? "green" : "gray";

	return <Text color={color}>{dot} </Text>;
}

export default function StatusBar({
	planMode = false,
	usedTokens,
	contextWindow,
	usagePercent,
	isNearLimit,
	isFull,
	isWorking = false,
}: Props) {
	const { t } = useTranslation();

	// Determine usage display color
	const getUsageColor = (): string => {
		if (isFull) return "red";
		if (isNearLimit) return "yellow";
		return "gray";
	};

	// Render plan mode indicator
	const renderPlanMode = () => (
		<Text color={planMode ? "magenta" : "green"}>
			[{planMode ? t("statusBar.planMode") : t("statusBar.actionMode")}]{" "}
		</Text>
	);

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
				{formatTokens(used)}/{formatTokens(contextWindow)} (
				{Math.round(percent)}%){" "}
			</Text>
		);
	};

	return (
		<Box flexShrink={0} justifyContent="flex-end" width="100%">
			{/* 脉动点 - 工作状态指示器 */}
			<PulseDot isWorking={isWorking} />
			{/* Plan/Action 模式指示器 */}
			{renderPlanMode()}
			{/* Usage 指示器 */}
			{renderUsage()}
		</Box>
	);
}
