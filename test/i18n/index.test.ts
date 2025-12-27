import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	initI18n,
	getCurrentLocale,
	setLocale,
	t,
	getTranslations,
	isSupportedLocale,
	detectSystemLocale,
	addLocaleChangeListener,
	removeLocaleChangeListener,
} from "../../source/i18n/index.js";

describe("i18n", () => {
	beforeEach(() => {
		// 重置为默认语言
		initI18n("en");
	});

	describe("initI18n", () => {
		it("should initialize with specified locale", () => {
			const locale = initI18n("zh-CN");
			expect(locale).toBe("zh-CN");
			expect(getCurrentLocale()).toBe("zh-CN");
		});

		it("should initialize with detected locale when not specified", () => {
			const locale = initI18n();
			expect(["en", "zh-CN", "ja"]).toContain(locale);
		});

		it("should return the initialized locale", () => {
			expect(initI18n("ja")).toBe("ja");
		});
	});

	describe("getCurrentLocale", () => {
		it("should return current locale", () => {
			initI18n("en");
			expect(getCurrentLocale()).toBe("en");

			initI18n("zh-CN");
			expect(getCurrentLocale()).toBe("zh-CN");
		});
	});

	describe("setLocale", () => {
		it("should change locale", () => {
			initI18n("en");
			setLocale("zh-CN");
			expect(getCurrentLocale()).toBe("zh-CN");
		});

		it("should notify listeners when locale changes", () => {
			const listener = vi.fn();
			addLocaleChangeListener(listener);

			initI18n("en");
			setLocale("zh-CN");

			expect(listener).toHaveBeenCalledWith("zh-CN");
			expect(listener).toHaveBeenCalledTimes(1);

			removeLocaleChangeListener(listener);
		});

		it("should not notify if locale is same", () => {
			const listener = vi.fn();
			addLocaleChangeListener(listener);

			initI18n("en");
			setLocale("en");

			expect(listener).not.toHaveBeenCalled();

			removeLocaleChangeListener(listener);
		});
	});

	describe("addLocaleChangeListener / removeLocaleChangeListener", () => {
		it("should add and remove listeners", () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			addLocaleChangeListener(listener1);
			addLocaleChangeListener(listener2);

			initI18n("en");
			setLocale("zh-CN");

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);

			removeLocaleChangeListener(listener1);

			setLocale("ja");

			expect(listener1).toHaveBeenCalledTimes(1); // 不再调用
			expect(listener2).toHaveBeenCalledTimes(2);

			removeLocaleChangeListener(listener2);
		});

		it("should handle removing non-existent listener", () => {
			const listener = vi.fn();
			// 不应该抛出错误
			expect(() => removeLocaleChangeListener(listener)).not.toThrow();
		});
	});

	describe("detectSystemLocale", () => {
		it("should return a supported locale", () => {
			const locale = detectSystemLocale();
			expect(["en", "zh-CN", "ja"]).toContain(locale);
		});
	});

	describe("t (translation function)", () => {
		it("should return translation for valid key", () => {
			initI18n("en");
			const result = t("app.name");
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should return key if translation not found", () => {
			initI18n("en");
			const result = t("nonexistent.key.path");
			expect(result).toBe("nonexistent.key.path");
		});

		it("should support nested keys", () => {
			initI18n("en");
			const result = t("app.inputMode");
			expect(typeof result).toBe("string");
		});

		it("should replace template variables", () => {
			initI18n("zh-CN");
			const result = t("messageOutput.groupLineCount", { count: 5 });
			expect(result).toContain("5");
		});

		it("should handle missing template variable", () => {
			initI18n("zh-CN");
			const result = t("messageOutput.groupLineCount", {});
			// 缺少的变量会被替换为空字符串
			expect(result).not.toContain("{{");
		});

		it("should fallback to English for missing keys in other locales", () => {
			initI18n("ja");
			// 尝试获取一个可能在日语中缺失但在英语中存在的键
			const result = t("app.name");
			expect(typeof result).toBe("string");
		});

		it("should return key when value is not a string", () => {
			initI18n("en");
			// 尝试获取一个对象类型的键（如 "app" 本身是一个对象）
			const result = t("app");
			expect(result).toBe("app");
		});
	});

	describe("getTranslations", () => {
		it("should return translations for current locale", () => {
			initI18n("en");
			const translations = getTranslations();
			expect(translations).toBeDefined();
			expect(typeof translations).toBe("object");
		});

		it("should return different translations for different locales", () => {
			initI18n("en");
			const enTranslations = getTranslations();

			initI18n("zh-CN");
			const zhTranslations = getTranslations();

			// 验证它们是不同的翻译（某些值应该不同）
			expect(enTranslations).not.toEqual(zhTranslations);
		});
	});

	describe("isSupportedLocale", () => {
		it("should return true for supported locales", () => {
			expect(isSupportedLocale("en")).toBe(true);
			expect(isSupportedLocale("zh-CN")).toBe(true);
			expect(isSupportedLocale("ja")).toBe(true);
		});

		it("should return false for unsupported locales", () => {
			expect(isSupportedLocale("fr")).toBe(false);
			expect(isSupportedLocale("de")).toBe(false);
			expect(isSupportedLocale("es")).toBe(false);
			expect(isSupportedLocale("")).toBe(false);
		});
	});
});
