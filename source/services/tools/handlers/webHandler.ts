/**
 * Web fetch handler
 * Handles HTTP requests and HTML-to-text conversion
 */

import type { RegisteredHandler, ExecutionResult } from "./types.js";
import { htmlToText } from "../webUtils.js";
import { getCurrentModelId, getModelById } from "../../../utils/config.js";

/**
 * Web handler - handles web fetch action
 */
export const webHandler: RegisteredHandler = {
	name: "web",
	matches: (ctx) => ctx.tool.id === "a-c-web" && ctx.action.name === "fetch",
	handle: async (ctx) => {
		const url = ctx.params.url as string;
		const timeout = ctx.options?.timeout;
		return executeWebFetch(url, timeout);
	},
};

/**
 * Execute web fetch
 * Fetches URL content and converts HTML to readable text
 */
async function executeWebFetch(
	url: string,
	timeout?: number,
): Promise<ExecutionResult> {
	try {
		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: `Invalid URL: ${url}`,
			};
		}

		// Only allow http/https
		if (!parsedUrl.protocol.startsWith("http")) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: null,
				error: `Unsupported protocol: ${parsedUrl.protocol}`,
			};
		}

		// Fetch with timeout
		const controller = new AbortController();
		const timeoutMs = timeout ?? 60000; // 1 minute default
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; axiomate/1.0; +https://github.com/anthropics/axiomate)",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
			},
		});

		clearTimeout(timer);

		if (!response.ok) {
			return {
				success: false,
				stdout: "",
				stderr: "",
				exitCode: response.status,
				error: `HTTP ${response.status}: ${response.statusText}`,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		const text = await response.text();

		// Convert HTML to readable text
		let content: string;
		if (contentType.includes("text/html")) {
			content = htmlToText(text);
		} else {
			content = text;
		}

		// Calculate max length based on model's context window
		// Use ~4 chars per token, reserve 50% for response
		const modelId = getCurrentModelId();
		const model = modelId ? getModelById(modelId) : null;
		const contextWindow = model?.contextWindow ?? 32000; // Default 32K if no model
		const maxTokensForContent = Math.floor(contextWindow * 0.5); // 50% for content
		const maxLength = maxTokensForContent * 4; // ~4 chars per token

		if (content.length > maxLength) {
			content =
				content.substring(0, maxLength) +
				`\n\n[Content truncated, total ${content.length} characters, limit ${maxLength} based on context window ${contextWindow}]`;
		}

		return {
			success: true,
			stdout: `[URL: ${url}]\n[Content-Type: ${contentType}]\n\n${content}`,
			stderr: "",
			exitCode: 0,
		};
	} catch (err) {
		const message =
			err instanceof Error
				? err.name === "AbortError"
					? "Request timed out"
					: err.message
				: String(err);
		return {
			success: false,
			stdout: "",
			stderr: "",
			exitCode: null,
			error: message,
		};
	}
}
