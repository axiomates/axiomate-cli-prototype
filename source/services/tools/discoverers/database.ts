/**
 * Database tool discoverer (mysql, psql, sqlite3)
 */

import type { DiscoveredTool, ToolDefinition } from "../types.js";
import {
	commandExists,
	getExecutablePath,
	getVersion,
	createInstalledTool,
	createNotInstalledTool,
} from "./base.js";

// MySQL client definition
const mysqlDefinition: ToolDefinition = {
	id: "a-mysql",
	name: "MySQL Client",
	description: "MySQL command-line client",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "connect",
			description: "Connect to MySQL server",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: false,
				},
			],
			commandTemplate:
				"mysql -h {{host}} -u {{user}} {{database ? database : ''}} -p",
		},
		{
			name: "execute",
			description: "Execute SQL statement",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: true,
				},
				{
					name: "sql",
					description: "SQL statement",
					type: "string",
					required: true,
				},
			],
			commandTemplate:
				'mysql -h {{host}} -u {{user}} {{database}} -e "{{sql}}" -p',
		},
		{
			name: "dump",
			description: "Export database",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: true,
				},
				{
					name: "output",
					description: "Output file",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'mysqldump -h {{host}} -u {{user}} {{database}} -p > "{{output}}"',
		},
	],
	installHint: "Download MySQL from https://dev.mysql.com/downloads/mysql/",
};

// PostgreSQL client definition
const psqlDefinition: ToolDefinition = {
	id: "a-psql",
	name: "PostgreSQL Client",
	description: "PostgreSQL command-line client",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "connect",
			description: "Connect to PostgreSQL server",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: false,
					default: "postgres",
				},
			],
			commandTemplate: "psql -h {{host}} -U {{user}} {{database}}",
		},
		{
			name: "execute",
			description: "Execute SQL statement",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: true,
				},
				{
					name: "sql",
					description: "SQL statement",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'psql -h {{host}} -U {{user}} {{database}} -c "{{sql}}"',
		},
		{
			name: "dump",
			description: "Export database",
			parameters: [
				{
					name: "host",
					description: "Host address",
					type: "string",
					required: false,
					default: "localhost",
				},
				{
					name: "user",
					description: "Username",
					type: "string",
					required: true,
				},
				{
					name: "database",
					description: "Database name",
					type: "string",
					required: true,
				},
				{
					name: "output",
					description: "Output file",
					type: "file",
					required: true,
				},
			],
			commandTemplate:
				'pg_dump -h {{host}} -U {{user}} {{database}} > "{{output}}"',
		},
	],
	installHint: "Download PostgreSQL from https://www.postgresql.org/download/",
};

// SQLite definition
const sqliteDefinition: ToolDefinition = {
	id: "a-sqlite3",
	name: "SQLite",
	description: "SQLite command-line tool",
	category: "database",
	capabilities: ["execute"],
	actions: [
		{
			name: "open",
			description: "Open or create database",
			parameters: [
				{
					name: "database",
					description: "Database file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}"',
		},
		{
			name: "execute",
			description: "Execute SQL statement",
			parameters: [
				{
					name: "database",
					description: "Database file path",
					type: "file",
					required: true,
				},
				{
					name: "sql",
					description: "SQL statement",
					type: "string",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" "{{sql}}"',
		},
		{
			name: "dump",
			description: "Export database",
			parameters: [
				{
					name: "database",
					description: "Database file path",
					type: "file",
					required: true,
				},
				{
					name: "output",
					description: "Output file",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" .dump > "{{output}}"',
		},
		{
			name: "tables",
			description: "List all tables",
			parameters: [
				{
					name: "database",
					description: "Database file path",
					type: "file",
					required: true,
				},
			],
			commandTemplate: 'sqlite3 "{{database}}" ".tables"',
		},
	],
	installHint: "Download from https://www.sqlite.org/download.html",
};

export async function detectMysql(): Promise<DiscoveredTool> {
	if (!(await commandExists("mysql"))) {
		return createNotInstalledTool(mysqlDefinition);
	}

	const execPath = await getExecutablePath("mysql");
	const version = await getVersion("mysql", ["--version"], {
		parseOutput: (output) => {
			// "mysql Ver 8.0.35" or "mysql Ver 5.7.44"
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
