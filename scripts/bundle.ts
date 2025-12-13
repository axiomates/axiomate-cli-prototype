import * as esbuild from "esbuild";
import type { Plugin } from "esbuild";
import { readFileSync, writeFileSync } from "fs";

// 插件：将 react-devtools-core 替换为空模块
const ignoreDevtoolsPlugin: Plugin = {
	name: "ignore-devtools",
	setup(build) {
		build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
			path: "react-devtools-core",
			namespace: "ignore",
		}));
		build.onLoad({ filter: /.*/, namespace: "ignore" }, () => ({
			contents: "export default undefined;",
			loader: "js",
		}));
	},
};

// 构建 ESM 格式
await esbuild.build({
	entryPoints: ["source/cli.tsx"],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: "bundle/axiomate-cli.mjs",
	plugins: [ignoreDevtoolsPlugin],
	minify: true,
	sourcemap: false,
});

// 移除原有 shebang，添加新的 shebang 和 require polyfill
let bundleContent = readFileSync("bundle/axiomate-cli.mjs", "utf-8");
// 移除已有的 shebang
bundleContent = bundleContent.replace(/^#!.*\n?/, "");
const finalContent = `#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
${bundleContent}`;
writeFileSync("bundle/axiomate-cli.mjs", finalContent);
