#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import Welcome from "./components/Welcome.js";
import { initAppData } from "./utils/appdata.js";
import { initConfig, isFirstTimeUser } from "./utils/config.js";
import { setFlags } from "./utils/flags.js";
import { initLocalSettings } from "./utils/localsettings.js";
import { initPlatform, clearScreen } from "./utils/platform.js";
import { initApp, type InitResult } from "./utils/init.js";
import { initI18n } from "./i18n/index.js";

// 清屏（跨平台）
clearScreen();

// 同步初始化（配置文件等）
initConfig();
initAppData();
initLocalSettings();
initPlatform(); // 平台相关初始化（Windows Terminal 配置等）
initI18n(); // 初始化 i18n（自动检测系统语言）

const cli = meow({
	importMeta: import.meta,
	autoHelp: false,
	autoVersion: false,
	flags: {
		help: {
			type: "boolean",
			shortFlag: "h",
		},
		verbose: {
			type: "boolean",
			shortFlag: "v",
		},
	},
});

// 设置命令行参数
setFlags(cli.flags);

// 如果用户请求帮助，输出帮助信息后退出
if (cli.flags.help) {
	console.log(`
axiomate - A terminal-based CLI application

Usage:
  axiomate [options]

Options:
  -h, --help       Show this help message and exit
  -v, --verbose    Enable verbose logging (trace level)
`);
	process.exit(0);
}

async function main() {
	// 快速初始化（内置工具 + AI 服务）
	let initResult: InitResult;
	try {
		initResult = await initApp();
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error(`Initialization failed: ${errorMsg}`);
		process.exit(1);
	}

	// 首次使用 → 欢迎页面
	if (isFirstTimeUser()) {
		// 等待 Welcome 完成配置后卸载
		await new Promise<void>((resolve) => {
			const welcomeInstance = render(
				<Welcome
					onComplete={() => {
						// 短暂延迟让用户看到 "完成" 状态
						setTimeout(() => {
							welcomeInstance.unmount();
							resolve();
						}, 500);
					}}
				/>,
			);
		});

		// Welcome 完成后，重新初始化 AI 服务（因为配置已更新）
		try {
			initResult = await initApp();
		} catch {
			// 忽略错误，继续启动（可能 AI 服务不可用）
		}

		// 清屏，清除 Welcome 残留
		clearScreen();
	}

	// 正常启动 App
	// 使用 incrementalRendering 减少滚动时的条纹问题
	const { waitUntilExit } = render(<App initResult={initResult} />, {
		patchConsole: true,
		incrementalRendering: true,
	});
	await waitUntilExit();
	clearScreen();
}

main();
