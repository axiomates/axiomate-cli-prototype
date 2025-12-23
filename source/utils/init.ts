/**
 * 应用初始化模块
 *
 * 封装所有异步初始化逻辑，供 cli.tsx 在渲染 App 前调用
 */

import { getToolRegistry } from "../services/tools/registry.js";
import {
	createAIServiceFromConfig,
	getCurrentModel,
	type IAIService,
	type ModelConfig,
} from "../services/ai/index.js";
import { t } from "../i18n/index.js";

export type InitResult = {
	aiService: IAIService | null;
	currentModel: ModelConfig | null;
};

export type InitProgress = {
	stage: "tools" | "ai" | "done";
	message: string;
};

/**
 * 执行应用初始化
 *
 * @param onProgress 进度回调，用于更新 Splash 显示
 * @returns 初始化结果，包含 AI 服务实例
 */
export async function initApp(
	onProgress?: (progress: InitProgress) => void,
): Promise<InitResult> {
	// 阶段 1: 发现本地工具
	onProgress?.({ stage: "tools", message: t("splash.discoveringTools") });
	const registry = getToolRegistry();
	await registry.discover();

	// 阶段 2: 创建 AI 服务
	onProgress?.({ stage: "ai", message: t("splash.loadingAI") });
	const aiService = createAIServiceFromConfig(registry);
	const currentModel = getCurrentModel();

	// 完成
	onProgress?.({ stage: "done", message: t("splash.loading") });

	return { aiService, currentModel };
}
