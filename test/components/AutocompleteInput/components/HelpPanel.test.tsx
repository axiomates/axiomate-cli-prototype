import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import React from "react";

// Mock i18n with all required exports
vi.mock("../../../../source/i18n/index.js", () => ({
	t: vi.fn((key) => key),
	getCurrentLocale: vi.fn(() => "en"),
	addLocaleChangeListener: vi.fn(),
	removeLocaleChangeListener: vi.fn(),
}));

import { HelpPanel } from "../../../../source/components/AutocompleteInput/components/HelpPanel.js";

describe("HelpPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render help panel with shortcuts", () => {
		const { lastFrame } = render(<HelpPanel columns={80} />);

		const frame = lastFrame()!;

		// Check shortcut keys are displayed
		expect(frame).toContain("/");
		expect(frame).toContain("@");
		expect(frame).toContain("Tab");
		expect(frame).toContain("Enter");
		expect(frame).toContain("↑/↓");
		expect(frame).toContain("Ctrl+Enter");
	});

	it("should render all keyboard shortcuts", () => {
		const { lastFrame } = render(<HelpPanel columns={80} />);

		const frame = lastFrame()!;

		// Navigation shortcuts
		expect(frame).toContain("Ctrl+A");
		expect(frame).toContain("Ctrl+E");
		expect(frame).toContain("Ctrl+U");
		expect(frame).toContain("Ctrl+K");
	});

	it("should render browse mode shortcuts", () => {
		const { lastFrame } = render(<HelpPanel columns={80} />);

		const frame = lastFrame()!;

		expect(frame).toContain("Shift+↑↓");
		expect(frame).toContain("PageUp/PageDown");
		expect(frame).toContain("e/c");
		expect(frame).toContain("s/w");
	});

	it("should render exit shortcuts", () => {
		const { lastFrame } = render(<HelpPanel columns={80} />);

		const frame = lastFrame()!;

		expect(frame).toContain("Escape");
		expect(frame).toContain("Ctrl+C");
	});

	it("should display translation keys as descriptions", () => {
		const { lastFrame } = render(<HelpPanel columns={80} />);

		const frame = lastFrame()!;

		// Since we mock t() to return the key, check for translation keys
		expect(frame).toContain("help.slashCommands");
		expect(frame).toContain("help.atFiles");
		expect(frame).toContain("help.tabComplete");
		expect(frame).toContain("help.enterConfirm");
	});

	it("should render horizontal separator", () => {
		const { lastFrame } = render(<HelpPanel columns={40} />);

		const frame = lastFrame()!;

		// Should have a separator line made of "─"
		expect(frame).toContain("─");
	});

	it("should adapt to different column widths", () => {
		const narrow = render(<HelpPanel columns={40} />);
		const wide = render(<HelpPanel columns={120} />);

		// Both should render successfully
		expect(narrow.lastFrame()).toBeDefined();
		expect(wide.lastFrame()).toBeDefined();
	});
});
