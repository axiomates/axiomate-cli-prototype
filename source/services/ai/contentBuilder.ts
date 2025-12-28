/**
 * 内容构建器
 * 组装用户消息和文件内容，处理 @ 符号转换
 */

import type { FileReference } from "../../models/input.js";
import { readFileContents, formatFilesAsXml } from "./fileReader.js";
import {
	estimateTokens,
	truncateFilesProportionally,
} from "./tokenEstimator.js";
import { t } from "../../i18n/index.js";

/**
 * 内容构建结果
 */
export type ContentBuildResult = {
	/** 最终发送给 AI 的内容 */
	content: string;
	/** 是否有文件被截断 */
	wasTruncated: boolean;
	/** 截断提示信息（如果有截断） */
	truncationNotice: string;
	/** 文件摘要（如 "包含 3 个文件: app.tsx, index.ts, ..."） */
	fileSummary: string;
	/** 估算的 token 数 */
	estimatedTokens: number;
	/** 是否超出可用空间 */
	exceedsAvailable: boolean;
};

/**
 * 构建消息内容选项
 */
export type BuildContentOptions = {
	/** 用户原始消息 */
	userMessage: string;
	/** 文件引用列表 */
	files: FileReference[];
	/** 当前工作目录 */
	cwd: string;
	/** 可用的 token 数（来自 Session.getAvailableTokens()，已预留响应空间） */
	availableTokens: number;
};

/**
 * 构建消息内容
 *
 * 流程：
 * 1. 读取文件内容
 * 2. 估算 token，如果超过限制则截断
 * 3. 格式化为 XML
 * 4. 转换用户消息中的 @ 符号
 * 5. 组装最终内容
 *
 * @param options 构建选项
 * @returns 构建结果
 */
export async function buildMessageContent(
	options: BuildContentOptions,
): Promise<ContentBuildResult> {
	const { userMessage, files: fileRefs, cwd: workingDir, availableTokens } =
		options;

	// 如果没有文件，直接返回用户消息
	if (fileRefs.length === 0) {
		const estimatedTokens = estimateTokens(userMessage);
		return {
			content: userMessage,
			wasTruncated: false,
			truncationNotice: "",
			fileSummary: "",
			estimatedTokens,
			exceedsAvailable: estimatedTokens > availableTokens,
		};
	}

	// 1. 读取文件内容
	const readResult = await readFileContents(fileRefs, workingDir);

	// 2. 转换用户消息（移除 @ 符号，改为文字描述）
	const transformedMessage = transformUserMessage(userMessage, fileRefs);

	// 3. 估算用户消息的 token
	const messageTokens = estimateTokens(transformedMessage);

	// 文件可用的 token = 可用空间 - 消息 token - 缓冲
	// 注意：availableTokens 已经预留了响应空间（25%），不需要再减去 reserveForResponse
	const availableForFiles = availableTokens - messageTokens - 500;

	// 4. 检查是否需要截断
	let wasTruncated = false;
	let truncationNotice = "";
	let processedFiles: Array<{
		path: string;
		content: string;
		isDirectory: boolean;
		error?: string;
	}>;

	const fileContentsForCheck = readResult.files
		.filter((f) => !f.error)
		.map((f) => ({ path: f.path, content: f.content }));

	const totalFileTokens = fileContentsForCheck.reduce(
		(sum, f) => sum + estimateTokens(f.content),
		0,
	);

	if (availableForFiles <= 0) {
		// 没有空间放置文件内容
		wasTruncated = true;
		truncationNotice = t("ai.filesOmitted", { count: fileRefs.length });
		processedFiles = readResult.files.map((f) => ({
			...f,
			content: t("ai.contentOmitted"),
		}));
	} else if (totalFileTokens > availableForFiles) {
		// 需要截断
		const truncatedFiles = truncateFilesProportionally(
			fileContentsForCheck,
			availableForFiles,
		);

		wasTruncated = truncatedFiles.some((f) => f.wasTruncated);

		if (wasTruncated) {
			const truncatedCount = truncatedFiles.filter(
				(f) => f.wasTruncated,
			).length;
			truncationNotice = t("ai.filesTruncated", { count: truncatedCount });
		}

		// 合并截断后的文件和有错误的文件
		processedFiles = readResult.files.map((f) => {
			if (f.error) {
				return f;
			}
			const truncated = truncatedFiles.find((tf) => tf.path === f.path);
			return {
				...f,
				content: truncated?.content ?? f.content,
			};
		});
	} else {
		processedFiles = readResult.files;
	}

	// 5. 格式化文件为 XML
	const xmlContent = formatFilesAsXml(
		processedFiles.map((f) => ({
			path: f.path,
			content: f.content,
			size: f.content.length,
			isDirectory: f.isDirectory,
			error: f.error,
		})),
	);

	// 6. 生成文件摘要
	const fileNames = fileRefs.map((f) => f.path.split(/[/\\]/).pop()).join(", ");
	const fileSummary = t("ai.fileSummary", {
		count: fileRefs.length,
		files: fileNames,
	});

	// 7. 组装最终内容
	const finalContent = `${xmlContent}\n\n${transformedMessage}`;

	// 估算最终内容的 token 数
	const estimatedTokens = estimateTokens(finalContent);

	return {
		content: finalContent,
		wasTruncated,
		truncationNotice,
		fileSummary,
		estimatedTokens,
		exceedsAvailable: estimatedTokens > availableTokens,
	};
}

/**
 * 转换用户消息
 * 将 "@path/to/file" 转换为 "文件 path/to/file"
 *
 * @param message 原始消息
 * @param files 文件引用列表
 * @returns 转换后的消息
 */
export function transformUserMessage(
	message: string,
	files: FileReference[],
): string {
	let result = message;

	// 按位置从后往前替换，避免位置偏移
	const sortedFiles = [...files].sort((a, b) => {
		// 找到 @ 位置
		const posA = message.indexOf(`@${a.path}`);
		const posB = message.indexOf(`@${b.path}`);
		return posB - posA; // 从后往前
	});

	for (const file of sortedFiles) {
		const pattern = `@${file.path}`;
		const replacement = file.isDirectory
			? t("ai.directory", { path: file.path })
			: t("ai.file", { path: file.path });
		result = result.replace(pattern, replacement);
	}

	return result;
}
