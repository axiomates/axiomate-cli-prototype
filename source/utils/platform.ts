/**
 * 平台相关初始化
 *
 * 处理平台特定的配置和行为：
 * - Windows Terminal profile 自动配置
 * - 跨平台重启功能（保留供其他地方使用）
 *
 * 注意：所有命令检测使用异步 spawn 以避免阻塞事件循环
 */

import { spawn } from "child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { platform } from "os";
import { join } from "path";

// ============================================================================
// Windows Terminal 配置
// ============================================================================

const TERMINAL_SETTINGS_PATHS = [
	// 稳定版 (Microsoft Store)
	join(
		process.env.LOCALAPPDATA || "",
		"Packages",
		"Microsoft.WindowsTerminal_8wekyb3d8bbwe",
		"LocalState",
		"settings.json",
	),
	// 预览版 (Microsoft Store)
	join(
		process.env.LOCALAPPDATA || "",
		"Packages",
		"Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe",
		"LocalState",
		"settings.json",
	),
	// 未打包版本 (scoop, chocolatey, etc.)
	join(
		process.env.LOCALAPPDATA || "",
		"Microsoft",
		"Windows Terminal",
		"settings.json",
	),
];

const PROFILE_GUID = "{a010a7e0-c110-4a99-b07b-9f0f11e00000}";
const PROFILE_NAME = "axiomate";

// 旧版本使用的无效 GUID，用于迁移
const LEGACY_GUIDS = [
	"{a]x1om4te-c1i0-4app-b0th-pr0f1leguid0}",
	"{ax10ma7e-c110-4a99-b07b-9f0f11e00000}",
];

type TerminalProfile = {
	guid: string;
	name: string;
	commandline: string;
	icon: string;
	hidden?: boolean;
	[key: string]: unknown;
};

