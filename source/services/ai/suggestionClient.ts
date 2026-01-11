/**
 * AI Suggestion Client
 *
 * Lightweight, non-blocking suggestion using AI.
 * - Does NOT share queue with normal AI requests
 * - Uses single-variable request management (not a queue)
 * - New request automatically cancels previous one
 * - Silent error handling (no UI disruption)
 */

import {
	SUGGESTION_CONFIG,
	SUGGESTION_SYSTEM_PROMPT,
	SUGGESTION_CACHE,
	getSuggestionModel,
} from "../../constants/suggestion.js";
import {
	getModelApiConfig,
	getSuggestionThinkingParams,
} from "../../utils/config.js";
import { stableStringify } from "../../utils/json.js";


/**
 * Suggestion result
 */
type SuggestionResult = {
	suggestion: string | null;
	cached: boolean;
};

/**
 * LRU Cache entry
 */
type CacheEntry = {
	suggestion: string | null;
	timestamp: number;
};

/**
 * Simple LRU Cache implementation
 */
class LRUCache {
	private cache = new Map<string, CacheEntry>();
	private maxSize: number;
	private ttl: number;

	constructor(maxSize: number, ttl: number) {
		this.maxSize = maxSize;
		this.ttl = ttl;
	}

	get(key: string): CacheEntry | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;

		// Check TTL
		if (Date.now() - entry.timestamp > this.ttl) {
			this.cache.delete(key);
			return undefined;
		}

		// Move to end (most recently used)
		this.cache.delete(key);
		this.cache.set(key, entry);
		return entry;
	}

	set(key: string, suggestion: string | null): void {
		// Delete if exists to update position
		this.cache.delete(key);

		// Evict oldest if at capacity
		if (this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			suggestion,
			timestamp: Date.now(),
		});
	}

	clear(): void {
		this.cache.clear();
	}
}

/**
 * Suggestion Client
 *
 * Key design: Uses a single AbortController variable (not a queue).
 * Each new request automatically aborts the previous one.
 */
export class SuggestionClient {
	/**
	 * Current request controller - only one request can be active at a time.
	 * New requests automatically cancel previous ones.
	 */
	private currentRequest: AbortController | null = null;

	/**
	 * LRU cache for suggestion results
	 */
	private cache: LRUCache;

	constructor() {
		this.cache = new LRUCache(SUGGESTION_CACHE.maxSize, SUGGESTION_CACHE.ttl);
	}

	/**
	 * Get suggestion for the given input.
	 *
	 * @param input - User's current input text
	 * @returns Suggestion and whether it was cached
	 */
	async getSuggestion(input: string): Promise<SuggestionResult> {
		// Generate cache key
		const cacheKey = input;

		// Check cache first
		const cached = this.cache.get(cacheKey);
		if (cached) {
			return { suggestion: cached.suggestion, cached: true };
		}

		// Cancel previous request if any
		if (this.currentRequest) {
			this.currentRequest.abort();
		}

		// Create new AbortController
		this.currentRequest = new AbortController();
		const signal = this.currentRequest.signal;

		try {
			const suggestion = await this.fetchSuggestion(input, signal);

			// Cache the result (only if request wasn't aborted)
			if (!signal.aborted) {
				this.cache.set(cacheKey, suggestion);
			}

			return { suggestion, cached: false };
		} catch (error) {
			// Silent error handling - return null suggestion
			// Don't log AbortError (expected when user keeps typing)
			if (error instanceof Error && error.name !== "AbortError") {
				// Could add debug logging here if needed
			}
			return { suggestion: null, cached: false };
		} finally {
			// Clear current request reference if this request is still current
			if (this.currentRequest?.signal === signal) {
				this.currentRequest = null;
			}
		}
	}

	/**
	 * Cancel any in-progress request
	 */
	cancel(): void {
		if (this.currentRequest) {
			this.currentRequest.abort();
			this.currentRequest = null;
		}
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear();
	}


	/**
	 * Fetch suggestion from AI API
	 */
	private async fetchSuggestion(
		input: string,
		signal: AbortSignal,
	): Promise<string | null> {
		// Get suggestion model from config
		const suggestionModelId = getSuggestionModel();

		// Get API config for suggestion model
		const apiConfig = getModelApiConfig(suggestionModelId);
		if (!apiConfig) {
			// Model not configured, return silently
			return null;
		}

		const { baseUrl, apiKey } = apiConfig;
		const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

		const body = {
			model: suggestionModelId,
			messages: [
				{ role: "system", content: SUGGESTION_SYSTEM_PROMPT },
				{ role: "user", content: input },
			],
			max_tokens: SUGGESTION_CONFIG.maxTokens,
			temperature: SUGGESTION_CONFIG.temperature,
			stream: false, // Non-streaming for simplicity
		};

		// 禁用 thinking 模式（如果模型支持）以确保快速响应
		const thinkingParams = getSuggestionThinkingParams(suggestionModelId);
		if (thinkingParams) {
			Object.assign(body, thinkingParams);
		}

		// Set up timeout
		const timeoutId = setTimeout(() => {
			if (!signal.aborted) {
				// Create a new abort to trigger timeout
				// Note: We can't abort from here directly as signal is read-only
				// The AbortController.abort() should be called from outside
			}
		}, SUGGESTION_CONFIG.timeout);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				// 使用 stableStringify 确保键顺序一致，提高 KV 缓存命中率
				body: stableStringify(body),
				signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				// Silent failure - don't disrupt user experience
				return null;
			}

			const data = (await response.json()) as {
				choices?: Array<{
					message?: {
						content?: string;
					};
				}>;
			};

			const content = data.choices?.[0]?.message?.content;
			if (!content || content.trim() === "") {
				return null;
			}

			// Clean up the suggestion
			return this.cleanSuggestion(content, input);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Clean up the AI's suggestion
	 * - Remove leading/trailing whitespace
	 * - Remove quotes if the AI wrapped the response
	 * - Ensure it doesn't repeat the input
	 * - Replace newlines with spaces (single-line display)
	 */
	private cleanSuggestion(suggestion: string, input: string): string | null {
		let cleaned = suggestion.trim();

		// Remove surrounding quotes if present
		if (
			(cleaned.startsWith('"') && cleaned.endsWith('"')) ||
			(cleaned.startsWith("'") && cleaned.endsWith("'"))
		) {
			cleaned = cleaned.slice(1, -1);
		}

		// Replace all newlines (\n, \r, \r\n) with a single space
		// This ensures suggestions are always single-line
		cleaned = cleaned.replace(/\r\n|\r|\n/g, " ");

		// Collapse multiple consecutive spaces into one
		cleaned = cleaned.replace(/\s+/g, " ");

		// If the suggestion is empty or just whitespace, return null
		if (!cleaned || cleaned.trim() === "") {
			return null;
		}

		// If the suggestion starts with the input (model repeated it), remove that part
		if (cleaned.toLowerCase().startsWith(input.toLowerCase())) {
			cleaned = cleaned.slice(input.length);
		}

		// Final cleanup
		cleaned = cleaned.trim();

		return cleaned || null;
	}
}

/**
 * Singleton instance
 */
let suggestionClientInstance: SuggestionClient | null = null;

/**
 * Get the singleton suggestion client instance
 */
export function getSuggestionClient(): SuggestionClient {
	if (!suggestionClientInstance) {
		suggestionClientInstance = new SuggestionClient();
	}
	return suggestionClientInstance;
}
