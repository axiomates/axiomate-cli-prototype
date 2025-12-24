import type { SlashCommand } from "../components/AutocompleteInput/index.js";
import { getAllModels } from "../utils/config.js";
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
 * 根据模型配置生成自动补全模型选择命令
 */
function generateAutocompleteModelCommands(): SlashCommand[] {
	return getAllModels().map((model) => ({
		name: model.model,
		description: `${model.name}${model.description ? ` - ${model.description}` : ""}`,
		action: { type: "internal" as const, handler: "autocomplete_model_select" },
	}));
}

/**
 * 获取斜杠命令列表（使用当前语言）
 * 这个函数在运行时调用，使用当前激活的语言
 */
export function getSlashCommands(): SlashCommand[] {
	return [
		{
			name: "model",
			description: t("commands.model.description"),
			children: [
				// 动态生成模型选择命令
				...generateModelCommands(),
			],
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
			name: "autocomplete",
			description: t("commands.autocomplete.description"),
			children: [
				{
					name: "on",
					description: t("commands.autocomplete.onDesc"),
					action: { type: "internal", handler: "autocomplete_on" },
				},
				{
					name: "off",
					description: t("commands.autocomplete.offDesc"),
					action: { type: "internal", handler: "autocomplete_off" },
				},
				{
					name: "model",
					description: t("commands.autocomplete.modelDesc"),
					children: generateAutocompleteModelCommands(),
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
