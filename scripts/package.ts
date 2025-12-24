/**
 * 使用 Bun 将应用打包为独立可执行文件
 *
 * 依赖: 需要安装 Bun (https://bun.sh)
 * 用法: npm run package
 *
 * 打包流程:
 * 1. 先使用 esbuild 构建单文件 bundle (复用现有 bundle 逻辑)
 * 2. 使用 Bun 将 bundle 编译为原生可执行文件
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { platform } from "os";
import { join } from "path";

// 检查 Bun 是否已安装
function checkBunInstalled(): boolean {
	try {
		execSync("bun --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// 获取输出文件名
function getOutputFilename(): string {
	const os = platform();
	const baseName = "axiomate";

	if (os === "win32") {
		return `${baseName}.exe`;
	}

	return baseName;
}

// 主流程
async function main() {
	console.log("📦 开始打包 axiomate...\n");

	// 1. 检查 Bun
	if (!checkBunInstalled()) {
		console.error("❌ 错误: 未检测到 Bun");
		console.error("   请先安装 Bun: https://bun.sh");
		console.error('   Windows: powershell -c "irm bun.sh/install.ps1 | iex"');
		console.error("   macOS/Linux: curl -fsSL https://bun.sh/install | bash");
		process.exit(1);
	}

	console.log("✓ Bun 已安装");

	// 2. 确保 bundle 目录存在
	if (!existsSync("bundle")) {
		mkdirSync("bundle", { recursive: true });
	}

	// 3. 运行 esbuild bundle
	console.log("✓ 正在构建 bundle...");
	execSync("npm run bundle", { stdio: "inherit" });

	// 4. 为 Bun 创建入口文件 (Bun 需要不同的 shebang 处理)
	const bundlePath = join("bundle", "axiomate.mjs");
	const bunEntryPath = join("bundle", "axiomate-bun.mjs");

	let bundleContent = readFileSync(bundlePath, "utf-8");
	// 移除 shebang (Bun 编译后不需要)
	bundleContent = bundleContent.replace(/^#!.*\n?/, "");
	// 移除 createRequire polyfill (Bun 原生支持)
	bundleContent = bundleContent.replace(
		/import\s*\{\s*createRequire\s*\}\s*from\s*["']module["'];\s*\n?/,
		"",
	);
	bundleContent = bundleContent.replace(
		/const\s+require\s*=\s*createRequire\(import\.meta\.url\);\s*\n?/,
		"",
	);
	writeFileSync(bunEntryPath, bundleContent);

	// 5. 使用 Bun 编译为可执行文件
	const outputFilename = getOutputFilename();
	const outputPath = join("bundle", outputFilename);

	console.log(`✓ 正在编译为可执行文件: ${outputFilename}...`);

	const args = [
		"build",
		bunEntryPath,
		"--compile",
		"--minify",
		"--outfile",
		outputPath,
	];

	// Windows 专用: 设置图标
	if (platform() === "win32") {
		args.push("--windows-icon=assets/icon.ico");
	}

	const result = spawnSync("bun", args, { stdio: "inherit" });

	if (result.status !== 0) {
		console.error("❌ Bun 编译失败");
		process.exit(1);
	}

	console.log(`\n✅ 打包完成!`);
	console.log(`   输出文件: ${outputPath}`);
	console.log(`\n   运行方式: ./${outputPath}`);
}

main().catch((err) => {
	console.error("打包失败:", err);
	process.exit(1);
});
