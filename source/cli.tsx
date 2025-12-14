#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import { initConfig } from "./utils/config.js";
import { setFlags } from "./utils/flags.js";
import { initLocalSettings } from "./utils/localsettings.js";

// 启动时初始化配置
initConfig();
initLocalSettings();

const cli = meow({
	importMeta: import.meta,
	autoHelp: false,
	autoVersion: false,
	flags: {
		name: {
			type: "string",
		},
	},
});

// 设置命令行参数
setFlags(cli.flags);

const { waitUntilExit } = render(<App />);

// 退出时清屏
waitUntilExit().then(() => {
	process.stdout.write("\x1b[2J\x1b[H");
});
