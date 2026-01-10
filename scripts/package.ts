/**
 * 使用 Bun 将应用打包为独立可执行文件
 *
 * 依赖: 需要安装 Bun (https://bun.sh)
 * 用法:
 *   npm run package              # 打包当前平台
 *   npm run package -- --all     # 打包所有平台 (交叉编译)
 *   npm run package -- --mac     # 只打包 macOS (Intel + Apple Silicon)
 *   npm run package -- --windows # 只打包 Windows
 *   npm run package -- --linux   # 只打包 Linux
 *
 * 打包流程:
 * 1. 先使用 esbuild 构建单文件 bundle (复用现有 bundle 逻辑)
 * 2. 使用 Bun 将 bundle 编译为原生可执行文件
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { platform } from "os";
import { join } from "path";

// 支持的目标平台
type Target =
	| "bun-darwin-arm64"
	| "bun-darwin-x64"
	| "bun-linux-x64"
	| "bun-linux-arm64"
	| "bun-windows-x64";

interface TargetInfo {
	target: Target;
	filename: string;
	description: string;
}

const TARGETS: Record<string, TargetInfo[]> = {
	mac: [
		{
			target: "bun-darwin-arm64",
			filename: "axiomate-mac-arm64",
			description: "macOS Apple Silicon (M1/M2/M3)",
		},
		{
			target: "bun-darwin-x64",
			filename: "axiomate-mac-x64",
			description: "macOS Intel",
		},
	],
	windows: [
		{
			target: "bun-windows-x64",
			filename: "axiomate.exe",
			description: "Windows x64",
		},
	],
	linux: [
		{
			target: "bun-linux-x64",
			filename: "axiomate-linux-x64",
			description: "Linux x64",
		},
		{
			target: "bun-linux-arm64",
			filename: "axiomate-linux-arm64",
			description: "Linux ARM64",
		},
	],
};

// 检查 Bun 是否已安装
function checkBunInstalled(): boolean {
	try {
		execSync("bun --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// 获取当前平台的目标
function getCurrentPlatformTargets(): TargetInfo[] {
	const os = platform();
	if (os === "darwin") return TARGETS.mac;
	if (os === "win32") return TARGETS.windows;
	return TARGETS.linux;
}

// 解析命令行参数
function parseArgs(): TargetInfo[] {
	const args = process.argv.slice(2);

	if (args.includes("--all")) {
		return [...TARGETS.mac, ...TARGETS.windows, ...TARGETS.linux];
	}
	if (args.includes("--mac")) {
		return TARGETS.mac;
	}
	if (args.includes("--windows")) {
		return TARGETS.windows;
	}
	if (args.includes("--linux")) {
		return TARGETS.linux;
	}

	// 默认：当前平台
	return getCurrentPlatformTargets();
}

// 编译单个目标
function compileTarget(bunEntryPath: string, targetInfo: TargetInfo): boolean {
	const outputPath = join("bundle", targetInfo.filename);
	console.log(`  → ${targetInfo.description} (${targetInfo.filename})...`);

	const args = [
		"build",
		bunEntryPath,
		"--compile",
		"--minify",
		"--target",
		targetInfo.target,
		"--outfile",
		outputPath,
	];

	// Windows 专用: 设置图标
	if (targetInfo.target === "bun-windows-x64") {
		args.push("--windows-icon=assets/icon.ico");
	}

	const result = spawnSync("bun", args, { stdio: "inherit" });
	return result.status === 0;
}

// 主流程
async function main() {
	const targets = parseArgs();

	console.log("📦 开始打包 axiomate...\n");
	console.log(`   目标平台: ${targets.map((t) => t.description).join(", ")}\n`);

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

	// 5. 编译所有目标平台
	console.log("✓ 正在编译可执行文件...\n");

	const results: { target: TargetInfo; success: boolean }[] = [];

	for (const target of targets) {
		const success = compileTarget(bunEntryPath, target);
		results.push({ target, success });
	}

	// 6. 输出结果
	console.log("\n" + "=".repeat(50));
	console.log("📋 打包结果:\n");

	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	for (const { target } of successful) {
		console.log(`   ✅ ${target.description}`);
		console.log(`      → bundle/${target.filename}`);
	}

	for (const { target } of failed) {
		console.log(`   ❌ ${target.description} - 编译失败`);
	}

	console.log("\n" + "=".repeat(50));

	if (failed.length > 0) {
		console.error(`\n⚠️  ${failed.length}/${results.length} 个目标编译失败`);
		process.exit(1);
	}

	console.log(`\n✅ 全部 ${successful.length} 个目标打包成功!`);
}

main().catch((err) => {
	console.error("打包失败:", err);
	process.exit(1);
});
