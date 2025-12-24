/**
 * 工具匹配器
 * 根据用户查询、上下文信息匹配合适的工具
 */

import type {
	IToolMatcher,
	MatchContext,
	MatchResult,
	ProjectType,
} from "../ai/types.js";
import type { DiscoveredTool, ToolCapability, IToolRegistry } from "./types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { platform } from "node:os";

/**
 * 关键词到工具 ID 的映射
 */
const KEYWORD_MAP: Record<string, string[]> = {
	// 版本控制
	git: [
		"git",
		"version control",
		"commit",
		"branch",
		"merge",
		"push",
		"pull",
		"clone",
		"checkout",
		"stash",
		"rebase",
	],
	svn: ["svn", "subversion"],

	// 运行时
	node: [
		"node",
		"nodejs",
		"npm",
		"javascript",
		"js",
		"typescript",
		"ts",
		"yarn",
		"pnpm",
	],
	python: ["python", "pip", "py", "pyenv", "conda", "poetry"],
	java: ["java", "jvm", "maven", "gradle", "jar", "javac"],
	dotnet: ["dotnet", ".net", "csharp", "c#", "nuget", "msbuild"],
	rust: ["rust", "cargo", "rustc"],
	go: ["go", "golang"],

	// 工具
	bc4: [
		"beyond compare",
		"beyondcompare",
		"bc4",
		"diff",
		"compare",
		"merge files",
		"file comparison",
	],
	vscode: ["vscode", "vs code", "visual studio code", "code"],
	vs2022: ["visual studio", "vs2022", "vs 2022", "msbuild"],
	docker: ["docker", "container", "dockerfile", "compose"],

	// 数据库
	mysql: ["mysql", "mariadb"],
	postgresql: ["postgresql", "postgres", "psql"],
	sqlite: ["sqlite", "sqlite3"],
};

/**
 * 能力到工具的映射
 */
const CAPABILITY_MAP: Record<string, ToolCapability> = {
	"compare files": "diff",
	"diff files": "diff",
	"merge files": "merge",
	"edit file": "edit",
	"open file": "edit",
	"build project": "build",
	compile: "build",
	"run code": "execute",
	execute: "execute",
	debug: "debug",
	"format code": "format",
	"lint code": "lint",
	"check code": "lint",
};

/**
 * Get default shell tools for the current platform
 * Windows: python (if available), powershell, pwsh, cmd
 *   - Python is preferred because it has better UTF-8 encoding handling
 *   - PowerShell 5.1 has encoding issues with Unicode characters
 * Unix/Linux/macOS: bash
 */
function getDefaultShellTools(): string[] {
	if (platform() === "win32") {
		// Python 优先，因为它的 UTF-8 编码处理更可靠
		// PowerShell 5.1 对 Unicode 字符处理不可靠
		return ["python", "powershell", "pwsh", "cmd"];
	}
	// Unix/Linux/macOS
	return ["bash"];
}

/**
 * Default shell tools (without Python check, used for static initialization)
 * Will be overridden by dynamic detection in autoSelect
 */
const SHELL_TOOLS = getDefaultShellTools();

/**
 * 项目类型到工具的映射（包含平台相关的 shell 工具）
 * Shell 工具在开头，优先被选择
 */
const PROJECT_TYPE_TOOLS: Record<ProjectType, string[]> = {
	node: [...SHELL_TOOLS, "node", "git"],
	python: [...SHELL_TOOLS, "python", "git"],
	java: [...SHELL_TOOLS, "java", "git", "vs2022"],
	dotnet: [...SHELL_TOOLS, "dotnet", "git", "vs2022"],
	rust: [...SHELL_TOOLS, "rust", "git"],
	go: [...SHELL_TOOLS, "go", "git"],
	unknown: [...SHELL_TOOLS, "git"],
};

/**
 * 目录/文件存在性检测规则
 * 用于 autoSelect 自动推断需要的工具
 */
type DirectoryDetectionRule = {
	/** 检测的路径（相对于 cwd） */
	path: string;
	/** 是否为目录 */
	isDirectory: boolean;
	/** 匹配后添加的工具 ID */
	tools: string[];
};

