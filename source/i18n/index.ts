// i18n core implementation

import { type Locale, type Translations } from "./types.js";
import enTranslations from "./locales/en.json" with { type: "json" };
import zhCNTranslations from "./locales/zh-CN.json" with { type: "json" };
import jaTranslations from "./locales/ja.json" with { type: "json" };

// Available translations
const translations: Record<Locale, Translations> = {
	en: enTranslations as Translations,
	"zh-CN": zhCNTranslations as Translations,
	ja: jaTranslations as Translations,
};

// Current locale (mutable singleton)
let currentLocale: Locale = "en";

// Locale change listeners
type LocaleChangeListener = (newLocale: Locale) => void;
const localeChangeListeners: LocaleChangeListener[] = [];

/**
 * Add a listener for locale changes
 */
export function addLocaleChangeListener(
	listener: LocaleChangeListener,
): void {
	localeChangeListeners.push(listener);
}

/**
 * Remove a locale change listener
 */
export function removeLocaleChangeListener(
	listener: LocaleChangeListener,
): void {
	const index = localeChangeListeners.indexOf(listener);
	if (index !== -1) {
		localeChangeListeners.splice(index, 1);
	}
}

/**
 * Notify all listeners of locale change
 */
function notifyLocaleChange(newLocale: Locale): void {
	for (const listener of localeChangeListeners) {
		listener(newLocale);
	}
}

/**
 * Detect system locale using Intl API (cross-platform)
 * Falls back to English if no match or unsupported locale
 */
export function detectSystemLocale(): Locale {
	try {
		const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
		if (systemLocale.startsWith("en")) {
			return "en";
		}
		if (systemLocale.startsWith("zh")) {
			return "zh-CN";
		}
		if (systemLocale.startsWith("ja")) {
			return "ja";
		}
	} catch {
		// Intl API not available, fall through to default
	}

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
 * Set current locale and notify listeners
 */
export function setLocale(locale: Locale): void {
	if (currentLocale !== locale) {
		currentLocale = locale;
		notifyLocaleChange(locale);
	}
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
	return locale === "en" || locale === "zh-CN" || locale === "ja";
}

// Re-export types
export type { Locale, Translations } from "./types.js";
