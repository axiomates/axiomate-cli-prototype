/**
 * Tool Matcher
 * Matches appropriate tools based on user queries and context information
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
 * Keyword to tool ID mapping
 */
const KEYWORD_MAP: Record<string, string[]> = {
	// Version control
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

	// Runtimes
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

	// C++ and build tools
	cmake: ["cmake", "cmakelist", "cmakelists"],
	cpp: ["c++", "cpp", "g++", "clang++", "msvc"],

	// Tools
	beyondcompare: [
		"beyond compare",
		"beyondcompare",
		"bc4",
		"diff",
		"compare",
		"merge files",
		"file comparison",
	],
	vscode: ["vscode", "vs code", "visual studio code", "code"],
	vs2022: ["visual studio", "vs2022", "vs 2022"],
	docker: ["docker", "container", "dockerfile", "compose"],

	// Databases
	mysql: ["mysql", "mariadb"],
	postgresql: ["postgresql", "postgres", "psql"],
	sqlite3: ["sqlite", "sqlite3"],
};

/**
 * Capability to tool mapping
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
 * Windows: powershell, pwsh, cmd (for Windows system operations)
 * Unix/Linux/macOS: bash
 *
 * Note: Python is NOT a shell tool - it's a runtime/programming language.
 * Shell tools are for OS interaction, not file operations.
 */
function getDefaultShellTools(): string[] {
	if (platform() === "win32") {
		return ["powershell", "pwsh", "cmd"];
	}
	// Unix/Linux/macOS
	return ["bash"];
}

/**
 * Project type to tools mapping
 * - Shell tools are NOT included here (they are added dynamically in autoSelect)
 * - Python is included for file operations (better encoding support)
 * - vs2022 is only for .NET projects, not Java
 */
const PROJECT_TYPE_TOOLS: Record<ProjectType, string[]> = {
	node: ["node", "git"],
	python: ["python", "git"],
	java: ["java", "git", "gradle", "maven"],
	cpp: ["cmake", "git"],
	dotnet: ["dotnet", "git", "vs2022", "msbuild"],
	rust: ["rust", "git"],
	go: ["go", "git"],
	unknown: ["git"],
};

/**
 * Directory/file detection rules for autoSelect
 */
type DirectoryDetectionRule = {
	/** Path to detect (relative to cwd) */
	path: string;
	/** Whether it's a directory */
	isDirectory: boolean;
	/** Tool IDs to add when matched */
	tools: string[];
};