const DIRECTORY_DETECTION_RULES: DirectoryDetectionRule[] = [
	// 版本控制
	{ path: ".git", isDirectory: true, tools: ["git"] },
	{ path: ".svn", isDirectory: true, tools: ["svn"] },

	// Docker
	{ path: "Dockerfile", isDirectory: false, tools: ["docker"] },
	{ path: "docker-compose.yml", isDirectory: false, tools: ["docker"] },
	{ path: "docker-compose.yaml", isDirectory: false, tools: ["docker"] },
	{ path: "compose.yml", isDirectory: false, tools: ["docker"] },
	{ path: "compose.yaml", isDirectory: false, tools: ["docker"] },
	{ path: ".dockerignore", isDirectory: false, tools: ["docker"] },

	// Node.js 生态
	{ path: "node_modules", isDirectory: true, tools: ["node"] },
	{ path: "package-lock.json", isDirectory: false, tools: ["node"] },
	{ path: "yarn.lock", isDirectory: false, tools: ["node"] },
	{ path: "pnpm-lock.yaml", isDirectory: false, tools: ["node"] },
	{ path: "bun.lockb", isDirectory: false, tools: ["node"] },
	{ path: ".nvmrc", isDirectory: false, tools: ["node"] },
	{ path: ".node-version", isDirectory: false, tools: ["node"] },

	// Python 生态
	{ path: ".venv", isDirectory: true, tools: ["python"] },
	{ path: "venv", isDirectory: true, tools: ["python"] },
	{ path: ".python-version", isDirectory: false, tools: ["python"] },
	{ path: "Pipfile", isDirectory: false, tools: ["python"] },
	{ path: "Pipfile.lock", isDirectory: false, tools: ["python"] },
	{ path: "poetry.lock", isDirectory: false, tools: ["python"] },

	// Java/Gradle/Maven
	{ path: ".gradle", isDirectory: true, tools: ["java"] },
	{ path: "gradlew", isDirectory: false, tools: ["java"] },
	{ path: "mvnw", isDirectory: false, tools: ["java"] },
	{ path: ".mvn", isDirectory: true, tools: ["java"] },

	// Rust
	{ path: "Cargo.lock", isDirectory: false, tools: ["rust"] },
	{ path: "target", isDirectory: true, tools: ["rust"] },

	// Go
	{ path: "go.sum", isDirectory: false, tools: ["go"] },

	// .NET
	{ path: "bin", isDirectory: true, tools: ["dotnet"] },
	{ path: "obj", isDirectory: true, tools: ["dotnet"] },
	{ path: "*.csproj", isDirectory: false, tools: ["dotnet", "vs2022"] },
	{ path: "*.sln", isDirectory: false, tools: ["dotnet", "vs2022"] },

	// 数据库
	{ path: "*.db", isDirectory: false, tools: ["sqlite"] },
	{ path: "*.sqlite", isDirectory: false, tools: ["sqlite"] },
	{ path: "*.sqlite3", isDirectory: false, tools: ["sqlite"] },
];

/**
 * 检测项目类型
 */
export function detectProjectType(cwd: string): ProjectType {
	const checks: Array<{ file: string; type: ProjectType }> = [
		{ file: "package.json", type: "node" },
		{ file: "requirements.txt", type: "python" },
		{ file: "pyproject.toml", type: "python" },
		{ file: "setup.py", type: "python" },
		{ file: "pom.xml", type: "java" },
		{ file: "build.gradle", type: "java" },
		{ file: "build.gradle.kts", type: "java" },
		{ file: "*.csproj", type: "dotnet" },
		{ file: "*.sln", type: "dotnet" },
		{ file: "Cargo.toml", type: "rust" },
		{ file: "go.mod", type: "go" },
	];

	for (const check of checks) {
		if (check.file.includes("*")) {
			// glob 模式
			const ext = check.file.replace("*", "");
			try {
				const files = fs.readdirSync(cwd);
				if (files.some((f) => f.endsWith(ext))) {
					return check.type;
				}
			} catch {
				// 忽略读取错误
			}
		} else {
			const filePath = path.join(cwd, check.file);
			if (fs.existsSync(filePath)) {
				return check.type;
			}
		}
	}

	return "unknown";
}

/**
 * 工具匹配器实现
 */
export class ToolMatcher implements IToolMatcher {
	constructor(private registry: IToolRegistry) {}

