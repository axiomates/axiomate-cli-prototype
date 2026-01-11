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
export const SUGGESTION_SYSTEM_PROMPT = `You are an autocomplete engine. Your ONLY task is to predict the next few words the user will type.

CRITICAL RULES:
- This is TEXT COMPLETION, NOT question answering
- Return ONLY the continuation (what comes AFTER the user's current text)
- Maximum 1-10 words
- DO NOT answer questions - just complete the sentence
- DO NOT explain anything - just predict what they will type next
- DO NOT repeat what the user already typed
- Return empty string if uncertain

Examples:
User types: "How do I"
Complete with: "install this package"

User types: "Can you help me with"
Complete with: "this error"

User types: "I want to"
Complete with: "fix the bug"

Remember: You are a text predictor, NOT a conversational assistant.`;

/**
 * LRU Cache settings
 */
export const SUGGESTION_CACHE = {
	/** Maximum number of cached entries */
	maxSize: 50,
	/** Time-to-live for cache entries (ms) */
	ttl: 60000, // 1 minute
} as const;
