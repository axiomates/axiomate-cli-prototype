/**
 * 欢迎页面组件
 *
 * 用户首次使用时显示，创建默认配置后重启应用
 * 测试期间：自动配置硅基流动 API 和测试密钥
 *
 * 注意：DEFAULT_MODEL_PRESETS 定义在此文件中，因为：
 * 1. 这是临时的测试预设
 * 2. 正式版本会根据用户账号派发可用的模型配置
 * 3. 将来会被用户注册/登录流程替代
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";
import { APP_NAME, VERSION } from "../constants/meta.js";
import { DEFAULT_MODEL_ID } from "../constants/models.js";
import useTerminalHeight from "../hooks/useTerminalHeight.js";
import { updateConfig, type ModelConfig } from "../utils/config.js";
import { restartApp } from "../utils/platform.js";
import { resumeInput } from "../utils/stdin.js";
import { useTranslation } from "../hooks/useTranslation.js";
import Divider from "./Divider.js";

/**
 * 默认模型预设列表（测试期间使用）
 *
 * 包含完整的模型配置，包括 baseUrl 和 apiKey
 * 每个模型可以有不同的 API 端点和密钥
 * 正式版本会根据用户账号派发可用的模型配置
 *
 * TODO: 正式发布时移除或改为用户注册流程
 */
const DEFAULT_MODEL_PRESETS: ModelConfig[] = [
	// GLM 系列（智谱）- 使用 SiliconFlow
	{
		model: "THUDM/glm-4-9b-chat",
		name: "GLM-4 9B",
		protocol: "openai",
		description: "Chat model",
		supportsTools: true,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},
	{
		model: "THUDM/GLM-Z1-9B-0414",
		name: "GLM-Z1 9B",
		protocol: "openai",
		description: "Latest GLM",
		supportsTools: true,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},

	// Qwen 系列 - 使用 SiliconFlow
	{
		model: "Qwen/Qwen3-8B",
		name: "Qwen3 8B",
		protocol: "openai",
		description: "Latest Qwen3",
		supportsTools: true,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},
	{
		model: "Qwen/Qwen2-7B-Instruct",
		name: "Qwen2 7B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: false,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},
	{
		model: "Qwen/Qwen2.5-7B-Instruct",
		name: "Qwen2.5 7B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: true,
		contextWindow: 32768,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},
	{
		model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
		name: "Qwen3 Coder 480B",
		protocol: "openai",
		description: "Instruct model",
		supportsTools: true,
		contextWindow: 262144,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},

	// DeepSeek 系列 - 使用 SiliconFlow
	{
		model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
		name: "DeepSeek R1 Qwen 7B",
		protocol: "openai",
		description: "Reasoning distill",
		supportsTools: true,
		contextWindow: 131072,
		baseUrl: "https://api.siliconflow.cn/v1",
		apiKey: "sk-rksqraohycnhvaeosxokhrfpbzhevnykpykulhndkgbxhrqk",
	},
];

/**
 * 将预设列表转换为配置对象
 */
function generateModelConfigs(): Record<string, ModelConfig> {
	const models: Record<string, ModelConfig> = {};
	for (const preset of DEFAULT_MODEL_PRESETS) {
		models[preset.model] = preset;
	}
	return models;
}

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

			// 创建默认配置（测试期间：自动配置所有模型的 API）
			updateConfig({
				models: generateModelConfigs(),
				currentModel: DEFAULT_MODEL_ID,
				suggestionModel: "THUDM/GLM-Z1-9B-0414",
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
					<Text color="yellow">{t("welcome.testVersion")}</Text>
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
