// i18n core implementation

import { type Locale, type Translations } from "./types.js";
import enTranslations from "./locales/en.json" with { type: "json" };
import zhCNTranslations from "./locales/zh-CN.json" with { type: "json" };

// Available translations
const translations: Record<Locale, Translations> = {
	en: enTranslations as Translations,
	"zh-CN": zhCNTranslations as Translations,
};

// Current locale (mutable singleton)
let currentLocale: Locale = "en";

/**
 * Detect system locale from environment variables
 * Falls back to English if no match
 */
export function detectSystemLocale(): Locale {
	const lang =
		process.env.LANG ||
		process.env.LANGUAGE ||
		process.env.LC_ALL ||
		process.env.LC_MESSAGES ||
		"";

	// Match Chinese locales
	if (lang.startsWith("zh")) {
		return "zh-CN";
	}

	// Default to English
	return "en";
}

/**
 * Initialize i18n with detected or specified locale
 */
export function initI18n(locale?: Locale): Locale {
	currentLocale = locale || detectSystemLocale();
	return currentLocale;
}

/**
 * Get current locale
 */
export function getCurrentLocale(): Locale {
	return currentLocale;
}

/**
 * Set current locale
 */
export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

/**
 * Get translation for a key path
 * Supports nested keys with dot notation: "app.inputMode"
 * Supports template variables: "Hello {{name}}" with { name: "World" }
 */
export function t(
	key: string,
	params?: Record<string, string | number>,
): string {
	const keys = key.split(".");
	let value: unknown = translations[currentLocale];

	// Navigate through nested keys
	for (const k of keys) {
		if (value && typeof value === "object" && k in value) {
			value = (value as Record<string, unknown>)[k];
		} else {
			// Fallback to English if key not found
			let fallback: unknown = translations.en;
			for (const fk of keys) {
				if (fallback && typeof fallback === "object" && fk in fallback) {
					fallback = (fallback as Record<string, unknown>)[fk];
				} else {
					// Return key itself if not found in any locale
					return key;
				}
			}
			value = fallback;
			break;
		}
	}

	if (typeof value !== "string") {
		return key;
	}

	// Replace template variables: {{name}} -> value
	if (params) {
		return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
			const paramValue = params[paramKey];
			return paramValue !== undefined ? String(paramValue) : "";
		});
	}

	return value;
}

/**
 * Get all translations for current locale
 */
export function getTranslations(): Translations {
	return translations[currentLocale];
}

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): locale is Locale {
	return locale === "en" || locale === "zh-CN";
}

// Re-export types
export type { Locale, Translations } from "./types.js";
