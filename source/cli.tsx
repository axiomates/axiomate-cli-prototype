#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

export type CliFlags = {
	name: string | undefined;
};

const cli = meow(
	`
	Usage
	  $ axiomate-cli

	Options
	  --name  Your name

	Examples
	  $ axiomate-cli --name=Jane
	  Hello, Jane
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: "string",
			},
		},
	},
);

// 保留参数结构供后续使用
const flags: CliFlags = cli.flags;

const { waitUntilExit } = render(<App flags={flags} />);

// 退出时清屏
waitUntilExit().then(() => {
	process.stdout.write("\x1b[2J\x1b[H");
});
