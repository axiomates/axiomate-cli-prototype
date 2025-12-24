/**
 * AI Suggestion Configuration
 *
 * Internal configuration for AI-powered text completion.
 * Model is read from user config (~/.axiomate.json).
 */

import { getSuggestionModelId } from "../utils/config.js";

/**
 * 获取自动补全模型 ID
 * 从配置文件读取，如果未配置则使用默认值
 */
export function getSuggestionModel(): string {
	const modelId = getSuggestionModelId();
	return modelId || "THUDM/GLM-Z1-9B-0414"; // 默认使用 GLM-Z1-9B
}

/**
 * Suggestion model configuration
 */
export const SUGGESTION_CONFIG = {
	/** Maximum tokens for completion response */
	maxTokens: 30,
	/** Request timeout in milliseconds */
	timeout: 3000,
	/** Temperature for generation (lower = more focused) */
	temperature: 0.3,
} as const;

/**
 * Debounce delay before triggering suggestion (ms)
 */
export const SUGGESTION_DEBOUNCE_MS = 400;

/**
 * Minimum input length to trigger suggestion
 */
export const MIN_INPUT_LENGTH = 5;

/**
 * System prompt for suggestion
 * Instructs the model to provide short, contextual completions
 */
export const SUGGESTION_SYSTEM_PROMPT = `You are a suggestion assistant. Complete the user's input with a short continuation.

Rules:
- Return ONLY the completion text (what comes after the user's input)
- Keep completions short (1-10 words maximum)
- Return empty string if no good completion exists
- Match the user's language and writing style
- Do not repeat the user's input
- Do not add explanations or commentary`;

/**
 * LRU Cache settings
 */
export const SUGGESTION_CACHE = {
	/** Maximum number of cached entries */
	maxSize: 50,
	/** Time-to-live for cache entries (ms) */
	ttl: 60000, // 1 minute
} as const;
