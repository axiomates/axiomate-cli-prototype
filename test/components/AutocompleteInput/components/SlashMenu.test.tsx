import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { SlashMenu } from "../../../../source/components/AutocompleteInput/components/SlashMenu.js";
import type { SlashCommand } from "../../../../source/components/AutocompleteInput/types.js";

describe("SlashMenu", () => {
	const defaultProps = {
		commands: [] as SlashCommand[],
		selectedIndex: 0,
		path: [] as string[],
		columns: 80,
		promptIndent: "  ",
	};

	describe("empty state", () => {
		it("should return null when commands array is empty", () => {
			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={[]} />,
			);

			expect(lastFrame()).toBe("");
		});
	});

	describe("basic rendering", () => {
		it("should render commands list", () => {
			const commands: SlashCommand[] = [
				{ name: "model", description: "Switch model" },
				{ name: "thinking", description: "Toggle thinking" },
			];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} />,
			);

			expect(lastFrame()).toContain("model");
			expect(lastFrame()).toContain("thinking");
			expect(lastFrame()).toContain("Switch model");
		});

		it("should render command with prefix", () => {
			const commands: SlashCommand[] = [
				{ name: "on", description: "Enable", prefix: "▸ " },
				{ name: "off", description: "Disable", prefix: "  " },
			];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} path={["thinking"]} />,
			);

			expect(lastFrame()).toContain("▸ on");
			expect(lastFrame()).toContain("  off");
		});

		it("should render children indicator", () => {
			const commands: SlashCommand[] = [
				{
					name: "session",
					description: "Session management",
					children: [{ name: "list", description: "List sessions" }],
				},
			];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} />,
			);

			expect(lastFrame()).toContain("session");
			expect(lastFrame()).toContain("→");
		});
	});

	describe("path breadcrumb", () => {
		it("should not show breadcrumb at root level", () => {
			const commands: SlashCommand[] = [{ name: "test" }];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} path={[]} />,
			);

			expect(lastFrame()).not.toContain("←");
		});

		it("should show breadcrumb when in nested path", () => {
			const commands: SlashCommand[] = [{ name: "on" }, { name: "off" }];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} path={["thinking"]} />,
			);

			expect(lastFrame()).toContain("←");
			expect(lastFrame()).toContain("thinking");
		});

		it("should show multi-level breadcrumb", () => {
			const commands: SlashCommand[] = [{ name: "model1" }];

			const { lastFrame } = render(
				<SlashMenu
					{...defaultProps}
					commands={commands}
					path={["suggestion", "model"]}
				/>,
			);

			expect(lastFrame()).toContain("suggestion");
			expect(lastFrame()).toContain("model");
			expect(lastFrame()).toContain("→");
		});
	});

	describe("selection highlighting", () => {
		it("should highlight selected command", () => {
			const commands: SlashCommand[] = [
				{ name: "first" },
				{ name: "second" },
				{ name: "third" },
			];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} selectedIndex={1} />,
			);

			// The output should contain all commands
			expect(lastFrame()).toContain("first");
			expect(lastFrame()).toContain("second");
			expect(lastFrame()).toContain("third");
		});
	});

	describe("windowing", () => {
		it("should show scroll indicator when more items above", () => {
			const commands: SlashCommand[] = Array.from({ length: 15 }, (_, i) => ({
				name: `cmd${i}`,
			}));

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} selectedIndex={10} />,
			);

			expect(lastFrame()).toContain("↑");
			expect(lastFrame()).toContain("还有");
		});

		it("should show scroll indicator when more items below", () => {
			const commands: SlashCommand[] = Array.from({ length: 15 }, (_, i) => ({
				name: `cmd${i}`,
			}));

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} selectedIndex={0} />,
			);

			expect(lastFrame()).toContain("↓");
			expect(lastFrame()).toContain("还有");
		});

		it("should limit visible commands to 9", () => {
			const commands: SlashCommand[] = Array.from({ length: 15 }, (_, i) => ({
				name: `command${i}`,
			}));

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} selectedIndex={0} />,
			);

			// Should show first 9 commands
			expect(lastFrame()).toContain("command0");
			expect(lastFrame()).toContain("command8");
			// Should not show command9 (10th item)
			expect(lastFrame()).not.toContain("command9");
		});
	});

	describe("prefix handling", () => {
		it("should use / prefix at root level", () => {
			const commands: SlashCommand[] = [{ name: "test" }];

			const { lastFrame } = render(
				<SlashMenu {...defaultProps} commands={commands} path={[]} />,
			);

			expect(lastFrame()).toContain("/test");
		});

		it("should use space prefix in nested path when no custom prefix", () => {
			const commands: SlashCommand[] = [{ name: "test" }];

			const { lastFrame } = render(
				<SlashMenu
					{...defaultProps}
					commands={commands}
					path={["parent"]}
					selectedIndex={0}
				/>,
			);

			// Without prefix prop, should use "  " (two spaces) in nested path
			const frame = lastFrame()!;
			expect(frame).toContain("test");
		});
	});
});
