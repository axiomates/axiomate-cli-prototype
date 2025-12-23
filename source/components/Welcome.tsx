/**
 * 欢迎页面组件
 *
 * 用户首次使用时显示，完成初始配置后重启应用
 * 当前为测试模式，直接写入预设的 API 配置
 * 未来扩展：用户注册/登录流程
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";
import { APP_NAME, VERSION } from "../constants/meta.js";
import { DEFAULT_MODEL_ID } from "../constants/models.js";
import useTerminalHeight from "../hooks/useTerminalHeight.js";
import { updateConfig } from "../utils/config.js";
import { restartApp } from "../utils/platform.js";
import { resumeInput } from "../utils/stdin.js";
import { useTranslation } from "../hooks/useTranslation.js";
import Divider from "./Divider.js";

// 测试模式预设值（未来替换为用户注册登录）
const PRESET_BASE_URL = "https://api.siliconflow.cn/v1";
const PRESET_API_KEY = "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk";
const PRESET_MODEL = DEFAULT_MODEL_ID;

type Props = {
	onComplete?: () => void; // 可选回调（主要用于测试）
};

export default function Welcome({ onComplete }: Props) {
	const terminalHeight = useTerminalHeight();
	const { t } = useTranslation();
	const [status, setStatus] = useState<"welcome" | "configuring" | "done">(
		"welcome",
	);

	// 组件挂载后恢复 stdin 输入（之前在 cli.tsx 中被暂停）
	useEffect(() => {
		resumeInput();
	}, []);

	// 使用 ref 防止重复触发（同步检查，不受 React 渲染周期影响）
	const isProcessingRef = useRef(false);

	useInput(
		async () => {
			// ref 提供立即的同步保护
			if (isProcessingRef.current) return;
			isProcessingRef.current = true;

			// 用户按任意键
			setStatus("configuring");

			// 写入预设配置（包括默认模型）
			updateConfig({
				AXIOMATE_BASE_URL: PRESET_BASE_URL,
				AXIOMATE_API_KEY: PRESET_API_KEY,
				AXIOMATE_MODEL: PRESET_MODEL,
			});

			setStatus("done");

			// 重启应用（或调用回调用于测试）
			if (onComplete) {
				onComplete();
			} else {
				await restartApp(); // 等待子进程启动后 process.exit(0)
			}
		},
		// isActive: 未处理时才接受输入
		{ isActive: status === "welcome" },
	);

	// 状态文本
	const statusText = {
		welcome: "",
		configuring: t("welcome.configuring"),
		done: t("welcome.restarting"),
	}[status];

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 顶部标题栏 */}
			<Box flexShrink={0}>
				<Text bold>
					<Text color={THEME_PINK}>{APP_NAME}</Text>
					<Text color={THEME_LIGHT_YELLOW}> v{VERSION}</Text>
				</Text>
			</Box>

			{/* 标题分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 欢迎内容区域 - 垂直居中 */}
			<Box
				flexGrow={1}
				flexDirection="column"
				justifyContent="center"
				alignItems="center"
				gap={1}
			>
				<Text bold color={THEME_PINK}>
					{t("welcome.title")}
				</Text>
				<Box flexDirection="column" alignItems="center">
					<Text color={THEME_LIGHT_YELLOW}>{t("welcome.testVersion")}</Text>
					<Text dimColor>{t("welcome.testVersionDesc")}</Text>
				</Box>
			</Box>

			{/* 底部分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 底部状态栏 */}
			<Box flexShrink={0} justifyContent="space-between" width="100%">
				<Text color="green">{t("welcome.pressAnyKey")}</Text>
				{statusText && <Text color="yellow">{statusText}</Text>}
			</Box>
		</Box>
	);
}
