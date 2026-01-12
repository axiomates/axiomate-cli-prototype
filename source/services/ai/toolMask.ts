/**
 * 工具遮蔽状态构建器
 *
 * 根据用户输入和上下文构建工具遮蔽状态，用于动态控制可用工具子集
 * 保持工具列表稳定（优化 KV cache），通过 tool_choice 或动态过滤实现遮蔽
 */

import type { ToolMaskState, MatchContext } from "./types.js";
import type { DiscoveredTool } from "../tools/types.js";
import { tArray } from "../../i18n/index.js";
import { currentModelSupportsToolChoice } from "../../utils/config.js";
import {
	ACTION_CORE_TOOLS,
	getPlatformShellTools,
} from "../../constants/tools.js";

/**
 * 关键词到工具 ID 的映射
 * 用于根据用户输入内容匹配相关工具
 * 工具 ID 格式：a-c-{tool} 或 a-{tool}
 */
const KEYWORD_TO_TOOL: Record<string, string[]> = {
	// Web 相关 (核心工具)
	"a-c-web": [
		"http",
		"https",
		"url",
		"fetch",
		"web",
		"webpage",
		"website",
		"网页",
		"网站",
		"链接",
	],

	// 版本控制 (核心工具)
	"a-c-git": [
		"git",
		"commit",
		"branch",
		"merge",
		"push",
		"pull",
		"clone",
		"checkout",
		"stash",
		"rebase",
		"提交",
		"分支",
	],

	// 运行时
	"a-node": [
		"node",
		"nodejs",
		"npm",
		"npx",
		"yarn",
		"pnpm",
		"package.json",
		"javascript",
		"typescript",
	],
	"a-python": ["python", "pip", "pyenv", "conda", "poetry", "requirements.txt"],
	"a-java": ["java", "javac", "maven", "gradle", "mvn"],

	// 构建工具
	"a-cmake": ["cmake", "CMakeLists", "make"],
	"a-gradle": ["gradle", "gradlew"],
	"a-maven": ["maven", "mvn", "pom.xml"],

	// 容器
	"a-docker": ["docker", "dockerfile", "container", "compose", "容器"],
	"a-dockercompose": ["dockercompose", "docker compose", "compose.yml"],

	// 数据库
	"a-mysql": ["mysql", "mariadb"],
	"a-psql": ["postgresql", "postgres", "psql"],
	"a-sqlite3": ["sqlite", "sqlite3"],

	// IDE
	"a-vscode": ["vscode", "code", "visual studio code"],
	"a-vs2022": ["visual studio", "msbuild", "sln", "csproj"],

	// 比较工具
	"a-beyondcompare": ["beyond compare", "diff", "compare", "merge files"],
};


/**
 * 获取 web 关键词（包含 i18n）
 */
function getWebKeywords(): string[] {
	const staticKeywords = KEYWORD_TO_TOOL["a-c-web"] || [];
	const i18nKeywords = tArray("tools.webKeywords");
	if (i18nKeywords.length > 0) {
		return [...staticKeywords, ...i18nKeywords];
	}
	return staticKeywords;
}

/**
 * 根据输入内容匹配工具
 */
function matchToolsByInput(input: string): Set<string> {
	const matched = new Set<string>();
	const lowerInput = input.toLowerCase();

	// 特殊处理 web 关键词（包含 i18n）
	const webKeywords = getWebKeywords();
	for (const keyword of webKeywords) {
		if (lowerInput.includes(keyword.toLowerCase())) {
			matched.add("a-c-web");
			break;
		}
	}

	// 匹配其他工具
	for (const [toolId, keywords] of Object.entries(KEYWORD_TO_TOOL)) {
		if (toolId === "a-c-web") continue; // 已处理

		for (const keyword of keywords) {
			if (lowerInput.includes(keyword.toLowerCase())) {
				matched.add(toolId);
				break;
			}
		}
	}

	return matched;
}

/**
 * 根据项目类型添加相关工具
 */
export function getToolsForProjectType(
	projectType: string | undefined,
): Set<string> {
	const tools = new Set<string>();

	switch (projectType) {
		case "node":
			tools.add("a-node");
			tools.add("a-npm");
			break;
		case "python":
			tools.add("a-python");
			break;
		case "java":
			tools.add("a-java");
			tools.add("a-javac");
			tools.add("a-maven");
			tools.add("a-gradle");
			break;
		case "cpp":
			tools.add("a-cmake");
			break;
		case "dotnet":
			tools.add("a-vs2022");
			tools.add("a-msbuild");
			break;
		case "rust":
			// rust 工具暂未实现
			break;
		case "go":
			// go 工具暂未实现
			break;
	}

	return tools;
}

/**
 * 构建工具遮蔽状态
 *
 * @param input 用户输入内容
 * @param projectType 项目类型（已在 AIService 初始化时固定）
 * @param planMode 是否为 Plan 模式
 * @param availableTools 可用的工具列表
 * @returns 工具遮蔽状态
 */
export function buildToolMask(
	input: string,
	projectType: string | undefined,
	planMode: boolean,
	availableTools: DiscoveredTool[],
): ToolMaskState {
	// 构建可用工具 ID 集合
	const availableToolIds = new Set(availableTools.map((t) => t.id));

	// Plan 模式：只允许 plan 工具
	if (planMode) {
		const supportsToolChoice = currentModelSupportsToolChoice();

		if (supportsToolChoice) {
			// 模型支持 tool_choice，使用冻结工具列表 + tool_choice 限制
			return {
				mode: "p",
				allowedTools: new Set(["p-plan"]),
			};
		} else {
			// Fallback: 动态过滤工具列表（不支持 tool_choice）
			return {
				mode: "p",
				allowedTools: new Set(["p-plan"]),
				useDynamicFiltering: true,
			};
		}
	}

	// Action 模式：构建允许的工具集（两种模式共享相同的工具收集逻辑）
	const allowedTools = new Set<string>();

	// 1. 添加 Action 模式核心工具（askuser, file, web, git, enterplan）
	for (const toolId of ACTION_CORE_TOOLS) {
		if (availableToolIds.has(toolId)) {
			allowedTools.add(toolId);
		}
	}

	// 2. 添加平台 shell 工具
	for (const shellTool of getPlatformShellTools()) {
		if (availableToolIds.has(shellTool)) {
			allowedTools.add(shellTool);
		}
	}

	// 3. 根据项目类型添加工具
	const projectTools = getToolsForProjectType(projectType);
	for (const toolId of projectTools) {
		if (availableToolIds.has(toolId)) {
			allowedTools.add(toolId);
		}
	}

	// 4. 根据用户输入匹配工具
	const inputMatched = matchToolsByInput(input);
	for (const toolId of inputMatched) {
		if (availableToolIds.has(toolId)) {
			allowedTools.add(toolId);
		}
	}

	// filtered 模式：发送过滤后的工具子集
	return {
		mode: "a",
		allowedTools,
		useDynamicFiltering: true,
	};
}

/**
 * 检查工具调用是否被允许
 */
export function isToolAllowed(
	toolId: string,
	mask: ToolMaskState | undefined,
): boolean {
	if (!mask) {
		return true; // 没有遮蔽状态，允许所有工具
	}
	return mask.allowedTools.has(toolId);
}

/**
 * 获取不在允许列表中的工具错误消息
 */
export function getToolNotAllowedError(
	toolId: string,
	mask: ToolMaskState,
): string {
	const allowedList = [...mask.allowedTools].join(", ");
	return `Error: Tool "${toolId}" is not available in current context. Available tools: ${allowedList}`;
}
