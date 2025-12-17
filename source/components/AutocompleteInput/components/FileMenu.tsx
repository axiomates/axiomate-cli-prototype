/**
 * 文件选择菜单组件
 */

import { Box, Text } from "ink";
import type { FileItem } from "../hooks/useFileSelect.js";

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

/** 文件路径颜色 */
const FILE_COLOR = "#87ceeb"; // 浅蓝色
/** 文件夹颜色 */
const DIR_COLOR = "#ffd700"; // 金色

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
					<Text color={DIR_COLOR}>{path.join("\\")}</Text>
				</Box>
			)}
			{/* 文件列表（最多显示 10 个） */}
			{files.slice(0, 10).map((file, index) => (
				<Box key={file.path}>
					<Text
						backgroundColor={index === selectedIndex ? "blue" : undefined}
						color={index === selectedIndex ? "white" : undefined}
					>
						{promptIndent}
						{file.isDirectory ? "📁 " : "📄 "}
						<Text
							color={
								index === selectedIndex
									? "white"
									: file.isDirectory
										? DIR_COLOR
										: FILE_COLOR
							}
						>
							{file.name}
						</Text>
					</Text>
					{file.isDirectory && <Text color="gray"> →</Text>}
				</Box>
			))}
			{/* 如果还有更多文件 */}
			{files.length > 10 && (
				<Text color="gray">
					{promptIndent}... and {files.length - 10} more
				</Text>
			)}
		</Box>
	);
}