type TerminalSettings = {
	profiles?: {
		list?: TerminalProfile[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

// ============================================================================
// 跨平台重启功能
// ============================================================================

type WindowsTerminal = "wt" | "powershell" | "cmd";

/**
 * 检测命令是否存在（异步版本，使用 spawn 避免阻塞事件循环）
 */
function commandExists(cmd: string): Promise<boolean> {
	return new Promise((resolve) => {
		const command = platform() === "win32" ? "where" : "which";
		const child = spawn(command, [cmd], { stdio: "pipe" });
		child.on("close", (code) => resolve(code === 0));
		child.on("error", () => resolve(false));
	});
}

/**
 * 检测 Windows 可用的终端（按优先级，异步）
 * 优先级：Windows Terminal > PowerShell > CMD
 */
async function detectWindowsTerminal(): Promise<WindowsTerminal> {
	if (await commandExists("wt.exe")) {
		return "wt";
	}
	if (await commandExists("powershell.exe")) {
		return "powershell";
	}
	return "cmd";
}

/**
 * 转义 PowerShell 字符串参数
 */
function escapePowerShellArg(arg: string): string {
	// 用单引号包裹，内部的单引号用两个单引号转义
	return `'${arg.replace(/'/g, "''")}'`;
}

/**
 * 转义 CMD 字符串参数
 */
function escapeCmdArg(arg: string): string {
	// 如果包含空格或特殊字符，用双引号包裹
	if (/[\s&|<>^"]/.test(arg)) {
		return `"${arg.replace(/"/g, '""')}"`;
	}
	return arg;
}

/**
 * 检测是否是 Bun 打包的 exe 运行环境
 *
 * Bun 打包的 exe 运行时：
 *   - process.execPath = 实际 exe 路径 (如 C:\...\axiomate.exe)
 *   - process.argv = ["bun", "B:/~BUN/root/xxx.exe", ...userArgs]
 */
function isBunPackagedExe(): boolean {
	return (
		process.argv[0] === "bun" &&
		typeof process.argv[1] === "string" &&
		process.argv[1].startsWith("B:/~BUN/")
	);
}

/**
 * 获取重启所需的参数
 *
 * Bun 打包 exe：argv = ["bun", "B:/~BUN/...", ...userArgs] → slice(2)
 * Node 运行：argv = ["node路径", "脚本路径", ...userArgs] → slice(1)
 */
function getRestartArgs(): string[] {
	return isBunPackagedExe() ? process.argv.slice(2) : process.argv.slice(1);
}

/**
 * 启动子进程并等待其退出
 *
 * 对于 launcher 类型的进程（如 wt.exe），等待它退出意味着
 * 它已经成功启动了目标程序
 */
function spawnAndWaitExit(
	cmd: string,
	args: string[],
	options: Parameters<typeof spawn>[2],
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, args, options);

		child.on("close", () => {
			resolve();
		});

		child.on("error", reject);
	});
}

/**
 * Windows 平台重启（异步，等待子进程启动后退出）
 */
async function restartWindows(): Promise<never> {
	const cwd = process.cwd();
	const exePath = process.execPath;
	const args = getRestartArgs();
	const terminal = await detectWindowsTerminal();

	switch (terminal) {
		case "wt":
			// Windows Terminal: wt.exe -d <cwd> <exe> <args...>
			await spawnAndWaitExit("wt.exe", ["-d", cwd, exePath, ...args], {
				detached: true,
				stdio: "ignore",
			});
			break;

		case "powershell": {
			// PowerShell: Start-Process 启动新窗口
			const psArgs = args.map(escapePowerShellArg).join(", ");
			const psCommand = psArgs
				? `Start-Process -FilePath ${escapePowerShellArg(exePath)} -ArgumentList ${psArgs} -WorkingDirectory ${escapePowerShellArg(cwd)}`
				: `Start-Process -FilePath ${escapePowerShellArg(exePath)} -WorkingDirectory ${escapePowerShellArg(cwd)}`;
			await spawnAndWaitExit("powershell.exe", ["-Command", psCommand], {
				detached: true,
				stdio: "ignore",
				windowsHide: true,
			});
			break;
		}

		case "cmd": {
			// CMD: start 命令启动新窗口
			const cmdArgs = [exePath, ...args].map(escapeCmdArg).join(" ");
			const cmdCommand = `start "" /D "${cwd}" ${cmdArgs}`;
			await spawnAndWaitExit("cmd.exe", ["/C", cmdCommand], {
				detached: true,
				stdio: "ignore",
				windowsHide: true,
			});
			break;
		}
	}

	process.exit(0);
}

/**
 * Unix 平台重启（macOS / Linux）
 */
async function restartUnix(): Promise<never> {
	const cwd = process.cwd();
	const exePath = process.execPath;
	const args = process.argv.slice(1);

	// 直接 spawn 新进程替换当前进程
	await spawnAndWaitExit(exePath, args, {
		cwd,
		stdio: "inherit",
		detached: true,
	});

	process.exit(0);
}

// ============================================================================
// 内部辅助函数
// ============================================================================

function isPackagedExe(): boolean {
	return (
		!process.execPath.endsWith("node.exe") && !process.execPath.endsWith("node")
	);
}

function findSettingsPath(): string | null {
	for (const path of TERMINAL_SETTINGS_PATHS) {
		if (existsSync(path)) {
			return path;
		}
	}
	return null;
}

function parseJsonWithComments(content: string): TerminalSettings {
	// 移除单行注释 // ...
	const noSingleLineComments = content.replace(/^\s*\/\/.*$/gm, "");
	// 移除行尾注释 (小心不要移除 URL 中的 //)
	const noTrailingComments = noSingleLineComments.replace(
		/([^:])\/\/.*$/gm,
		"$1",
	);
	// 移除多行注释 /* ... */
	const noComments = noTrailingComments.replace(/\/\*[\s\S]*?\*\//g, "");
	// 移除尾随逗号 (JSON5 风格)
	const noTrailingCommas = noComments.replace(/,(\s*[}\]])/g, "$1");

	return JSON.parse(noTrailingCommas);
}

