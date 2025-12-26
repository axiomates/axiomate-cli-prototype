import type { SlashCommand } from "../components/AutocompleteInput/index.js";
import {
	getAllModels,
	getCurrentModelId,
	getModelById,
	isThinkingEnabled,
	isSuggestionEnabled,
} from "../utils/config.js";
import { t, addLocaleChangeListener } from "../i18n/index.js";

/**
 * 根据模型配置生成模型选择命令
 */
function generateModelCommands(): SlashCommand[] {
	return getAllModels().map((model) => ({
		name: model.model,
		description: `${model.name}${model.description ? ` - ${model.description}` : ""}`,
		action: { type: "internal" as const, handler: "model_select" },
	}));
}

/**
 * 根据模型配置生成建议模型选择命令
 */
function generateSuggestionModelCommands(): SlashCommand[] {
	return getAllModels().map((model) => ({
		name: model.model,
		description: `${model.name}${model.description ? ` - ${model.description}` : ""}`,
		action: { type: "internal" as const, handler: "suggestion_model_select" },
	}));
}

/**
 * 获取当前模型的显示名称
 */
function getCurrentModelDisplay(): string {
	const modelId = getCurrentModelId();
	if (!modelId) return "";
	const model = getModelById(modelId);
	return model?.name || modelId;
}

/**
 * 获取斜杠命令列表（使用当前语言）
 * 这个函数在运行时调用，使用当前激活的语言
 */
export function getSlashCommands(): SlashCommand[] {
	// 获取当前状态用于显示
	const currentModelName = getCurrentModelDisplay();
	const thinkingStatus = isThinkingEnabled() ? t("common.on") : t("common.off");
	const suggestionStatus = isSuggestionEnabled() ? t("common.on") : t("common.off");

	return [
		{
			name: "model",
			description: currentModelName
				? `${t("commands.model.description")} [${currentModelName}]`
				: t("commands.model.description"),
			children: [
				// 动态生成模型选择命令
				...generateModelCommands(),
			],
		},
		{
			name: "thinking",
			description: `${t("commands.thinking.description")} [${thinkingStatus}]`,
			children: [
				{
					name: "on",
					description: t("commands.thinking.onDesc"),
					action: { type: "internal", handler: "thinking_on" },
				},
				{
					name: "off",
					description: t("commands.thinking.offDesc"),
					action: { type: "internal", handler: "thinking_off" },
				},
			],
		},
		{
			name: "compact",
			description: t("commands.compact.description"),
			action: { type: "internal", handler: "compact" },
		},
		{
			name: "new",
			description: t("commands.new.description"),
			action: { type: "internal", handler: "new_session" },
		},
		{
			name: "clear",
			description: t("commands.clear.description"),
			action: { type: "internal", handler: "clear" },
		},
		{
			name: "stop",
			description: t("commands.stop.description"),
			action: { type: "internal", handler: "stop" },
		},
		{
			name: "tools",
			description: t("commands.tools.description"),
			children: [
				{
					name: "list",
					description: t("commands.tools.listDesc"),
					action: { type: "internal", handler: "tools_list" },
				},
				{
					name: "refresh",
					description: t("commands.tools.refreshDesc"),
					action: { type: "internal", handler: "tools_refresh" },
				},
				{
					name: "stats",
					description: t("commands.tools.statsDesc"),
					action: { type: "internal", handler: "tools_stats" },
				},
			],
		},
		{
			name: "suggestion",
			description: `${t("commands.suggestion.description")} [${suggestionStatus}]`,
			children: [
				{
					name: "on",
					description: t("commands.suggestion.onDesc"),
					action: { type: "internal", handler: "suggestion_on" },
				},
				{
					name: "off",
					description: t("commands.suggestion.offDesc"),
					action: { type: "internal", handler: "suggestion_off" },
				},
				{
					name: "model",
					description: t("commands.suggestion.modelDesc"),
					children: generateSuggestionModelCommands(),
				},
			],
		},
		{
			name: "language",
			description: t("commands.language.description"),
			children: [
				{
					name: "en",
					description: t("commands.language.enDesc"),
					action: { type: "internal", handler: "language_en" },
				},
				{
					name: "zh-CN",
					description: t("commands.language.zhCNDesc"),
					action: { type: "internal", handler: "language_zh-CN" },
				},
				{
					name: "ja",
					description: t("commands.language.jaDesc"),
					action: { type: "internal", handler: "language_ja" },
				},
			],
		},
		{
			name: "exit",
			description: t("commands.exit.description"),
			action: { type: "internal", handler: "exit" },
		},
	];
}

// 向后兼容：导出一个懒加载的 SLASH_COMMANDS
// 第一次访问时生成命令
let cachedCommands: SlashCommand[] | null = null;

/**
 * 清除命令缓存，下次访问时重新生成
 * 用于模型切换、thinking 状态切换等需要更新命令描述的场景
 */
export function clearCommandCache(): void {
	cachedCommands = null;
}

// 监听语言切换，清除缓存
addLocaleChangeListener(() => {
	cachedCommands = null;
});

export const SLASH_COMMANDS: SlashCommand[] = new Proxy([] as SlashCommand[], {
	get(target, prop) {
		if (!cachedCommands) {
			cachedCommands = getSlashCommands();
		}
		return (cachedCommands as any)[prop];
	},
	has(target, prop) {
		if (!cachedCommands) {
			cachedCommands = getSlashCommands();
		}
		return prop in cachedCommands;
	},
	ownKeys() {
		if (!cachedCommands) {
			cachedCommands = getSlashCommands();
		}
		return Reflect.ownKeys(cachedCommands);
	},
	getOwnPropertyDescriptor(target, prop) {
		if (!cachedCommands) {
			cachedCommands = getSlashCommands();
		}
		return Reflect.getOwnPropertyDescriptor(cachedCommands, prop);
	},
});
