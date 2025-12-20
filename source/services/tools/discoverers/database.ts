/**
 * 数据库工具发现器 (mysql, psql, sqlite3)
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// MySQL 客户端定义
const mysqlDefinition: ToolDefinition = {
	id: "mysql",
	name: "MySQL Client",
	description: "MySQL 命令行客户端",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "connect",
			description: "连接到 MySQL 服务器",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"mysql -h {{host}} -u {{user}} {{database ? database : ''}} -p",
		},
		{
			name: "execute",
			description: "执行 SQL 语句",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: true,
				},
				{
					name: "sql",
					description: "SQL 语句",
					type: "string",
					required: true,
				},
			],
			commandTemplate:
				'mysql -h {{host}} -u {{user}} {{database}} -e "{{sql}}" -p',
		},
		{
			name: "dump",
			description: "导出数据库",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: true,
				},
				{
					name: "output",
					description: "输出文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'mysqldump -h {{host}} -u {{user}} {{database}} -p > "{{output}}"',
		},
	],
	installHint: "从 https://dev.mysql.com/downloads/mysql/ 下载安装 MySQL",
};

// PostgreSQL 客户端定义
const psqlDefinition: ToolDefinition = {
	id: "psql",
	name: "PostgreSQL Client",
	description: "PostgreSQL 命令行客户端",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "connect",
			description: "连接到 PostgreSQL 服务器",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: false,
					default: "postgres",
				},
			],
			commandTemplate: "psql -h {{host}} -U {{user}} {{database}}",
		},
		{
			name: "execute",
			description: "执行 SQL 语句",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: true,
				},
				{
					name: "sql",
					description: "SQL 语句",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'psql -h {{host}} -U {{user}} {{database}} -c "{{sql}}"',
		},
		{
			name: "dump",
			description: "导出数据库",
			parameters: [
				{
					name: "host",
					description: "主机地址",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "用户名",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "数据库名",
					type: "string",
					required: true,
				},
				{
					name: "output",
					description: "输出文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'pg_dump -h {{host}} -U {{user}} {{database}} > "{{output}}"',
		},
	],
	installHint: "从 https://www.postgresql.org/download/ 下载安装 PostgreSQL",
};

// SQLite 定义
const sqliteDefinition: ToolDefinition = {
	id: "sqlite3",
	name: "SQLite",
	description: "SQLite 命令行工具",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "open",
			description: "打开或创建数据库",
			parameters: [
				{
					name: "database",
					description: "数据库文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}"',
		},
		{
			name: "execute",
			description: "执行 SQL 语句",
			parameters: [
				{
					name: "database",
					description: "数据库文件路径",
					type: "file",
					required: true,
				},
				{
					name: "sql",
					description: "SQL 语句",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" "{{sql}}"',
		},
		{
			name: "dump",
			description: "导出数据库",
			parameters: [
				{
					name: "database",
					description: "数据库文件路径",
					type: "file",
					required: true,
				},
				{
					name: "output",
					description: "输出文件",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" .dump > "{{output}}"',
		},
		{
			name: "tables",
			description: "列出所有表",
			parameters: [
				{
					name: "database",
					description: "数据库文件路径",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" ".tables"',
		},
	],
	installHint: "从 https://www.sqlite.org/download.html 下载安装",
};

export async function detectMysql(): Promise<DiscoveredTool> {
	if (!(await commandExists("mysql"))) {
		return createNotInstalledTool(mysqlDefinition);
	}

	const execPath = await getExecutablePath("mysql");
	const version = await getVersion("mysql", ["--version"], {
		parseOutput: (output) => {
			// "mysql Ver 8.0.35" 或 "mysql Ver 5.7.44"
			const match = output.match(/Ver (\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		mysqlDefinition,
		execPath || "mysql",
		version || undefined,
	);
}

export async function detectPsql(): Promise<DiscoveredTool> {
	if (!(await commandExists("psql"))) {
		return createNotInstalledTool(psqlDefinition);
	}

	const execPath = await getExecutablePath("psql");
	const version = await getVersion("psql", ["--version"], {
		parseOutput: (output) => {
			// "psql (PostgreSQL) 16.1"
			const match = output.match(/\(PostgreSQL\) (\d+\.\d+(?:\.\d+)?)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		psqlDefinition,
		execPath || "psql",
		version || undefined,
	);
}

export async function detectSqlite(): Promise<DiscoveredTool> {
	if (!(await commandExists("sqlite3"))) {
		return createNotInstalledTool(sqliteDefinition);
	}

	const execPath = await getExecutablePath("sqlite3");
	const version = await getVersion("sqlite3", ["--version"], {
		parseOutput: (output) => {
			// "3.44.2 2023-11-24 ..."
			const match = output.match(/^(\d+\.\d+\.\d+)/);
			return match ? match[1] : output;
		},
	});

	return createInstalledTool(
		sqliteDefinition,
		execPath || "sqlite3",
		version || undefined,
	);
}
