// React hook for translations

import { useMemo } from "react";
import { t as translate, getCurrentLocale, type Locale } from "../i18n/index.js";

/**
 * Hook for accessing translations in React components
 * Returns the translation function and current locale
 */
export function useTranslation() {
	const locale = useMemo(() => getCurrentLocale(), []);

	const t = useMemo(
		() => (key: string, params?: Record<string, string | number>) => {
			return translate(key, params);
		},
		[locale],
	);

	return { t, locale };
}

export type { Locale };