	/**
	 * 根据查询匹配工具
	 */
	match(query: string, context?: MatchContext): MatchResult[] {
		const results: MatchResult[] = [];
		const queryLower = query.toLowerCase();
		const installedTools = this.registry.getInstalled();

		// 1. 关键词匹配
		for (const [toolId, keywords] of Object.entries(KEYWORD_MAP)) {
			const matchedKeyword = keywords.find((kw) => queryLower.includes(kw));
			if (matchedKeyword) {
				const tool = this.registry.getTool(toolId);
				if (tool?.installed) {
					// 为每个 action 创建匹配结果
					for (const action of tool.actions) {
						const actionScore = this.calculateActionScore(
							action.name,
							action.description,
							queryLower,
						);
						results.push({
							tool,
							action,
							score: 0.7 + actionScore * 0.3,
							reason: `关键词匹配: "${matchedKeyword}"`,
						});
					}
				}
			}
		}

		// 2. 能力匹配
		for (const [desc, capability] of Object.entries(CAPABILITY_MAP)) {
			if (queryLower.includes(desc)) {
				const tools = this.registry.getByCapability(capability);
				for (const tool of tools) {
					if (!tool.installed) continue;
					// 避免重复
					if (results.some((r) => r.tool.id === tool.id)) continue;

					for (const action of tool.actions) {
						results.push({
							tool,
							action,
							score: 0.6,
							reason: `能力匹配: "${capability}"`,
						});
					}
				}
			}
		}

		// 3. 上下文感知匹配
		if (context) {
			const contextTools = this.autoSelect(context);
			for (const tool of contextTools) {
				// 避免重复
				if (results.some((r) => r.tool.id === tool.id)) continue;

				for (const action of tool.actions) {
					results.push({
						tool,
						action,
						score: 0.4,
						reason: `上下文推荐 (${context.projectType || "当前目录"})`,
					});
				}
			}
		}

		// 4. 工具名称/描述模糊匹配
		for (const tool of installedTools) {
			// 避免重复
			if (results.some((r) => r.tool.id === tool.id)) continue;

			const nameMatch =
				tool.name.toLowerCase().includes(queryLower) ||
				tool.description.toLowerCase().includes(queryLower);

			if (nameMatch) {
				for (const action of tool.actions) {
					results.push({
						tool,
						action,
						score: 0.3,
						reason: "名称/描述匹配",
					});
				}
			}
		}

		// 按分数排序
		return results.sort((a, b) => b.score - a.score);
	}

	/**
	 * 计算动作匹配分数
	 */
	private calculateActionScore(
		actionName: string,
		actionDesc: string,
		query: string,
	): number {
		const nameLower = actionName.toLowerCase();
		const descLower = actionDesc.toLowerCase();

		if (query.includes(nameLower)) return 1;
		if (nameLower.includes(query)) return 0.8;
		if (descLower.includes(query)) return 0.5;

		return 0;
	}

	/**
	 * 根据能力匹配工具
	 */
	matchByCapability(capability: string): DiscoveredTool[] {
		const cap = CAPABILITY_MAP[capability.toLowerCase()];
		if (!cap) {
			return [];
		}
		return this.registry.getByCapability(cap).filter((t) => t.installed);
	}

	/**
	 * 根据项目上下文自动选择工具
	 */
	autoSelect(context: MatchContext): DiscoveredTool[] {
		const results: DiscoveredTool[] = [];
		const addedToolIds = new Set<string>();

		const addTool = (toolId: string) => {
			if (addedToolIds.has(toolId)) return;
			const tool = this.registry.getTool(toolId);
			if (tool?.installed) {
				results.push(tool);
				addedToolIds.add(toolId);
			}
		};

		// 0. 在 Windows 上动态获取 shell 工具列表（Python 优先如果可用）
		const dynamicShellTools = getDefaultShellTools();

		// 1. 根据项目类型选择
		let projectType = context.projectType;
		if (!projectType && context.cwd) {
			projectType = detectProjectType(context.cwd);
		}

		if (projectType) {
			// 使用动态 shell 工具列表替代静态列表
			const baseTools = PROJECT_TYPE_TOOLS[projectType] || [];
			// 替换 shell 工具为动态检测的列表
			const nonShellTools = baseTools.filter(
				(t) => !SHELL_TOOLS.includes(t) && !["python"].includes(t),
			);
			const toolIds = [...dynamicShellTools, ...nonShellTools];
			for (const toolId of toolIds) {
				addTool(toolId);
			}
		}

		// 2. 根据目录内容检测工具（.git, Dockerfile 等）
		if (context.cwd) {
			const detectedTools = this.detectToolsFromDirectory(context.cwd);
			for (const toolId of detectedTools) {
				addTool(toolId);
			}
		}

		// 3. 根据选中的文件推断工具
		if (context.selectedFiles) {
			for (const file of context.selectedFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					addTool(toolId);
				}

				// 检测特殊文件名
				const fileName = path.basename(file).toLowerCase();
				const fileNameTools = this.inferToolsFromFileName(fileName);
				for (const toolId of fileNameTools) {
					addTool(toolId);
				}
			}
		}

