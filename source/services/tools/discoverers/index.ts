/**
 * 工具发现器索引
 * 导出所有工具发现函数
 *
 * 分为两类：
 * - 内置工具 (builtin): 不需要检测，同步返回，启动时立即可用
 * - 可发现工具 (discoverable): 需要检测外部命令，后台异步发现
 */

import type { DiscoveredTool } from "../types.js";

// 导入内置工具发现器（实际上是同步的，只是接口统一用 async）
import { detectWebFetch } from "./web.js";
import { detectFile } from "./file.js";
import { detectPlan, detectEnterPlan } from "./plan.js";
import { detectAskUser } from "./ask_user.js";

// 导入可发现工具发现器（需要检测外部命令）
import { detectGit } from "./git.js";
import { detectNode, detectNvm, detectNpm } from "./node.js";
import { detectPython } from "./python.js";
import { detectJava, detectJavac } from "./java.js";
import { detectPowershell, detectPwsh } from "./powershell.js";
import { detectBash } from "./bash.js";
import { detectCmd } from "./cmd.js";
import { detectVscode } from "./vscode.js";
import { detectVisualStudio, detectMsbuild } from "./visualstudio.js";
import { detectBeyondCompare } from "./beyondcompare.js";
import { detectDocker, detectDockerCompose } from "./docker.js";
import { detectCmake, detectGradle, detectMaven } from "./build.js";
import { detectMysql, detectPsql, detectSqlite } from "./database.js";

// 导出基础工具函数
export * from "./base.js";

// 发现函数类型
type DiscoverFunction = () => Promise<DiscoveredTool>;

/**
 * 内置工具发现器列表
 * 这些工具不依赖外部命令，可以同步获取
 */
export const builtinDiscoverers: DiscoverFunction[] = [
	detectWebFetch,
	detectFile,
	detectPlan,
	detectEnterPlan,
	detectAskUser,
];

/**
 * 可发现工具发现器列表
 * 这些工具需要检测外部命令是否存在，耗时较长
 */
export const discoverableDiscoverers: DiscoverFunction[] = [
	// 版本控制
	detectGit,
	// 运行时
	detectNode,
	detectPython,
	detectJava,
	detectJavac,
	// 包管理
	detectNvm,
	detectNpm,
	// Shell
	detectPowershell,
	detectPwsh,
	detectBash,
	detectCmd,
	// IDE
	detectVscode,
	detectVisualStudio,
	// 比较工具
	detectBeyondCompare,
	// 容器
	detectDocker,
	detectDockerCompose,
	// 构建工具
	detectCmake,
	detectMsbuild,
	detectGradle,
	detectMaven,
	// 数据库
	detectMysql,
	detectPsql,
	detectSqlite,
];

/**
 * 获取内置工具（同步，瞬间完成）
 */
export async function getBuiltinTools(): Promise<DiscoveredTool[]> {
	const results = await Promise.all(builtinDiscoverers.map((fn) => fn()));
	return results;
}

/**
 * 执行可发现工具的发现（异步，可能较慢）
 */
export async function discoverExternalTools(): Promise<DiscoveredTool[]> {
	const results = await Promise.all(discoverableDiscoverers.map((fn) => fn()));
	return results;
}

/**
 * 执行所有发现器，返回发现的工具列表
 * @deprecated 使用 getBuiltinTools() + discoverExternalTools() 代替
 */
export async function discoverAllTools(): Promise<DiscoveredTool[]> {
	const [builtin, external] = await Promise.all([
		getBuiltinTools(),
		discoverExternalTools(),
	]);
	return [...builtin, ...external];
}
