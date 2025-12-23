/**
 * 模型定义
 *
 * 提供默认模型 ID 和辅助函数
 * 运行时模型配置从 ~/.axiomate.json 读取
 *
 * 注意：模型预设列表（DEFAULT_MODEL_PRESETS）定义在 Welcome.tsx 中，
 * 因为它是临时的测试预设，正式版本会根据用户账号派发可用的模型配置
 */

import { getAllModels, getModelById, type ModelConfig } from "../utils/config.js";

/**
 * API 协议类型
 * - openai: OpenAI 兼容协议（/chat/completions）
 * - anthropic: Anthropic 原生协议（/messages）
 */
export type { ApiProtocol, ModelConfig } from "../utils/config.js";

/**
 * 默认模型 ID（开箱即用）
 */
export const DEFAULT_MODEL_ID = "Qwen/Qwen3-8B";

// ============================================================================
// 辅助函数（从配置读取）
// ============================================================================

/**
 * 获取所有模型配置（从配置文件读取）
 */
export { getAllModels, getModelById };

/**
 * 获取默认模型配置
 *
 * 从配置文件读取默认模型（DEFAULT_MODEL_ID）
 * 如果配置中没有该模型，返回 null
 *
 * 注意：首次启动时 Welcome.tsx 会生成模型配置并写入 ~/.axiomate.json
 * 因此正常使用中不应该返回 null
 */
export function getDefaultModel(): ModelConfig | null {
	return getModelById(DEFAULT_MODEL_ID) ?? null;
}
