/**
 * 文件选择 Hook
 * 异步读取文件系统，提供文件/文件夹列表
 */

import { useState, useEffect, useCallback } from "react";
import { readdirSync, statSync } from "fs";
import { join, normalize } from "path";

/**
 * 文件项类型
 */
export type FileItem = {
	name: string;
	isDirectory: boolean;
	path: string;
};

/**
 * useFileSelect Hook 返回值
 */
type UseFileSelectResult = {
	/** 当前目录下的文件列表 */
	files: FileItem[];
	/** 是否正在加载 */
	loading: boolean;
	/** 错误信息 */
	error: string | null;
	/** 刷新文件列表 */
	refresh: () => void;
};

/**
 * 读取目录内容
 */
function readDirectory(basePath: string): FileItem[] {
	try {
		const normalizedPath = normalize(basePath || ".");
		const entries = readdirSync(normalizedPath);

		const items: FileItem[] = entries
			.filter((name) => !name.startsWith(".")) // 过滤隐藏文件
			.map((name) => {
				const fullPath = join(normalizedPath, name);
				let isDirectory = false;
				try {
					isDirectory = statSync(fullPath).isDirectory();
				} catch {
					// 无法访问的文件，当作普通文件处理
				}
				return {
					name,
					isDirectory,
					path: fullPath,
				};
			})
			.sort((a, b) => {
				// 文件夹优先，然后按名称排序
				if (a.isDirectory && !b.isDirectory) return -1;
				if (!a.isDirectory && b.isDirectory) return 1;
				return a.name.localeCompare(b.name);
			});

		return items;
	} catch {
		return [];
	}
}

/**
 * 文件选择 Hook
 * @param basePath 基础路径（相对于 cwd）
 * @param filter 过滤字符串（用户在 @ 后输入的内容）
 */
export function useFileSelect(
	basePath: string,
	filter: string = "",
): UseFileSelectResult {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadFiles = useCallback(() => {
		setLoading(true);
		setError(null);

		try {
			const items = readDirectory(basePath);
			// 应用过滤
			const filtered = filter
				? items.filter((item) =>
						item.name.toLowerCase().includes(filter.toLowerCase()),
					)
				: items;
			setFiles(filtered);
		} catch (err) {
			setError(err instanceof Error ? err.message : "读取目录失败");
			setFiles([]);
		} finally {
			setLoading(false);
		}
	}, [basePath, filter]);

	useEffect(() => {
		loadFiles();
	}, [loadFiles]);

	return {
		files,
		loading,
		error,
		refresh: loadFiles,
	};
}
