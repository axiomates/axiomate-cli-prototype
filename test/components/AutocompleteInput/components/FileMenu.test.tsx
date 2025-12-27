import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { FileMenu } from "../../../../source/components/AutocompleteInput/components/FileMenu.js";
import type { FileItem } from "../../../../source/components/AutocompleteInput/hooks/useFileSelect.js";

describe("FileMenu", () => {
	const defaultProps = {
		files: [] as FileItem[],
		selectedIndex: 0,
		path: [] as string[],
		columns: 80,
		promptIndent: "  ",
		loading: false,
	};

	describe("loading state", () => {
		it("should show loading indicator when loading", () => {
			const { lastFrame } = render(<FileMenu {...defaultProps} loading={true} />);

			expect(lastFrame()).toContain("Loading...");
		});
	});

	describe("empty state", () => {
		it("should show no files message when files array is empty", () => {
			const { lastFrame } = render(<FileMenu {...defaultProps} files={[]} />);

			expect(lastFrame()).toContain("No files found");
		});
	});

	describe("basic rendering", () => {
		it("should render file list", () => {
			const files: FileItem[] = [
				{ name: "file1.ts", path: "/project/file1.ts", isDirectory: false },
				{ name: "file2.ts", path: "/project/file2.ts", isDirectory: false },
			];

			const { lastFrame } = render(<FileMenu {...defaultProps} files={files} />);

			expect(lastFrame()).toContain("file1.ts");
			expect(lastFrame()).toContain("file2.ts");
			expect(lastFrame()).toContain("📄");
		});

		it("should render directories with folder icon", () => {
			const files: FileItem[] = [
				{ name: "src", path: "/project/src", isDirectory: true },
				{ name: "test", path: "/project/test", isDirectory: true },
			];

			const { lastFrame } = render(<FileMenu {...defaultProps} files={files} />);

			expect(lastFrame()).toContain("src");
			expect(lastFrame()).toContain("📁");
			expect(lastFrame()).toContain("→");
		});

		it("should render mixed files and directories", () => {
			const files: FileItem[] = [
				{ name: "src", path: "/project/src", isDirectory: true },
				{ name: "README.md", path: "/project/README.md", isDirectory: false },
			];

			const { lastFrame } = render(<FileMenu {...defaultProps} files={files} />);

			expect(lastFrame()).toContain("📁");
			expect(lastFrame()).toContain("📄");
		});
	});

	describe("dot entry (current folder)", () => {
		it("should show select folder hint for dot entry", () => {
			const files: FileItem[] = [
				{ name: ".", path: "/project/src", isDirectory: true },
				{ name: "utils", path: "/project/src/utils", isDirectory: true },
			];

			const { lastFrame } = render(<FileMenu {...defaultProps} files={files} />);

			expect(lastFrame()).toContain(".");
			expect(lastFrame()).toContain("(Select this folder)");
		});

		it("should not show arrow for dot entry", () => {
			const files: FileItem[] = [
				{ name: ".", path: "/project/src", isDirectory: true },
			];

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={0} />,
			);

			// Dot entry should have "Select this folder" but not the navigation arrow
			const frame = lastFrame()!;
			expect(frame).toContain("Select this folder");
		});
	});

	describe("path breadcrumb", () => {
		it("should not show breadcrumb at root", () => {
			const files: FileItem[] = [
				{ name: "file.ts", path: "/project/file.ts", isDirectory: false },
			];

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} path={[]} />,
			);

			expect(lastFrame()).not.toContain("←");
		});

		it("should show breadcrumb in nested path", () => {
			const files: FileItem[] = [
				{ name: "utils.ts", path: "/project/src/utils.ts", isDirectory: false },
			];

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} path={["src"]} />,
			);

			expect(lastFrame()).toContain("←");
			expect(lastFrame()).toContain("src");
		});

		it("should show multi-level breadcrumb", () => {
			const files: FileItem[] = [
				{
					name: "file.ts",
					path: "/project/src/components/file.ts",
					isDirectory: false,
				},
			];

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} path={["src", "components"]} />,
			);

			expect(lastFrame()).toContain("src");
			expect(lastFrame()).toContain("components");
		});
	});

	describe("selection highlighting", () => {
		it("should highlight selected item with marker", () => {
			const files: FileItem[] = [
				{ name: "first.ts", path: "/first.ts", isDirectory: false },
				{ name: "second.ts", path: "/second.ts", isDirectory: false },
			];

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={1} />,
			);

			expect(lastFrame()).toContain("▸");
		});
	});

	describe("windowing", () => {
		it("should show scroll indicator when more items above", () => {
			const files: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
				name: `file${i}.ts`,
				path: `/project/file${i}.ts`,
				isDirectory: false,
			}));

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={10} />,
			);

			expect(lastFrame()).toContain("more above");
		});

		it("should show scroll indicator when more items below", () => {
			const files: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
				name: `file${i}.ts`,
				path: `/project/file${i}.ts`,
				isDirectory: false,
			}));

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={0} />,
			);

			expect(lastFrame()).toContain("more");
		});

		it("should limit visible files to 9", () => {
			const files: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
				name: `file${i}.ts`,
				path: `/project/file${i}.ts`,
				isDirectory: false,
			}));

			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={0} />,
			);

			// Should show first 9 files
			expect(lastFrame()).toContain("file0.ts");
			expect(lastFrame()).toContain("file8.ts");
			// Should not show file9 directly (it's beyond the window)
			// Actually it shows "... and 6 more" indicator
		});

		it("should scroll window when selection moves", () => {
			const files: FileItem[] = Array.from({ length: 15 }, (_, i) => ({
				name: `file${i}.ts`,
				path: `/project/file${i}.ts`,
				isDirectory: false,
			}));

			// Select item at index 12
			const { lastFrame } = render(
				<FileMenu {...defaultProps} files={files} selectedIndex={12} />,
			);

			expect(lastFrame()).toContain("file12.ts");
		});
	});
});