		// 4. 根据当前文件推断工具
		if (context.currentFiles) {
			for (const file of context.currentFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					addTool(toolId);
				}

				// 检测特殊文件名
				const fileName = path.basename(file).toLowerCase();
				const fileNameTools = this.inferToolsFromFileName(fileName);
				for (const toolId of fileNameTools) {
					addTool(toolId);
				}
			}
		}

		return results;
	}

	/**
	 * 根据目录内容检测需要的工具
	 */
	private detectToolsFromDirectory(cwd: string): string[] {
		const tools: string[] = [];

		for (const rule of DIRECTORY_DETECTION_RULES) {
			try {
				if (rule.path.includes("*")) {
					// glob 模式匹配
					const ext = rule.path.replace("*", "");
					const files = fs.readdirSync(cwd);
					if (files.some((f) => f.endsWith(ext))) {
						tools.push(...rule.tools);
					}
				} else {
					const fullPath = path.join(cwd, rule.path);
					if (fs.existsSync(fullPath)) {
						const stat = fs.statSync(fullPath);
						if (rule.isDirectory === stat.isDirectory()) {
							tools.push(...rule.tools);
						}
					}
				}
			} catch {
				// 忽略读取错误
			}
		}

		return tools;
	}

	/**
	 * 根据文件名推断工具
	 */
	private inferToolsFromFileName(fileName: string): string[] {
		const fileNameMap: Record<string, string[]> = {
			dockerfile: ["docker"],
			"docker-compose.yml": ["docker"],
			"docker-compose.yaml": ["docker"],
			"compose.yml": ["docker"],
			"compose.yaml": ["docker"],
			".dockerignore": ["docker"],
			"package.json": ["node"],
			"package-lock.json": ["node"],
			"yarn.lock": ["node"],
			"pnpm-lock.yaml": ["node"],
			"requirements.txt": ["python"],
			"pyproject.toml": ["python"],
			"setup.py": ["python"],
			pipfile: ["python"],
			"pom.xml": ["java"],
			"build.gradle": ["java"],
			"build.gradle.kts": ["java"],
			"cargo.toml": ["rust"],
			"go.mod": ["go"],
			"go.sum": ["go"],
			makefile: ["bash"],
			// Shell-specific files
			".bashrc": ["bash"],
			".bash_profile": ["bash"],
			".profile": ["bash"],
			".zshrc": ["bash"],
		};

		return fileNameMap[fileName] || [];
	}

	/**
	 * 根据文件扩展名推断工具
	 */
	private inferToolsFromExtension(ext: string): string[] {
		const extMap: Record<string, string[]> = {
			".js": ["node"],
			".ts": ["node"],
			".jsx": ["node"],
			".tsx": ["node"],
			".py": ["python"],
			".java": ["java"],
			".cs": ["dotnet", "vs2022"],
			".rs": ["rust"],
			".go": ["go"],
			".sql": ["mysql", "postgresql", "sqlite"],
			".dockerfile": ["docker"],
			".yml": ["docker"],
			".yaml": ["docker"],
			// Shell scripts
			".sh": ["bash"],
			".bash": ["bash"],
			".ps1": ["powershell", "pwsh"],
			".bat": ["cmd"],
			".cmd": ["cmd"],
		};

		return extMap[ext] || [];
	}
}

/**
 * 获取匹配器实例
 */
export function createToolMatcher(registry: IToolRegistry): IToolMatcher {
	return new ToolMatcher(registry);
}
