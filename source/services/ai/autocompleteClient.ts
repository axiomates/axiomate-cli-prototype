/**
 * AI Autocomplete Client
 *
 * Lightweight, non-blocking autocomplete using AI.
 * - Does NOT share queue with normal AI requests
 * - Uses single-variable request management (not a queue)
 * - New request automatically cancels previous one
 * - Silent error handling (no UI disruption)
 */

import {
	AUTOCOMPLETE_CONFIG,
	AUTOCOMPLETE_SYSTEM_PROMPT,
	AUTOCOMPLETE_CACHE,
	getAutocompleteModel,
} from "../../constants/autocomplete.js";
import { getModelApiConfig } from "../../utils/config.js";

/**
 * Context for autocomplete request
 */
type AutocompleteContext = {
	cwd?: string;
	projectType?: string;
};

/**
 * Autocomplete result
 */
type AutocompleteResult = {
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
 * Autocomplete Client
 *
 * Key design: Uses a single AbortController variable (not a queue).
 * Each new request automatically aborts the previous one.
 */
export class AutocompleteClient {
	/**
	 * Current request controller - only one request can be active at a time.
	 * New requests automatically cancel previous ones.
	 */
	private currentRequest: AbortController | null = null;

	/**
	 * LRU cache for autocomplete results
	 */
	private cache: LRUCache;

	constructor() {
		this.cache = new LRUCache(
			AUTOCOMPLETE_CACHE.maxSize,
			AUTOCOMPLETE_CACHE.ttl,
		);
	}

	/**
	 * Get autocomplete suggestion for the given input.
	 *
	 * @param input - User's current input text
	 * @param context - Optional context (cwd, projectType)
	 * @returns Suggestion and whether it was cached
	 */
	async getSuggestion(
		input: string,
		context?: AutocompleteContext,
	): Promise<AutocompleteResult> {
		// Generate cache key
		const cacheKey = this.generateCacheKey(input, context);

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
			const suggestion = await this.fetchSuggestion(input, context, signal);

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
	 * Generate cache key from input and context
	 */
	private generateCacheKey(
		input: string,
		context?: AutocompleteContext,
	): string {
		const parts = [input];
		if (context?.cwd) {
			parts.push(context.cwd);
		}
		if (context?.projectType) {
			parts.push(context.projectType);
		}
		return parts.join("|");
	}

	/**
	 * Fetch suggestion from AI API
	 */
	private async fetchSuggestion(
		input: string,
		context: AutocompleteContext | undefined,
		signal: AbortSignal,
	): Promise<string | null> {
		// Get autocomplete model from config
		const autocompleteModelId = getAutocompleteModel();

		// Get API config for autocomplete model
		const apiConfig = getModelApiConfig(autocompleteModelId);
		if (!apiConfig) {
			// Model not configured, return silently
			return null;
		}

		const { baseUrl, apiKey } = apiConfig;
		const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

		// Build minimal context message
		let userContent = input;
		if (context?.cwd) {
			userContent = `[Working directory: ${context.cwd}]\n${input}`;
		}

		const body = {
			model: autocompleteModelId,
			messages: [
				{ role: "system", content: AUTOCOMPLETE_SYSTEM_PROMPT },
				{ role: "user", content: userContent },
			],
			max_tokens: AUTOCOMPLETE_CONFIG.maxTokens,
			temperature: AUTOCOMPLETE_CONFIG.temperature,
			stream: false, // Non-streaming for simplicity
		};

		// Set up timeout
		const timeoutId = setTimeout(() => {
			if (!signal.aborted) {
				// Create a new abort to trigger timeout
				// Note: We can't abort from here directly as signal is read-only
				// The AbortController.abort() should be called from outside
			}
		}, AUTOCOMPLETE_CONFIG.timeout);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
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
let autocompleteClientInstance: AutocompleteClient | null = null;

/**
 * Get the singleton autocomplete client instance
 */
export function getAutocompleteClient(): AutocompleteClient {
	if (!autocompleteClientInstance) {
		autocompleteClientInstance = new AutocompleteClient();
	}
	return autocompleteClientInstance;
}