function isProfileUpToDate(profile: TerminalProfile, exePath: string): boolean {
	return (
		profile.guid === PROFILE_GUID &&
		profile.commandline === exePath &&
		profile.icon === exePath // icon 使用 exe 路径
	);
}

/**
 * 确保 Windows Terminal profile 配置正确
 * @returns true 如果配置被更新，后续需要重启
 */
function ensureWindowsTerminalProfile(): boolean {
	const settingsPath = findSettingsPath();
	if (!settingsPath) {
		return false;
	}

	try {
		const content = readFileSync(settingsPath, "utf-8");
		const settings = parseJsonWithComments(content);

		// 确保 profiles.list 存在
		if (!settings.profiles) {
			settings.profiles = { list: [] };
		}
		if (!settings.profiles.list) {
			settings.profiles.list = [];
		}
		const profileList = settings.profiles.list;

		const exePath = process.execPath;

		// 查找现有 profile（包括旧版本的无效 GUID）
		const existingProfile = profileList.find(
			(p) =>
				p.guid === PROFILE_GUID ||
				p.name === PROFILE_NAME ||
				LEGACY_GUIDS.includes(p.guid),
		);

		// 如果已存在且配置正确，无需更新
		if (existingProfile && isProfileUpToDate(existingProfile, exePath)) {
			return false;
		}

		// 需要添加或更新
		const newProfile: TerminalProfile = {
			guid: PROFILE_GUID,
			name: PROFILE_NAME,
			commandline: exePath,
			icon: exePath,
		};

		if (existingProfile) {
			const index = profileList.indexOf(existingProfile);
			profileList[index] = { ...existingProfile, ...newProfile };
		} else {
			profileList.push(newProfile);
		}

		// 备份并写入
		copyFileSync(settingsPath, settingsPath + ".backup");
		writeFileSync(settingsPath, JSON.stringify(settings, null, 4), "utf-8");

		return true;
	} catch {
		return false;
	}
}

// 存储重启 Promise，确保只执行一次
let restartPromise: Promise<never> | null = null;

/**
 * 跨平台重启应用（保持工作目录和命令行参数）
 *
 * Windows: 自动检测最佳终端（wt.exe > powershell.exe > cmd.exe）
 * macOS/Linux: 直接 spawn 新进程
 *
 * 注意：此函数为异步函数，等待子进程启动后执行 process.exit(0)
 * 注意：此函数只会执行一次，重复调用返回同一个 Promise
 */
export function restartApp(): Promise<never> {
	if (restartPromise) {
		return restartPromise;
	}

	restartPromise = platform() === "win32" ? restartWindows() : restartUnix();

	return restartPromise;
}

// ============================================================================
// 跨平台清屏
// ============================================================================

/**
 * 清屏（跨平台）
 *
 * 使用 ANSI 转义序列，在 Windows、macOS、Linux 上都能正常工作
 * - \x1b[2J - 清除整个屏幕
 * - \x1b[3J - 清除滚动缓冲区（scrollback buffer）
 * - \x1b[H - 将光标移动到左上角 (0,0)
 *
 * 注意：顺序很重要，先清屏再清滚动缓冲区
 */
export function clearScreen(): void {
	process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 平台初始化
 *
 * 在 Windows 上：
 * - 自动配置 Windows Terminal profile（如果需要）
 *
 * 在其他平台上：
 * - 无操作
 *
 * @returns true 如果配置被更新，后续需要重启
 * 注意：此函数不再自动重启，配置更新后需要用户手动重启才能生效
 * 如需重启，可使用 restartApp() 函数
 */
export function initPlatform(): boolean {
	// 仅 Windows 打包后的 exe 执行
	if (platform() !== "win32" || !isPackagedExe()) {
		return false;
	}

	// 更新配置
	return ensureWindowsTerminalProfile();
}
