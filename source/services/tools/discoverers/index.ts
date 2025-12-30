/**
 * 工具发现器索引
 * 导出所有工具发现函数
 */

import type { DiscoveredTool } from "../types.js";

// 导入所有发现器
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
import { detectWebFetch } from "./web.js";
import { detectFile } from "./file.js";
import { detectPlan } from "./plan.js";
import { detectAskUser } from "./ask_user.js";

// 导出基础工具函数
export * from "./base.js";

// 发现函数类型
type DiscoverFunction = () => Promise<DiscoveredTool>;

// 所有发现器列表
export const allDiscoverers: DiscoverFunction[] = [
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
	// Web
	detectWebFetch,
	// Utility
	detectFile,
	detectPlan,
	detectAskUser,
];

/**
 * 执行所有发现器，返回发现的工具列表
 */
export async function discoverAllTools(): Promise<DiscoveredTool[]> {
	const results = await Promise.all(allDiscoverers.map((fn) => fn()));
	return results;
}
