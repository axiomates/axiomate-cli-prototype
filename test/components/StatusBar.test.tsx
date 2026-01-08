import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import StatusBar from "../../source/components/StatusBar.js";

// Mock useTranslation
vi.mock("../../source/hooks/useTranslation.js", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"statusBar.notConfigured": "N/A",
				"statusBar.planMode": "Plan",
				"statusBar.actionMode": "Action",
			};
			return translations[key] || key;
		},
	}),
}));

describe("StatusBar", () => {
	describe("plan mode", () => {
		it("should show action mode by default", () => {
			const { lastFrame } = render(<StatusBar />);
			expect(lastFrame()).toContain("[Action]");
		});

		it("should show plan mode when planMode is true", () => {
			const { lastFrame } = render(<StatusBar planMode={true} />);
			expect(lastFrame()).toContain("[Plan]");
		});

		it("should show action mode when planMode is false", () => {
			const { lastFrame } = render(<StatusBar planMode={false} />);
			expect(lastFrame()).toContain("[Action]");
		});
	});

	describe("usage display", () => {
		it("should show N/A when contextWindow is not provided", () => {
			const { lastFrame } = render(<StatusBar />);
			expect(lastFrame()).toContain("N/A");
		});

		it("should show N/A when contextWindow is 0", () => {
			const { lastFrame } = render(
				<StatusBar contextWindow={0} usedTokens={100} usagePercent={0} />,
			);
			expect(lastFrame()).toContain("N/A");
		});

		it("should show usage in correct format", () => {
			const { lastFrame } = render(
				<StatusBar
					contextWindow={32000}
					usedTokens={1500}
					usagePercent={4.7}
				/>,
			);
			expect(lastFrame()).toContain("1.5k/32k");
			expect(lastFrame()).toContain("(5%)");
		});

		it("should format small numbers without k suffix", () => {
			const { lastFrame } = render(
				<StatusBar contextWindow={999} usedTokens={500} usagePercent={50} />,
			);
			expect(lastFrame()).toContain("500/999");
			expect(lastFrame()).toContain("(50%)");
		});

		it("should format large numbers with k suffix", () => {
			const { lastFrame } = render(
				<StatusBar
					contextWindow={128000}
					usedTokens={25600}
					usagePercent={20}
				/>,
			);
			expect(lastFrame()).toContain("26k/128k");
			expect(lastFrame()).toContain("(20%)");
		});

		it("should show 0 tokens when usedTokens is not provided", () => {
			const { lastFrame } = render(
				<StatusBar contextWindow={32000} usagePercent={0} />,
			);
			expect(lastFrame()).toContain("0/32k");
			expect(lastFrame()).toContain("(0%)");
		});
	});
});
