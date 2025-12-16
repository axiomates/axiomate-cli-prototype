/**
 * 自动补全 Hook
 */

import { useCallback, useRef, useEffect, useMemo } from "react";
import type { EditorState, EditorAction, SlashCommand } from "../types.js";
import { isSlashMode, isHistoryMode, buildCommandText } from "../types.js";

// 命令列表用于自动补全
const COMMANDS = [
	"help",
	"exit",
	"quit",
	"clear",
	"history",
	"config",
	"config set",
	"config get",
	"config list",
	"status",
	"start",
	"stop",
	"restart",
	"logs",
	"version",
];

type UseAutocompleteOptions = {
	state: EditorState;
	dispatch: React.Dispatch<EditorAction>;
	slashCommands: SlashCommand[];
};

type UseAutocompleteReturn = {
	/** 当前有效的建议（根据模式自动选择） */
	effectiveSuggestion: string | null;
	/** 当前层级的命令列表 */
	currentLevelCommands: SlashCommand[];
	/** 过滤后的命令列表 */
	filteredCommands: SlashCommand[];
	/** 斜杠模式的建议 */
	slashSuggestion: string | null;
};

/**
 * 自动补全 Hook
 */
export function useAutocomplete({
	state,
	dispatch,
	slashCommands,
}: UseAutocompleteOptions): UseAutocompleteReturn {
	const abortControllerRef = useRef<AbortController | null>(null);

	// 从 state 获取数据
	const { instance, uiMode, suggestion } = state;
	const { text: input, commandPath } = instance;

	// 模式判断
	const inSlashMode = isSlashMode(uiMode);
	const inHistoryMode = isHistoryMode(uiMode);
	const selectedIndex = isSlashMode(uiMode) ? uiMode.selectedIndex : 0;

	// 根据当前 path 获取当前层级的命令列表
	const currentLevelCommands = useMemo((): SlashCommand[] => {
		if (!inSlashMode) return [];

		// 根据 path 导航到当前层级
		let commands: SlashCommand[] = slashCommands;
		for (const segment of commandPath) {
			const found = commands.find(
				(c) => c.name.toLowerCase() === segment.toLowerCase(),
			);
			if (!found?.children) return [];
			commands = found.children;
		}
		return commands;
	}, [inSlashMode, commandPath, slashCommands]);

	// 过滤匹配的命令（根据用户输入）
	const filteredCommands = useMemo(() => {
		if (!inSlashMode) return [];

		// 计算当前层级的查询字符串
		const prefix = buildCommandText(commandPath, true);
		const query = input.startsWith(prefix)
			? input.slice(prefix.length).toLowerCase()
			: input.slice(1).toLowerCase(); // fallback for root level

		return currentLevelCommands.filter((cmd) =>
			cmd.name.toLowerCase().startsWith(query),
		);
	}, [input, inSlashMode, commandPath, currentLevelCommands]);

	// 斜杠命令模式下的自动补全建议
	const slashSuggestion = useMemo(() => {
		if (!inSlashMode || filteredCommands.length === 0) return null;
		const selectedCmd = filteredCommands[selectedIndex];
		if (!selectedCmd) return null;

		const prefix = buildCommandText(commandPath, true);
		const query = input.startsWith(prefix)
			? input.slice(prefix.length).toLowerCase()
			: input.slice(1).toLowerCase();
		const cmdName = selectedCmd.name.toLowerCase();

		if (cmdName.startsWith(query) && cmdName !== query) {
			return selectedCmd.name.slice(query.length);
		}
		return null;
	}, [inSlashMode, filteredCommands, selectedIndex, commandPath, input]);

	// 命令自动补全函数
	const getCommandSuggestion = useCallback(
		async (text: string, signal: AbortSignal): Promise<string | null> => {
			// 模拟异步延迟
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(resolve, 100);
				signal.addEventListener("abort", () => {
					clearTimeout(timeout);
					reject(new DOMException("Aborted", "AbortError"));
				});
			});

			if (signal.aborted) {
				return null;
			}

			// 查找匹配的命令
			const lowerInput = text.toLowerCase();
			const match = COMMANDS.find(
				(cmd) => cmd.toLowerCase().startsWith(lowerInput) && cmd !== text,
			);

			if (match) {
				return match.slice(text.length);
			}

			return null;
		},
		[],
	);

	// 触发自动补全
	const triggerAutocomplete = useCallback(
		async (text: string, browsing: boolean) => {
			// 历史浏览模式下不触发自动补全
			if (browsing) {
				return;
			}

			// 斜杠模式下使用 slashSuggestion，不触发异步补全
			if (text.startsWith("/")) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			// 取消之前的请求
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			if (!text) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				const result = await getCommandSuggestion(text, controller.signal);
				if (!controller.signal.aborted) {
					dispatch({ type: "SET_SUGGESTION", suggestion: result });
				}
			} catch {
				// 忽略取消错误
				if (!controller.signal.aborted) {
					dispatch({ type: "SET_SUGGESTION", suggestion: null });
				}
			}
		},
		[dispatch, getCommandSuggestion],
	);

	// 当输入变化时触发自动补全
	useEffect(() => {
		triggerAutocomplete(input, inHistoryMode);
	}, [input, inHistoryMode, triggerAutocomplete]);

	// 清理
	useEffect(() => {
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	// 合并建议：斜杠模式使用 slashSuggestion，普通模式使用 suggestion
	// 历史浏览模式下不显示建议
	const effectiveSuggestion = inHistoryMode
		? null
		: inSlashMode
			? slashSuggestion
			: suggestion;

	return {
		effectiveSuggestion,
		currentLevelCommands,
		filteredCommands,
		slashSuggestion,
	};
}
