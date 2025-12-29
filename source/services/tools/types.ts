/**
 * 本地开发工具类型定义
 */

// 工具类别
export type ToolCategory =
	| "vcs" // 版本控制 (git, svn)
	| "runtime" // 运行时 (node, python, java)
	| "shell" // Shell (powershell, bash, cmd)
	| "diff" // 比较工具 (beyondcompare, winmerge)
	| "ide" // IDE (vs2022, vscode, idea)
	| "build" // 构建工具 (msbuild, cmake, gradle, maven)
	| "package" // 包管理 (npm, nvm, nuget, pip)
	| "container" // 容器 (docker, podman)
	| "database" // 数据库工具 (mysql, psql, sqlite3)
	| "web" // 网络工具 (web fetch)
	| "utility" // 通用工具 (file, plan)
	| "other";

// 工具能力
export type ToolCapability =
	| "execute" // 可执行命令
	| "read" // 读取文件
	| "write" // 写入文件
	| "diff" // 文件比较
	| "merge" // 文件合并
	| "edit" // 编辑文件
	| "build" // 构建项目
	| "debug" // 调试
	| "format" // 格式化代码
	| "lint"; // 代码检查

// 工具参数定义
export type ToolParameter = {
	name: string;
	description: string;
	type: "string" | "number" | "boolean" | "file" | "directory";
	required: boolean;
	default?: string | number | boolean;
};

// 工具动作定义
export type ToolAction = {
	name: string; // 动作名称，如 "diff", "commit", "push"
	description: string;
	parameters: ToolParameter[];
	// 命令模板，使用 {{param}} 占位符
	commandTemplate: string;
};

// 发现的本地工具
export type DiscoveredTool = {
	id: string; // 唯一标识，如 "git", "vs2022"
	name: string; // 显示名称
	description: string;
	category: ToolCategory;
	capabilities: ToolCapability[];
	executablePath: string; // 可执行文件路径（未安装时为空字符串）
	version?: string; // 版本号
	actions: ToolAction[];
	// 环境变量（执行时注入）
	env?: Record<string, string>;
	// 安装状态
	installed: boolean; // 是否已安装
	installHint?: string; // 未安装时的安装提示
};

// 工具定义（用于发现器返回未安装工具的元信息）
export type ToolDefinition = Omit<
	DiscoveredTool,
	"executablePath" | "version" | "installed"
>;

// 工具发现器接口
export type ToolDiscoverer = {
	id: string;
	name: string;
	// 检测工具是否存在
	detect: () => Promise<DiscoveredTool | null>;
};

// 工具注册表接口
export type IToolRegistry = {
	tools: Map<string, DiscoveredTool>;
	// 按类别获取工具
	getByCategory: (category: ToolCategory) => DiscoveredTool[];
	// 按能力获取工具
	getByCapability: (capability: ToolCapability) => DiscoveredTool[];
	// 获取所有工具
	getAll: () => DiscoveredTool[];
	// 获取已安装工具
	getInstalled: () => DiscoveredTool[];
	// 获取未安装工具
	getNotInstalled: () => DiscoveredTool[];
	// 获取单个工具
	getTool: (id: string) => DiscoveredTool | undefined;
	// 发现/刷新工具列表
	discover: () => Promise<void>;
};
