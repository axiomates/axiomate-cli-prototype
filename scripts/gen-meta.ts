/**
 * 构建时生成应用元信息文件
 * 从 package.json 读取信息，写入 source/constants/meta.ts
 * 从 .env.local 读取 API keys，写入 source/constants/modelPresets.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

// ============ 生成 meta.ts ============
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const metaContent = `// 此文件由 scripts/gen-meta.ts 自动生成，请勿手动修改
export const VERSION = "${pkg.version}";
export const APP_NAME = "${pkg.name}";
`;

writeFileSync("source/constants/meta.ts", metaContent);
console.log(`Generated meta.ts: ${pkg.name} v${pkg.version}`);

// ============ 生成 modelPresets.ts ============
// 读取 .env.local 文件
function loadEnvFile(filePath: string): Record<string, string> {
	const env: Record<string, string> = {};
	if (!existsSync(filePath)) {
		return env;
	}
	const content = readFileSync(filePath, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex > 0) {
			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed.slice(eqIndex + 1).trim();
			env[key] = value;
		}
	}
	return env;
}

// 读取并处理模型预设
const localEnv = loadEnvFile(".env.local");

// 读取 JSON 模板
const modelPresetsJson = JSON.parse(
	readFileSync("assets/model-presets.json", "utf-8"),
);

// 替换占位符的映射
const placeholderMap: Record<string, string> = {
	"{{SILICONFLOW_API_KEY}}": localEnv["SILICONFLOW_API_KEY"] || "",
	"{{DASHSCOPE_API_KEY}}": localEnv["DASHSCOPE_API_KEY"] || "",
	"{{ANTHROPIC_API_KEY}}": localEnv["ANTHROPIC_API_KEY"] || "",
};

// 转换 JSON 为 TypeScript 代码
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToTypeScript(obj: any, indent = 1): string {
	const tab = "\t".repeat(indent);
	const prevTab = "\t".repeat(indent - 1);

	if (Array.isArray(obj)) {
		const items = obj
			.map((item) => `${tab}${jsonToTypeScript(item, indent + 1)}`)
			.join(",\n");
		return `[\n${items},\n${prevTab}]`;
	}

	if (typeof obj === "object" && obj !== null) {
		const entries = Object.entries(obj)
			.map(([key, value]) => {
				const tsValue = jsonToTypeScript(value, indent + 1);
				return `${tab}${key}: ${tsValue}`;
			})
			.join(",\n");
		return `{\n${entries},\n${prevTab}}`;
	}

	if (typeof obj === "string") {
		// 替换占位符
		let result = obj;
		for (const [placeholder, value] of Object.entries(placeholderMap)) {
			result = result.replace(placeholder, value);
		}
		return `"${result}"`;
	}

	return JSON.stringify(obj);
}

const presetsContent = `// 此文件由 scripts/gen-meta.ts 自动生成，请勿手动修改
// 模型配置模板位于 assets/model-presets.json
// API keys 从 .env.local 读取，该文件不会提交到 git

import type { ModelConfig } from "../utils/config.js";

/**
 * 默认模型预设列表（测试期间使用）
 *
 * 包含完整的模型配置，包括 baseUrl 和 apiKey
 * 每个模型可以有不同的 API 端点和密钥
 * 正式版本会根据用户账号派发可用的模型配置
 */
export const DEFAULT_MODEL_PRESETS: ModelConfig[] = ${jsonToTypeScript(modelPresetsJson, 1)};
`;

writeFileSync("source/constants/modelPresets.ts", presetsContent);

const hasKeys = {
	siliconflow: !!placeholderMap["{{SILICONFLOW_API_KEY}}"],
	anthropic: !!placeholderMap["{{ANTHROPIC_API_KEY}}"],
	dashscope: !!placeholderMap["{{DASHSCOPE_API_KEY}}"],
};

console.log(
	`Generated modelPresets.ts with ${hasKeys.siliconflow ? "SiliconFlow" : "no"}, ${hasKeys.anthropic ? "Anthropic" : "no"}, and ${hasKeys.dashscope ? "DashScope" : "no"} API keys`,
);
