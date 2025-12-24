/**
 * 自动补全 Hook
 *
 * Uses AI-powered autocomplete for normal text input.
 * Slash commands use local filtering (no AI).
 */

import { useCallback, useRef, useEffect, useMemo } from "react";
import type { EditorState, EditorAction, SlashCommand } from "../types.js";
import { isSlashMode, isHistoryMode, buildCommandText } from "../types.js";
import { getAutocompleteClient } from "../../../services/ai/autocompleteClient.js";
import {
	AUTOCOMPLETE_DEBOUNCE_MS,
	MIN_INPUT_LENGTH,
} from "../../../constants/autocomplete.js";
import { isAutocompleteEnabled } from "../../../utils/config.js";

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

	// Debounce timer ref
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// AI-powered autocomplete function
	const getAISuggestion = useCallback(
		async (text: string): Promise<string | null> => {
			// Skip if input is too short
			if (text.length < MIN_INPUT_LENGTH) {
				return null;
			}

			// Get suggestion from AI client (handles its own cancellation)
			const client = getAutocompleteClient();
			const result = await client.getSuggestion(text, {
				cwd: process.cwd(),
			});

			return result.suggestion;
		},
		[],
	);

	// 触发自动补全 (with debounce for AI requests)
	const triggerAutocomplete = useCallback(
		(text: string, browsing: boolean) => {
			// Clear any pending debounce timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}

			// 历史浏览模式下不触发自动补全
			if (browsing) {
				return;
			}

			// 斜杠模式下使用 slashSuggestion，不触发异步补全
			if (text.startsWith("/")) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			// @ 文件选择模式下不触发自动补全
			if (text.startsWith("@")) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			// 检查是否启用自动补全
			if (!isAutocompleteEnabled()) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				return;
			}

			// Empty or too short input
			if (!text || text.length < MIN_INPUT_LENGTH) {
				dispatch({ type: "SET_SUGGESTION", suggestion: null });
				// Cancel any in-progress AI request
				getAutocompleteClient().cancel();
				return;
			}

			// Debounce AI requests
			debounceTimerRef.current = setTimeout(async () => {
				try {
					const result = await getAISuggestion(text);
					dispatch({ type: "SET_SUGGESTION", suggestion: result });
				} catch {
					// Silent error handling
					dispatch({ type: "SET_SUGGESTION", suggestion: null });
				}
			}, AUTOCOMPLETE_DEBOUNCE_MS);
		},
		[dispatch, getAISuggestion],
	);

	// 当输入变化时触发自动补全
	useEffect(() => {
		triggerAutocomplete(input, inHistoryMode);
	}, [input, inHistoryMode, triggerAutocomplete]);

	// 清理: Cancel pending requests and timers on unmount
	useEffect(() => {
		return () => {
			// Clear debounce timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
			// Cancel any in-progress AI request
			getAutocompleteClient().cancel();
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
