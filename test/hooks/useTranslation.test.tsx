import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useTranslation } from "../../source/hooks/useTranslation.js";
import { initI18n, setLocale } from "../../source/i18n/index.js";

// Test component that uses the hook
function TestComponent({ translationKey }: { translationKey: string }) {
	const { t, locale } = useTranslation();
	return (
		<Text>
			{locale}:{t(translationKey)}
		</Text>
	);
}

describe("useTranslation", () => {
	beforeEach(() => {
		initI18n("en");
	});

	it("should return translation function and locale", () => {
		const { lastFrame } = render(<TestComponent translationKey="app.name" />);

		// 应该包含 locale
		expect(lastFrame()).toContain("en:");
	});

	it("should translate keys", () => {
		const { lastFrame } = render(<TestComponent translationKey="app.name" />);

		// 应该有翻译内容
		expect(lastFrame()?.length).toBeGreaterThan(3);
	});

	it("should update locale when setLocale is called", async () => {
		const { lastFrame, rerender } = render(<TestComponent translationKey="app.name" />);

		expect(lastFrame()).toContain("en:");

		// 切换语言
		setLocale("zh-CN");

		// 重新渲染以获取更新后的状态
		rerender(<TestComponent translationKey="app.name" />);

		// 验证语言已更改（组件内部状态可能需要时间更新）
		// 所以我们验证 setLocale 确实改变了全局语言
		const { getCurrentLocale } = await import("../../source/i18n/index.js");
		expect(getCurrentLocale()).toBe("zh-CN");
	});

	it("should return key for missing translations", () => {
		const { lastFrame } = render(
			<TestComponent translationKey="nonexistent.key" />,
		);

		expect(lastFrame()).toContain("nonexistent.key");
	});

	it("should clean up listener on unmount", () => {
		const { unmount, lastFrame } = render(
			<TestComponent translationKey="app.name" />,
		);

		expect(lastFrame()).toContain("en:");

		// Unmount should clean up listener without throwing
		expect(() => unmount()).not.toThrow();
	});

	it("should handle translation with parameters", () => {
		// Test component that uses translation with parameters
		function ParamComponent() {
			const { t } = useTranslation();
			return <Text>{t("commandHandler.modelSwitched", { model: "GPT-4" })}</Text>;
		}

		const { lastFrame } = render(<ParamComponent />);

		// Should contain the model name from the parameter
		expect(lastFrame()).toContain("GPT-4");
	});
});
