/**
 * AutocompleteInput 状态机 Reducer
 * 基于 InputInstance 的数据驱动状态管理
 */

import {
	type EditorState,
	type EditorAction,
	type UIMode,
	type InputInstance,
	isNormalMode,
	isHistoryMode,
	isSlashMode,
	isFileMode,
	isHelpMode,
	createEmptyInstance,
	updateInstanceFromText,
	updateInstanceCursor,
	enterCommandLevel,
	exitCommandLevel,
	createCommandInstance,
	buildFileText,
	buildFileSegments,
	toHistoryEntry,
	fromHistoryEntry,
	updateSelectedFilesPositions,
	rebuildSegmentsWithFiles,
	removeSelectedFile,
} from "./types.js";
import { PATH_SEPARATOR } from "../../constants/platform.js";

/**
 * 初始状态
 */
export const initialState: EditorState = {
	instance: createEmptyInstance(),
	uiMode: { type: "normal" },
	suggestion: null,
};

/**
 * 编辑器状态 Reducer
 */
export function editorReducer(
	state: EditorState,
	action: EditorAction,
): EditorState {
	switch (action.type) {
		// ====================================================================
		// 输入操作
		// ====================================================================

		case "SET_TEXT": {
			const { text, cursor } = action;
			const isSlash = text.startsWith("/");
			const wasSlash = state.instance.text.startsWith("/");
			const currentPath = state.instance.commandPath;
			const currentFilePath = state.instance.filePath;

			// 在历史模式下输入，退出历史模式
			if (isHistoryMode(state.uiMode)) {
				const newMode: UIMode = isSlash
					? { type: "slash", selectedIndex: 0 }
					: { type: "normal" };
				// 保留 selectedFiles，更新位置并重建 segments
				const oldSelectedFiles = state.instance.selectedFiles;
				if (oldSelectedFiles.length > 0) {
					const updatedSelectedFiles = updateSelectedFilesPositions(
						text,
						oldSelectedFiles,
					);
					const newSegments = rebuildSegmentsWithFiles(
						text,
						updatedSelectedFiles,
					);
					const newInstance: InputInstance = {
						text,
						cursor,
						type: "message",
						segments: newSegments,
						commandPath: [],
						filePath: [],
						selectedFiles: updatedSelectedFiles,
					};
					return {
						...state,
						instance: newInstance,
						uiMode: newMode,
					};
				}
				// 没有已选择的文件，使用原有逻辑
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				return {
					...state,
					instance: newInstance,
					uiMode: newMode,
				};
			}

			// 从普通模式输入 /，进入 slash 模式
			if (isSlash && !wasSlash && isNormalMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				return {
					...state,
					instance: newInstance,
					suggestion: null,
					uiMode: { type: "slash", selectedIndex: 0 },
				};
			}

			// 从 slash 删除 /，回到普通模式
			if (!isSlash && wasSlash && isSlashMode(state.uiMode)) {
				const newInstance = updateInstanceFromText(text, cursor, [], []);
				return {
					...state,
					instance: newInstance,
					uiMode: { type: "normal" },
				};
			}

			// 文件模式下更新，保持文件路径并构建彩色分段
			if (isFileMode(state.uiMode)) {
				const { prefix } = state.uiMode;
				const filePathText = buildFileText(currentFilePath, true);
				const fullPrefix = prefix + filePathText;
				// 提取过滤文本（路径之后的输入）
				const filterText =
					text.length > fullPrefix.length ? text.slice(fullPrefix.length) : "";
				// 过滤掉位于 suffix 中的 selectedFiles
				const relevantSelectedFiles = state.instance.selectedFiles.filter(
					(f) => f.endPosition <= prefix.length,
				);
				// 重建 prefix 的 segments（保留已选择文件的颜色）
				const prefixSegments = rebuildSegmentsWithFiles(
					prefix,
					relevantSelectedFiles,
				);
				// 构建当前文件路径的彩色分段
				const fileSegments = buildFileSegments(
					currentFilePath,
					true,
					filterText,
				);
				const newSegments = [...prefixSegments, ...fileSegments];
				const newInstance: InputInstance = {
					text,
					cursor,
					type: "message",
					segments: newSegments,
					commandPath: [],
					filePath: currentFilePath,
					selectedFiles: state.instance.selectedFiles,
				};
				// 当过滤文本变化时，重置选中索引为 0
				return {
					...state,
					instance: newInstance,
					uiMode: {
						...state.uiMode,
						selectedIndex: 0,
					},
				};
			}

			// 普通文本更新
			// 如果有已选择的文件，更新它们的位置并重建带颜色的 segments
			const oldSelectedFiles = state.instance.selectedFiles;
			if (oldSelectedFiles.length > 0) {
				const updatedSelectedFiles = updateSelectedFilesPositions(
					text,
					oldSelectedFiles,
				);
				const newSegments = rebuildSegmentsWithFiles(
					text,
					updatedSelectedFiles,
				);
				const newInstance: InputInstance = {
					text,
					cursor,
					type: "message",
					segments: newSegments,
					commandPath: [],
					filePath: [],
					selectedFiles: updatedSelectedFiles,
				};
				return {
					...state,
					instance: newInstance,
				};
			}
			// 没有已选择的文件，使用原有逻辑
			const newInstance = updateInstanceFromText(text, cursor, currentPath, []);
			return {
				...state,
				instance: newInstance,
			};
		}

		case "SET_CURSOR": {
			const newInstance = updateInstanceCursor(state.instance, action.cursor);
			return { ...state, instance: newInstance };
		}

		case "SET_SUGGESTION":
			return { ...state, suggestion: action.suggestion };

		// ====================================================================
		// 历史操作
		// ====================================================================

		case "ENTER_HISTORY":
			return {
				...state,
				instance: fromHistoryEntry(action.entry),
				suggestion: null,
				uiMode: {
					type: "history",
					index: action.index,
					savedEntry: toHistoryEntry(state.instance),
				},
			};

		case "NAVIGATE_HISTORY":
			if (!isHistoryMode(state.uiMode)) return state;
			return {
				...state,
				instance: fromHistoryEntry(action.entry),
				uiMode: { ...state.uiMode, index: action.index },
			};

		case "EXIT_HISTORY":
			if (!isHistoryMode(state.uiMode)) return state;
			return {
				...state,
				instance: fromHistoryEntry(state.uiMode.savedEntry),
				uiMode: { type: "normal" },
			};

		// ====================================================================
		// 斜杠命令操作
		// ====================================================================

		case "ENTER_SLASH": {
			// 手动进入 slash 模式（通常由 SET_TEXT 自动处理）
			const newInstance = createCommandInstance([], true);
			return {
				...state,
				instance: newInstance,
				suggestion: null,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		case "SELECT_SLASH":
			if (!isSlashMode(state.uiMode)) return state;
			return {
				...state,
				uiMode: { ...state.uiMode, selectedIndex: action.index },
			};

		case "ENTER_SLASH_LEVEL": {
			if (!isSlashMode(state.uiMode)) return state;
			const newInstance = enterCommandLevel(state.instance, action.name);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		case "SELECT_FINAL_COMMAND": {
			// 选择最终命令（无子命令），更新 instance 为完整路径（不带尾部箭头）
			if (!isSlashMode(state.uiMode)) return state;
			const finalPath = [...state.instance.commandPath, action.name];
			const finalInstance = createCommandInstance(finalPath, false);
			return {
				...state,
				instance: finalInstance,
				// 保持 slash 模式，提交后会 RESET
			};
		}

		case "EXIT_SLASH_LEVEL": {
			if (!isSlashMode(state.uiMode)) return state;

			if (state.instance.commandPath.length === 0) {
				// 已经在根级，退出 slash 模式
				return {
					...state,
					instance: createEmptyInstance(),
					uiMode: { type: "normal" },
				};
			}

			// 返回上一级
			const newInstance = exitCommandLevel(state.instance);
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "slash", selectedIndex: 0 },
			};
		}

		// ====================================================================
		// 其他操作
		// ====================================================================

		case "TOGGLE_HELP":
			if (isHelpMode(state.uiMode)) {
				return { ...state, uiMode: { type: "normal" } };
			}
			return { ...state, uiMode: { type: "help" } };

		// ====================================================================
		// 文件选择操作
		// ====================================================================

		case "ENTER_FILE": {
			// 创建文件选择模式实例，保留 @ 之前的前缀和之后的后缀
			const { prefix } = action;
			const filePathText = buildFileText([], true); // "@"
			const newText = prefix + filePathText;
			// 过滤掉位于 suffix 中的 selectedFiles（它们现在不在 newText 中）
			const relevantSelectedFiles = state.instance.selectedFiles.filter(
				(f) => f.endPosition <= prefix.length,
			);
			// 重建 prefix 的 segments（保留已选择文件的颜色）
			const prefixSegments = rebuildSegmentsWithFiles(
				prefix,
				relevantSelectedFiles,
			);
			const fileSegments = buildFileSegments([], true);
			const newSegments = [...prefixSegments, ...fileSegments];
			const newInstance: InputInstance = {
				text: newText,
				cursor: newText.length,
				type: "message",
				segments: newSegments,
				commandPath: [],
				filePath: [],
				selectedFiles: state.instance.selectedFiles,
			};
			return {
				...state,
				instance: newInstance,
				suggestion: null,
				uiMode: {
					type: "file",
					selectedIndex: 0,
					atPosition: action.atPosition,
					prefix: action.prefix,
					suffix: action.suffix,
				},
			};
		}

		case "SELECT_FILE":
			if (!isFileMode(state.uiMode)) return state;
			return {
				...state,
				uiMode: { ...state.uiMode, selectedIndex: action.index },
			};

		case "ENTER_FILE_DIR": {
			if (!isFileMode(state.uiMode)) return state;
			// 进入子目录，保留前缀
			const { prefix } = state.uiMode;
			const newPath = [...state.instance.filePath, action.dirName];
			const filePathText = buildFileText(newPath, true);
			const newText = prefix + filePathText;
			// 过滤掉位于 suffix 中的 selectedFiles
			const relevantSelectedFiles = state.instance.selectedFiles.filter(
				(f) => f.endPosition <= prefix.length,
			);
			// 重建 prefix 的 segments（保留已选择文件的颜色）
			const prefixSegments = rebuildSegmentsWithFiles(
				prefix,
				relevantSelectedFiles,
			);
			const fileSegments = buildFileSegments(newPath, true);
			const newSegments = [...prefixSegments, ...fileSegments];
			const newInstance: InputInstance = {
				text: newText,
				cursor: newText.length,
				type: "message",
				segments: newSegments,
				commandPath: [],
				filePath: newPath,
				selectedFiles: state.instance.selectedFiles,
			};
			return {
				...state,
				instance: newInstance,
				uiMode: {
					...state.uiMode,
					selectedIndex: 0,
				},
			};
		}

		case "CONFIRM_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			// 构建完整文件路径，保留前缀和后缀
			const { prefix, suffix, atPosition } = state.uiMode;
			const finalPath = [...state.instance.filePath, action.fileName];
			const fileText = buildFileText(finalPath, false);
			const newText = prefix + fileText + suffix;
			const newCursor = prefix.length + fileText.length; // 光标在文件路径后，后缀前

			// 新添加的文件
			const newSelectedFile = {
				path: finalPath.join(PATH_SEPARATOR),
				isDirectory: false,
				atPosition,
				endPosition: prefix.length + fileText.length,
			};

			// 更新所有 selectedFiles 的位置：
			// - prefix 中的文件位置不变
			// - suffix 中的文件位置需要向后移动 (fileText.length)
			const updatedSelectedFiles = state.instance.selectedFiles.map((f) => {
				if (f.atPosition >= prefix.length) {
					// 在 suffix 中的文件，位置向后移动
					return {
						...f,
						atPosition: f.atPosition + fileText.length,
						endPosition: f.endPosition + fileText.length,
					};
				}
				return f;
			});

			// 添加新文件到列表
			const allSelectedFiles = [...updatedSelectedFiles, newSelectedFile];

			// 使用 rebuildSegmentsWithFiles 构建所有 segments
			const allSegments = rebuildSegmentsWithFiles(newText, allSelectedFiles);

			const newInstance: InputInstance = {
				text: newText,
				cursor: newCursor,
				type: "message",
				segments: allSegments,
				commandPath: [],
				filePath: [], // 退出文件模式，清空 filePath
				selectedFiles: allSelectedFiles,
			};
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "CONFIRM_FOLDER": {
			// 选择当前文件夹（"." 条目）
			if (!isFileMode(state.uiMode)) return state;
			const { prefix, suffix, atPosition } = state.uiMode;
			const folderPath = state.instance.filePath;
			const fileText = buildFileText(folderPath, false);
			const newText = prefix + fileText + suffix;
			const newCursor = prefix.length + fileText.length; // 光标在文件路径后，后缀前

			// 新添加的文件夹
			const newSelectedFile = {
				path: folderPath.join(PATH_SEPARATOR),
				isDirectory: true,
				atPosition,
				endPosition: prefix.length + fileText.length,
			};

			// 更新所有 selectedFiles 的位置：
			// - prefix 中的文件位置不变
			// - suffix 中的文件位置需要向后移动 (fileText.length)
			const updatedSelectedFiles = state.instance.selectedFiles.map((f) => {
				if (f.atPosition >= prefix.length) {
					// 在 suffix 中的文件，位置向后移动
					return {
						...f,
						atPosition: f.atPosition + fileText.length,
						endPosition: f.endPosition + fileText.length,
					};
				}
				return f;
			});

			// 添加新文件到列表
			const allSelectedFiles = [...updatedSelectedFiles, newSelectedFile];

			// 使用 rebuildSegmentsWithFiles 构建所有 segments
			const allSegments = rebuildSegmentsWithFiles(newText, allSelectedFiles);

			const newInstance: InputInstance = {
				text: newText,
				cursor: newCursor,
				type: "message",
				segments: allSegments,
				commandPath: [],
				filePath: [], // 退出文件模式，清空 filePath
				selectedFiles: allSelectedFiles,
			};
			return {
				...state,
				instance: newInstance,
				uiMode: { type: "normal" },
			};
		}

		case "EXIT_FILE": {
			if (!isFileMode(state.uiMode)) return state;
			const { prefix, suffix } = state.uiMode;
			const filePath = state.instance.filePath;
			if (filePath.length > 0) {
				// 有父目录，返回上一级，保留前缀（suffix 保持在 uiMode 中）
				const newPath = filePath.slice(0, -1);
				const filePathText = buildFileText(newPath, true);
				const newText = prefix + filePathText;
				// 过滤掉位于 suffix 中的 selectedFiles
				const relevantSelectedFiles = state.instance.selectedFiles.filter(
					(f) => f.endPosition <= prefix.length,
				);
				// 重建 prefix 的 segments（保留已选择文件的颜色）
				const prefixSegments = rebuildSegmentsWithFiles(
					prefix,
					relevantSelectedFiles,
				);
				const fileSegments = buildFileSegments(newPath, true);
				const newSegments = [...prefixSegments, ...fileSegments];
				const newInstance: InputInstance = {
					text: newText,
					cursor: newText.length,
					type: "message",
					segments: newSegments,
					commandPath: [],
					filePath: newPath,
					selectedFiles: state.instance.selectedFiles,
				};
				return {
					...state,
					instance: newInstance,
					uiMode: {
						...state.uiMode,
						selectedIndex: 0,
					},
				};
			}
			// 在根级，退出文件模式，恢复前缀 + 后缀
			const restoredText = prefix + suffix;
			// 使用 rebuildSegmentsWithFiles 重建 segments
			const exitSegments = rebuildSegmentsWithFiles(
				restoredText,
				state.instance.selectedFiles,
			);
			const exitInstance: InputInstance = {
				text: restoredText,
				cursor: prefix.length,
				type: "message",
				segments: exitSegments,
				commandPath: [],
				filePath: [],
				selectedFiles: state.instance.selectedFiles,
			};
			return {
				...state,
				instance: exitInstance,
				uiMode: { type: "normal" },
			};
		}

		case "EXIT_FILE_KEEP_AT": {
			// 退出文件模式但保留当前文本（包括 @path/），并恢复 suffix
			if (!isFileMode(state.uiMode)) return state;
			const { suffix } = state.uiMode;
			// 将当前路径文本 + suffix 转换为普通消息
			const currentText = state.instance.text + suffix;
			// 使用 rebuildSegmentsWithFiles 重建 segments
			const exitSegments = rebuildSegmentsWithFiles(
				currentText,
				state.instance.selectedFiles,
			);
			const exitInstance: InputInstance = {
				text: currentText,
				cursor: state.instance.text.length, // 光标在原位置
				type: "message",
				segments: exitSegments,
				commandPath: [],
				filePath: [],
				selectedFiles: state.instance.selectedFiles,
			};
			return {
				...state,
				instance: exitInstance,
				uiMode: { type: "normal" },
			};
		}

		case "REMOVE_SELECTED_FILE": {
			// 删除已选择的文件（整体删除）
			const { file } = action;
			const result = removeSelectedFile(
				state.instance.text,
				file,
				state.instance.selectedFiles,
			);
			const newInstance: InputInstance = {
				text: result.text,
				cursor: result.cursor,
				type: "message",
				segments: result.segments,
				commandPath: [],
				filePath: [],
				selectedFiles: result.selectedFiles,
			};
			return {
				...state,
				instance: newInstance,
			};
		}

		case "RESET":
			return initialState;

		default:
			return state;
	}
}

// 为了向后兼容，导出别名
export const inputReducer = editorReducer;
