#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import Splash from "./components/Splash.js";
import Welcome from "./components/Welcome.js";
import { initAppData } from "./utils/appdata.js";
import { initConfig, isFirstTimeUser } from "./utils/config.js";
import { setFlags } from "./utils/flags.js";
import { initLocalSettings } from "./utils/localsettings.js";
import { initPlatform } from "./utils/platform.js";
import { initApp, type InitResult } from "./utils/init.js";
import { pauseInput } from "./utils/stdin.js";
import { initI18n, t } from "./i18n/index.js";

// 暂停 stdin，Splash 阶段不接受任何输入
pauseInput();

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

// 两阶段渲染：先显示 Splash，初始化完成后切换到 App
async function main() {
	// 阶段 1: 渲染 Splash
	let currentMessage = t("splash.loading");
	const splashInstance = render(<Splash message={currentMessage} />);

	// 异步初始化，更新进度
	let initResult: InitResult;
	try {
		initResult = await initApp((progress) => {
			currentMessage = progress.message;
			splashInstance.rerender(<Splash message={currentMessage} />);
		});
	} catch (error) {
		// 初始化失败时显示错误并退出
		const errorMsg = error instanceof Error ? error.message : String(error);
		splashInstance.rerender(<Splash message={`Error: ${errorMsg}`} />);
		await new Promise((resolve) => setTimeout(resolve, 2000));
		splashInstance.unmount();
		process.exit(1);
	}

	// 阶段 2: 卸载 Splash
	splashInstance.unmount();

	// 阶段 3: 根据配置状态决定渲染 Welcome 或 App
	if (isFirstTimeUser()) {
		// 首次使用 → 欢迎页面
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
	}

	// 正常启动 App
	const { waitUntilExit } = render(<App initResult={initResult} />);
	await waitUntilExit();
	process.stdout.write("\x1b[2J\x1b[H");
}

main();
