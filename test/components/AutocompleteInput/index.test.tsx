import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import AutocompleteInput from "../../../source/components/AutocompleteInput/index.js";

// Mock hooks
vi.mock("../../../source/hooks/useTerminalWidth.js", () => ({
	default: vi.fn(() => 80),
}));

// Mock useApp from ink
vi.mock("ink", async () => {
	const actual = await vi.importActual("ink");
	return {
		...actual,
		useApp: () => ({ exit: vi.fn() }),
	};
});

describe("AutocompleteInput", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("rendering", () => {
		it("should render with default prompt", () => {
			const onSubmit = vi.fn();
			const { lastFrame } = render(<AutocompleteInput onSubmit={onSubmit} />);
			expect(lastFrame()).toContain(">");
		});

		it("should render with custom prompt", () => {
			const onSubmit = vi.fn();
			const { lastFrame } = render(
				<AutocompleteInput prompt="$ " onSubmit={onSubmit} />,
			);
			expect(lastFrame()).toContain("$");
		});

		it("should render when inactive", () => {
			const onSubmit = vi.fn();
			const { lastFrame } = render(
				<AutocompleteInput onSubmit={onSubmit} isActive={false} />,
			);
			expect(lastFrame()).toBeDefined();
		});
	});

	describe("props", () => {
		it("should accept slashCommands prop", () => {
			const onSubmit = vi.fn();
			const slashCommands = [
				{
					name: "test",
					description: "Test command",
					action: { type: "callback" as const, callback: vi.fn() },
				},
			];
			expect(() =>
				render(
					<AutocompleteInput
						onSubmit={onSubmit}
						slashCommands={slashCommands}
					/>,
				),
			).not.toThrow();
		});

		it("should accept onClear callback", () => {
			const onSubmit = vi.fn();
			const onClear = vi.fn();
			expect(() =>
				render(<AutocompleteInput onSubmit={onSubmit} onClear={onClear} />),
			).not.toThrow();
		});

		it("should accept onExit callback", () => {
			const onSubmit = vi.fn();
			const onExit = vi.fn();
			expect(() =>
				render(<AutocompleteInput onSubmit={onSubmit} onExit={onExit} />),
			).not.toThrow();
		});

		it("should accept injectText prop", () => {
			const onSubmit = vi.fn();
			const onInjectTextHandled = vi.fn();
			// injectText is handled via useEffect, just test it doesn't throw
			expect(() =>
				render(
					<AutocompleteInput
						onSubmit={onSubmit}
						injectText="test input"
						onInjectTextHandled={onInjectTextHandled}
					/>,
				),
			).not.toThrow();
		});
	});

	describe("export types", () => {
		it("should export required types", async () => {
			const module =
				await import("../../../source/components/AutocompleteInput/index.js");
			expect(module.isMessageInput).toBeDefined();
			expect(module.isCommandInput).toBeDefined();
		});
	});
});
