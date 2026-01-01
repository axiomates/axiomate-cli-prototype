import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.{ts,tsx}"],
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["source/**/*.{ts,tsx}"],
			exclude: [
				"source/**/*.d.ts",
				"dist/**/*",
				"scripts/**/*",
				"**/node_modules/**",
				// 入口文件（需要集成测试，不适合单元测试）
				"source/cli.tsx",
				"source/mcp-server.ts",
				// 自动生成的文件（包含敏感信息如 API keys）
				"source/constants/modelPresets.ts",
				"source/constants/meta.ts",
				// 纯类型定义文件
				"source/**/types.ts",
				"source/i18n/types.ts",
				"source/services/ai/types.ts",
				"source/services/tools/types.ts",
				// 纯导出的索引文件
				"source/services/ai/adapters/index.ts",
				"source/services/ai/clients/index.ts",
				// 复杂 UI 组件（需要 E2E 测试，用户交互难以模拟）
				"source/app.tsx",
			],
			reportsDirectory: "./coverage",
			// 配置 v8 正确处理 TS 源文件
			processingConcurrency: 1,
		},
	},
	esbuild: {
		jsx: "automatic",
		sourcemap: true,
	},
});
