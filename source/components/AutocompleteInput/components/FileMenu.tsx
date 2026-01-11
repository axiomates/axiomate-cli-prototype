/**
 * 文件选择菜单组件
 */

import { Box, Text } from "ink";
import type { FileItem } from "../hooks/useFileSelect.js";
import { FILE_COLOR, DIR_COLOR } from "../../../constants/colors.js";
import { PATH_SEPARATOR } from "../../../constants/platform.js";

type FileMenuProps = {
	/** 文件列表 */
	files: FileItem[];
	/** 当前选中的索引 */
	selectedIndex: number;
	/** 当前路径数组（面包屑导航） */
	path: string[];
	/** 终端宽度 */
	columns: number;
	/** prompt 缩进 */
	promptIndent: string;
	/** 是否正在加载 */
	loading?: boolean;
};

export function FileMenu({
	files,
	selectedIndex,
	path,
	columns,
	promptIndent,
	loading = false,
}: FileMenuProps) {
	if (loading) {
		return (
			<Box flexDirection="column">
				<Text color="gray">{"─".repeat(columns)}</Text>
				<Text color="gray">{promptIndent}Loading...</Text>
			</Box>
		);
	}

	if (files.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="gray">{"─".repeat(columns)}</Text>
				<Text color="gray">{promptIndent}No files found</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="gray">{"─".repeat(columns)}</Text>
			{/* 显示当前路径（面包屑导航） */}
			{path.length > 0 && (
				<Box>
					<Text color="gray">{promptIndent}← </Text>
					<Text color={DIR_COLOR}>{path.join(PATH_SEPARATOR)}</Text>
				</Box>
			)}
			{/* 文件列表（最多显示 9 个，窗口跟随选中项） */}
			{(() => {
				const maxVisible = 9;
				// 计算窗口：确保选中项始终可见
				let startIndex = 0;
				if (selectedIndex >= maxVisible) {
					// 选中项超出初始窗口，滚动窗口使选中项在底部
					startIndex = selectedIndex - maxVisible + 1;
				}
				const endIndex = Math.min(files.length, startIndex + maxVisible);
				const visibleFiles = files.slice(startIndex, endIndex);
				const hasMoreBefore = startIndex > 0;
				const hasMoreAfter = endIndex < files.length;

				return (
					<>
						{hasMoreBefore && (
							<Text color="gray">
								{promptIndent}... {startIndex} more above
							</Text>
						)}
						{visibleFiles.map((file, visibleIndex) => {
							const actualIndex = startIndex + visibleIndex;
							const isDotEntry = file.name === ".";
							const isSelected = actualIndex === selectedIndex;
							return (
								<Box key={file.path}>
									<Text
										backgroundColor={isSelected ? "blue" : undefined}
										color={isSelected ? "white" : undefined}
									>
										{promptIndent}
										{isSelected ? "▸ " : "  "}
										{file.isDirectory ? "📁 " : "📄 "}
										<Text
											color={
												isSelected
													? "white"
													: file.isDirectory
														? DIR_COLOR
														: FILE_COLOR
											}
										>
											{file.name}
										</Text>
										{isDotEntry && (
											<Text color={isSelected ? "white" : "gray"}>
												{" "}
												(Select this folder)
											</Text>
										)}
									</Text>
									{file.isDirectory && !isDotEntry && (
										<Text color="gray"> →</Text>
									)}
								</Box>
							);
						})}
						{hasMoreAfter && (
							<Text color="gray">
								{promptIndent}... and {files.length - endIndex} more
							</Text>
						)}
					</>
				);
			})()}
		</Box>
	);
}
