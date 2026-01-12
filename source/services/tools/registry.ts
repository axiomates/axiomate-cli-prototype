/**
 * 工具注册表实现
 * 管理发现的本地开发工具
 *
 * 支持两阶段初始化：
 * 1. 同步注册内置工具（瞬间完成）
 * 2. 后台发现外部工具（不阻塞启动）
 */

import type {
	DiscoveredTool,
	ToolCategory,
	ToolCapability,
	IToolRegistry,
} from "./types.js";
import {
	getBuiltinTools,
	discoverExternalTools,
} from "./discoverers/index.js";
import { t } from "../../i18n/index.js";
import { getToolsForProjectType } from "../ai/toolMask.js";

// 工具发现状态
export type DiscoveryStatus = "pending" | "discovering" | "completed";

// 工具发现完成回调
export type DiscoveryCallback = (tools: DiscoveredTool[]) => void;

export class ToolRegistry implements IToolRegistry {
	tools: Map<string, DiscoveredTool> = new Map();
	private _builtinLoaded = false;
	private _externalDiscovered = false;
	private _discoveryStatus: DiscoveryStatus = "pending";
	private _discoveryCallbacks: DiscoveryCallback[] = [];
	private _frozenTools: DiscoveredTool[] | null = null;
	private _platformTools: DiscoveredTool[] | null = null;
	private _projectTools: DiscoveredTool[] | null = null;

	/**
	 * 同步注册内置工具（瞬间完成）
	 * 这些工具不依赖外部命令检测
	 */
	async loadBuiltinTools(): Promise<void> {
		if (this._builtinLoaded) return;

		const builtinTools = await getBuiltinTools();
		for (const tool of builtinTools) {
			this.tools.set(tool.id, tool);
		}
		this._builtinLoaded = true;
	}

	/**
	 * 后台发现外部工具（不阻塞）
	 * 发现完成后通过回调通知
	 */
	discoverExternalAsync(): void {
		if (this._discoveryStatus !== "pending") return;

		this._discoveryStatus = "discovering";

		discoverExternalTools()
			.then((tools) => {
				for (const tool of tools) {
					this.tools.set(tool.id, tool);
				}
				this._externalDiscovered = true;
				this._discoveryStatus = "completed";

				// 通知所有等待的回调
				for (const callback of this._discoveryCallbacks) {
					callback(tools);
				}
				this._discoveryCallbacks = [];
			})
			.catch(() => {
				// 发现失败也标记为完成，使用已有的内置工具
				this._discoveryStatus = "completed";
			});
	}

	/**
	 * 注册发现完成回调
	 */
	onDiscoveryComplete(callback: DiscoveryCallback): void {
		if (this._discoveryStatus === "completed") {
			// 已完成，立即调用
			callback(this.getAll());
		} else {
			this._discoveryCallbacks.push(callback);
		}
	}

	/**
	 * 获取发现状态
	 */
	get discoveryStatus(): DiscoveryStatus {
		return this._discoveryStatus;
	}

	/**
	 * 执行完整工具发现（兼容旧接口）
	 * @deprecated 使用 loadBuiltinTools() + discoverExternalAsync() 代替
	 */
	async discover(): Promise<void> {
		await this.loadBuiltinTools();

		const externalTools = await discoverExternalTools();
		for (const tool of externalTools) {
			this.tools.set(tool.id, tool);
		}
		this._externalDiscovered = true;
		this._discoveryStatus = "completed";
	}

	/**
	 * 检查是否已执行过发现
	 * @deprecated 使用 discoveryStatus 代替
	 */
	get isDiscovered(): boolean {
		return this._builtinLoaded;
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
	 * 冻结工具列表（加载完成后调用）
	 * 冻结后工具列表不再变化，用于优化 KV cache
	 */
	freezeTools(): void {
		if (this._frozenTools) return; // 已冻结

		// 只保留已安装的工具，按 ID 排序确保稳定
		this._frozenTools = Array.from(this.tools.values())
			.filter((tool) => tool.installed)
			.sort((a, b) => a.id.localeCompare(b.id));
	}

	/**
	 * 获取冻结的工具列表
	 */
	getFrozenTools(): DiscoveredTool[] {
		return this._frozenTools ?? [];
	}

	/**
	 * 检查是否已冻结
	 */
	isFrozen(): boolean {
		return this._frozenTools !== null;
	}

	/**
	 * 冻结平台工具集（版本A）
	 * 只包含核心工具：askuser, file, web, git, shell, enterplan, plan
	 */
	freezePlatformTools(): void {
		if (this._platformTools) return; // 已冻结

		// 核心工具 ID 列表
		const coreToolIds = new Set([
			"a-c-askuser",
			"a-c-file",
			"a-c-web",
			"a-c-git",
			"a-c-bash",
			"a-c-powershell",
			"a-c-cmd",
			"a-c-pwsh",
			"a-c-enterplan",
			"p-plan",
		]);

		this._platformTools = Array.from(this.tools.values())
			.filter((tool) => tool.installed && coreToolIds.has(tool.id))
			.sort((a, b) => a.id.localeCompare(b.id));
	}

	/**
	 * 冻结项目工具集（版本B）
	 * 版本A + 根据项目类型添加的工具
	 */
	freezeProjectTools(projectType?: string): void {
		if (this._projectTools) return; // 已冻结

		// 确保平台工具已冻结
		if (!this._platformTools) {
			this.freezePlatformTools();
		}

		// 获取项目类型对应的工具 ID
		const projectToolIds = getToolsForProjectType(projectType);

		// 版本B = 版本A + 项目工具
		const projectToolsOnly = Array.from(this.tools.values()).filter(
			(tool) =>
				tool.installed &&
				projectToolIds.has(tool.id) &&
				!this._platformTools!.some((pt) => pt.id === tool.id),
		);

		this._projectTools = [...this._platformTools!, ...projectToolsOnly].sort(
			(a, b) => a.id.localeCompare(b.id),
		);
	}

	/**
	 * 获取平台工具集
	 */
	getPlatformTools(): DiscoveredTool[] {
		return this._platformTools ?? [];
	}

	/**
	 * 获取项目工具集
	 */
	getProjectTools(): DiscoveredTool[] {
		return this._projectTools ?? [];
	}

	/**
	 * 检查是否已冻结平台工具
	 */
	isPlatformFrozen(): boolean {
		return this._platformTools !== null;
	}

	/**
	 * 检查是否已冻结项目工具
	 */
	isProjectFrozen(): boolean {
		return this._projectTools !== null;
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
