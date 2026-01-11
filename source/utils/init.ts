/**
 * 应用初始化模块
 *
 * 封装所有异步初始化逻辑，供 cli.tsx 在渲染 App 前调用
 *
 * 采用两阶段初始化策略实现瞬间启动：
 * 1. 快速阶段：加载内置工具 + 创建 AI 服务（毫秒级）
 * 2. 后台阶段：发现外部工具（不阻塞 UI）
 */

import { getToolRegistry } from "../services/tools/registry.js";
import {
	createAIServiceFromConfig,
	getCurrentModel,
	type IAIService,
	type ModelConfig,
} from "../services/ai/index.js";
import { t } from "../i18n/index.js";
import { cleanupScriptsDir } from "../services/tools/scriptWriter.js";

export type InitResult = {
	aiService: IAIService | null;
	currentModel: ModelConfig | null;
};

export type InitProgress = {
	stage: "tools" | "ai" | "done";
	message: string;
};

/**
 * 执行应用初始化（快速启动版本）
 *
 * 只加载内置工具，外部工具在后台发现
 * 启动时间从几秒缩短到毫秒级
 *
 * @param onProgress 进度回调，用于更新 Splash 显示
 * @returns 初始化结果，包含 AI 服务实例
 */
export async function initApp(
	onProgress?: (progress: InitProgress) => void,
): Promise<InitResult> {
	// 阶段 0: 清理上次运行的临时脚本文件（快速）
	cleanupScriptsDir(process.cwd());

	// 阶段 1: 加载内置工具（瞬间完成）
	onProgress?.({ stage: "tools", message: t("splash.discoveringTools") });
	const registry = getToolRegistry();
	await registry.loadBuiltinTools();

	// 阶段 2: 创建 AI 服务（使用已加载的内置工具）
	onProgress?.({ stage: "ai", message: t("splash.loadingAI") });
	const aiService = createAIServiceFromConfig(registry);
	const currentModel = getCurrentModel();

	// 阶段 3: 后台发现外部工具（不阻塞）
	registry.discoverExternalAsync();

	// 注册回调：外部工具发现完成后冻结工具列表
	registry.onDiscoveryComplete(() => {
		// 冻结工具列表，之后不再变化，优化 KV cache
		registry.freezeTools();
	});

	// 完成
	onProgress?.({ stage: "done", message: t("splash.loading") });

	return { aiService, currentModel };
}