const DIRECTORY_DETECTION_RULES: DirectoryDetectionRule[] = [
	// Version control
	{ path: ".git", isDirectory: true, tools: ["git"] },
	{ path: ".svn", isDirectory: true, tools: ["svn"] },

	// Docker
	{ path: "Dockerfile", isDirectory: false, tools: ["docker"] },
	{ path: "docker-compose.yml", isDirectory: false, tools: ["docker"] },
	{ path: "docker-compose.yaml", isDirectory: false, tools: ["docker"] },
	{ path: "compose.yml", isDirectory: false, tools: ["docker"] },
	{ path: "compose.yaml", isDirectory: false, tools: ["docker"] },
	{ path: ".dockerignore", isDirectory: false, tools: ["docker"] },

	// Node.js ecosystem
	{ path: "node_modules", isDirectory: true, tools: ["node"] },
	{ path: "package-lock.json", isDirectory: false, tools: ["node"] },
	{ path: "yarn.lock", isDirectory: false, tools: ["node"] },
	{ path: "pnpm-lock.yaml", isDirectory: false, tools: ["node"] },
	{ path: "bun.lockb", isDirectory: false, tools: ["node"] },
	{ path: ".nvmrc", isDirectory: false, tools: ["node"] },
	{ path: ".node-version", isDirectory: false, tools: ["node"] },

	// Python ecosystem
	{ path: ".venv", isDirectory: true, tools: ["python"] },
	{ path: "venv", isDirectory: true, tools: ["python"] },
	{ path: ".python-version", isDirectory: false, tools: ["python"] },
	{ path: "Pipfile", isDirectory: false, tools: ["python"] },
	{ path: "Pipfile.lock", isDirectory: false, tools: ["python"] },
	{ path: "poetry.lock", isDirectory: false, tools: ["python"] },

	// Java/Gradle/Maven
	{ path: ".gradle", isDirectory: true, tools: ["java", "gradle"] },
	{ path: "gradlew", isDirectory: false, tools: ["java", "gradle"] },
	{ path: "mvnw", isDirectory: false, tools: ["java", "maven"] },
	{ path: ".mvn", isDirectory: true, tools: ["java", "maven"] },

	// C++ / CMake
	{ path: "CMakeLists.txt", isDirectory: false, tools: ["cmake"] },
	{ path: "CMakeCache.txt", isDirectory: false, tools: ["cmake"] },

	// Rust
	{ path: "Cargo.lock", isDirectory: false, tools: ["rust"] },
	{ path: "target", isDirectory: true, tools: ["rust"] },

	// Go
	{ path: "go.sum", isDirectory: false, tools: ["go"] },

	// .NET (vs2022 only for .NET projects)
	{ path: "bin", isDirectory: true, tools: ["dotnet"] },
	{ path: "obj", isDirectory: true, tools: ["dotnet"] },
	{ path: "*.csproj", isDirectory: false, tools: ["dotnet", "vs2022", "msbuild"] },
	{ path: "*.sln", isDirectory: false, tools: ["dotnet", "vs2022", "msbuild"] },

	// Databases
	{ path: "*.db", isDirectory: false, tools: ["sqlite3"] },
	{ path: "*.sqlite", isDirectory: false, tools: ["sqlite3"] },
	{ path: "*.sqlite3", isDirectory: false, tools: ["sqlite3"] },
];

/**
 * Detect project type from directory
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
		{ file: "CMakeLists.txt", type: "cpp" },
		{ file: "*.csproj", type: "dotnet" },
		{ file: "*.sln", type: "dotnet" },
		{ file: "Cargo.toml", type: "rust" },
		{ file: "go.mod", type: "go" },
	];

	for (const check of checks) {
		if (check.file.includes("*")) {
			// glob pattern
			const ext = check.file.replace("*", "");
			try {
				const files = fs.readdirSync(cwd);
				if (files.some((f) => f.endsWith(ext))) {
					return check.type;
				}
			} catch {
				// Ignore read errors
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
 * Tool matcher implementation
 */
export class ToolMatcher implements IToolMatcher {
	constructor(private registry: IToolRegistry) {}

