#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import { initAppData } from "./utils/appdata.js";
import { initConfig } from "./utils/config.js";
import { setFlags } from "./utils/flags.js";
import { initLocalSettings } from "./utils/localsettings.js";

// 启动时初始化配置
initConfig();
initAppData();
initLocalSettings();

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
axiomate-cli - A terminal-based CLI application

Usage:
  axiomate [options]

Options:
  -h, --help       Show this help message and exit
  -v, --verbose    Enable verbose logging (trace level)
`);
	process.exit(0);
}

const { waitUntilExit } = render(<App />);

// 退出时清屏
waitUntilExit().then(() => {
	process.stdout.write("\x1b[2J\x1b[H");
});
