/**
 * 工具注册表实现
 * 管理发现的本地开发工具
 */

import type {
	DiscoveredTool,
	ToolCategory,
	ToolCapability,
	IToolRegistry,
} from "./types.js";
import { discoverAllTools } from "./discoverers/index.js";
import { t } from "../../i18n/index.js";

export class ToolRegistry implements IToolRegistry {
	tools: Map<string, DiscoveredTool> = new Map();
	private _discovered = false;

	/**
	 * 执行工具发现
	 */
	async discover(): Promise<void> {
		const tools = await discoverAllTools();
		this.tools.clear();
		for (const tool of tools) {
			this.tools.set(tool.id, tool);
		}
		this._discovered = true;
	}

	/**
	 * 检查是否已执行过发现
	 */
	get isDiscovered(): boolean {
		return this._discovered;
	}

	/**
	 * 获取所有工具（包括未安装的）
	 */
	getAll(): DiscoveredTool[] {
		return Array.from(this.tools.values());
	}

	/**
	 * 获取已安装的工具
	 */
	getInstalled(): DiscoveredTool[] {
		return Array.from(this.tools.values()).filter((t) => t.installed);
	}

	/**
	 * 获取未安装的工具
	 */
	getNotInstalled(): DiscoveredTool[] {
		return Array.from(this.tools.values()).filter((t) => !t.installed);
	}

	/**
	 * 按类别获取工具
	 */
	getByCategory(category: ToolCategory): DiscoveredTool[] {
		return Array.from(this.tools.values()).filter(
			(t) => t.category === category,
		);
	}

	/**
	 * 按能力获取工具
	 */
	getByCapability(capability: ToolCapability): DiscoveredTool[] {
		return Array.from(this.tools.values()).filter((t) =>
			t.capabilities.includes(capability),
		);
	}

	/**
	 * 获取单个工具
	 */
	getTool(id: string): DiscoveredTool | undefined {
		return this.tools.get(id);
	}

	/**
	 * 获取统计信息
	 */
	getStats(): {
		total: number;
		installed: number;
		notInstalled: number;
		byCategory: Record<string, number>;
	} {
		const all = this.getAll();
		const installed = all.filter((t) => t.installed);
		const byCategory: Record<string, number> = {};

		for (const tool of all) {
			if (tool.installed) {
				byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
			}
		}

		return {
			total: all.length,
			installed: installed.length,
			notInstalled: all.length - installed.length,
			byCategory,
		};
	}

	/**
	 * 格式化工具列表为显示字符串
	 * 注意：marked-terminal 在列表项中不支持粗体，所以这里使用纯文本格式
	 */
	formatToolList(includeNotInstalled = true): string {
		const lines: string[] = [];
		const categories = new Map<ToolCategory, DiscoveredTool[]>();

		// 按类别分组
		for (const tool of this.tools.values()) {
			if (!includeNotInstalled && !tool.installed) continue;

			const list = categories.get(tool.category) || [];
			list.push(tool);
			categories.set(tool.category, list);
		}

		// 输出每个类别
		for (const [category, tools] of categories) {
			const categoryName = t(`toolCategories.${category}`);
			lines.push(`\n## ${categoryName || category}`);
			lines.push(""); // 空行让 marked 正确解析段落
			for (const tool of tools) {
				const status = tool.installed
					? `✓ ${tool.version || ""}`
					: t("toolList.notInstalled");
				// 每个工具作为单独段落（需要前后空行）
				lines.push(`**${tool.name}** \`${tool.id}\` ${status}`);
				if (!tool.installed && tool.installHint) {
					lines.push(
						`> ${t("toolList.installHint", { hint: tool.installHint.split("\n")[0] })}`,
					);
				}
				lines.push(""); // 段落分隔
			}
		}

		return lines.join("\n");
	}
}

// 单例实例
let _instance: ToolRegistry | null = null;

/**
 * 获取工具注册表单例
 */
export function getToolRegistry(): ToolRegistry {
	if (!_instance) {
		_instance = new ToolRegistry();
	}
	return _instance;
}

/**
 * 初始化工具注册表（执行发现）
 */
export async function initToolRegistry(): Promise<ToolRegistry> {
	const registry = getToolRegistry();
	if (!registry.isDiscovered) {
		await registry.discover();
	}
	return registry;
}