	/**
	 * Match tools by query
	 */
	match(query: string, context?: MatchContext): MatchResult[] {
		const results: MatchResult[] = [];
		const queryLower = query.toLowerCase();
		const installedTools = this.registry.getInstalled();

		// 1. Keyword matching
		for (const [toolId, keywords] of Object.entries(KEYWORD_MAP)) {
			const matchedKeyword = keywords.find((kw) => queryLower.includes(kw));
			if (matchedKeyword) {
				const tool = this.registry.getTool(toolId);
				if (tool?.installed) {
					// Create match result for each action
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
							reason: `Keyword match: "${matchedKeyword}"`,
						});
					}
				}
			}
		}

		// 2. Capability matching
		for (const [desc, capability] of Object.entries(CAPABILITY_MAP)) {
			if (queryLower.includes(desc)) {
				const tools = this.registry.getByCapability(capability);
				for (const tool of tools) {
					if (!tool.installed) continue;
					// Avoid duplicates
					if (results.some((r) => r.tool.id === tool.id)) continue;

					for (const action of tool.actions) {
						results.push({
							tool,
							action,
							score: 0.6,
							reason: `Capability match: "${capability}"`,
						});
					}
				}
			}
		}

		// 3. Context-aware matching
		if (context) {
			const contextTools = this.autoSelect(context);
			for (const tool of contextTools) {
				// Avoid duplicates
				if (results.some((r) => r.tool.id === tool.id)) continue;

				for (const action of tool.actions) {
					results.push({
						tool,
						action,
						score: 0.4,
						reason: `Context recommendation (${context.projectType || "current directory"})`,
					});
				}
			}
		}

		// 4. Fuzzy matching by tool name/description
		for (const tool of installedTools) {
			// Avoid duplicates
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
						reason: "Name/description match",
					});
				}
			}
		}

		// Sort by score
		return results.sort((a, b) => b.score - a.score);
	}

	/**
	 * Calculate action match score
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
	 * Match tools by capability
	 */
	matchByCapability(capability: string): DiscoveredTool[] {
		const cap = CAPABILITY_MAP[capability.toLowerCase()];
		if (!cap) {
			return [];
		}
		return this.registry.getByCapability(cap).filter((t) => t.installed);
	}

	/**
	 * Auto-select tools based on project context
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

		// 1. Always add shell tools for OS interaction
		const shellTools = getDefaultShellTools();
		for (const toolId of shellTools) {
			addTool(toolId);
		}

		// 2. Always add Python if available (preferred for file operations due to better encoding support)
		addTool("python");

		// 3. Detect project type
		let projectType = context.projectType;
		if (!projectType && context.cwd) {
			projectType = detectProjectType(context.cwd);
		}

		// 4. Add project-specific tools
		if (projectType) {
			const projectTools = PROJECT_TYPE_TOOLS[projectType] || [];
			for (const toolId of projectTools) {
				addTool(toolId);
			}
		}

		// 5. Detect tools from directory contents (.git, Dockerfile, CMakeLists.txt, etc.)
		if (context.cwd) {
			const detectedTools = this.detectToolsFromDirectory(context.cwd);
			for (const toolId of detectedTools) {
				addTool(toolId);
			}
		}

		// 6. Infer tools from selected files
		if (context.selectedFiles) {
			for (const file of context.selectedFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					addTool(toolId);
				}

				// Detect special file names
				const fileName = path.basename(file).toLowerCase();
				const fileNameTools = this.inferToolsFromFileName(fileName);
				for (const toolId of fileNameTools) {
					addTool(toolId);
				}
			}
		}

		// 7. Infer tools from current files
		if (context.currentFiles) {
			for (const file of context.currentFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					addTool(toolId);
				}

				// Detect special file names
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
	 * Detect tools from directory contents
	 */
	private detectToolsFromDirectory(cwd: string): string[] {
		const tools: string[] = [];

		for (const rule of DIRECTORY_DETECTION_RULES) {
			try {
				if (rule.path.includes("*")) {
					// glob pattern matching
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
				// Ignore read errors
			}
		}

		return tools;
	}

	/**
	 * Infer tools from file name
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
			"pom.xml": ["java", "maven"],
			"build.gradle": ["java", "gradle"],
			"build.gradle.kts": ["java", "gradle"],
			"cmakelists.txt": ["cmake"],
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
	 * Infer tools from file extension
	 */
	private inferToolsFromExtension(ext: string): string[] {
		const extMap: Record<string, string[]> = {
			".js": ["node"],
			".ts": ["node"],
			".jsx": ["node"],
			".tsx": ["node"],
			".py": ["python"],
			".java": ["java"],
			".cs": ["dotnet", "vs2022", "msbuild"],
			".cpp": ["cmake"],
			".cc": ["cmake"],
			".cxx": ["cmake"],
			".c": ["cmake"],
			".h": ["cmake"],
			".hpp": ["cmake"],
			".rs": ["rust"],
			".go": ["go"],
			".sql": ["mysql", "postgresql", "sqlite3"],
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
 * Create tool matcher instance
 */
export function createToolMatcher(registry: IToolRegistry): IToolMatcher {
	return new ToolMatcher(registry);
}
