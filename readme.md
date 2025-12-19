# axiomate-cli

A terminal-based AI agent CLI application built with [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink), featuring a data-driven input system with hierarchical slash commands, multi-file selection, and intelligent history support.

## Features

- Interactive terminal UI with responsive layout
- **Data-driven input system** with `InputInstance` as single source of truth
- Auto-completion with async provider support
- **Hierarchical slash commands** with colored rendering (`/model → openai → gpt-4`)
- **Multi-file selection** with `@` trigger for quick file path insertion
- **Atomic file blocks**: `@path` treated as single units for cursor/deletion
- Command history with full state restoration (including colors and selected files)
- **Markdown rendering** in message output (via `marked` + `marked-terminal`)
- **Focus mode switching** - toggle between Input and Browse mode (`Shift+↑/↓`)
- **Scrollable message output** - scroll with `↑/↓` in Browse mode or `PageUp/PageDown`
- **Local development tools discovery** - auto-detects installed CLI tools
- **MCP Server** - exposes local tools via Model Context Protocol (in-process or standalone)
- Comprehensive keyboard shortcuts
- Cross-platform support (Windows, macOS, Linux)
- Structured logging with daily rotation

## Requirements

- Node.js >= 20
- Bun (optional, for building standalone executable)

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

Or run directly:

```bash
node dist/cli.js
```

### Standalone Executable

Build a standalone executable (requires [Bun](https://bun.sh)):

```bash
npm run package
```

Creates `bundle/axiomate-cli.exe` (Windows) or `bundle/axiomate-cli` (macOS/Linux).

#### Windows Terminal Integration

On Windows, the packaged exe automatically:

1. **Registers profile** in Windows Terminal's `settings.json`
2. **Uses exe as icon** - no separate .ico file needed
3. **Auto-restarts** when profile is updated (to apply icon)

To see the custom icon in Windows Terminal:

- Run `axiomate-cli.exe` once to register the profile
- The app will automatically restart in a new terminal window with the icon
- Or manually select "axiomate-cli" from Windows Terminal's dropdown menu

#### Cross-Platform Restart

When restart is needed, the app auto-detects the best available terminal:

| Priority | Terminal         | Availability        |
| -------- | ---------------- | ------------------- |
| 1        | Windows Terminal | Win10 1903+, manual |
| 2        | PowerShell       | Win7+, built-in     |
| 3        | CMD              | All Windows         |

On macOS/Linux, a new process is spawned directly.

### Command Line Options

| Option          | Description                          |
| --------------- | ------------------------------------ |
| `-h, --help`    | Show help message and exit           |
| `-v, --verbose` | Enable verbose logging (trace level) |

## Slash Commands

Type `/` to open the slash command menu. Use arrow keys to navigate and Enter to select.

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `/model`         | Select AI model provider       |
| `/tools`         | Manage local development tools |
| `/tools list`    | List all available tools       |
| `/tools refresh` | Rescan installed tools         |
| `/tools stats`   | Show tools statistics          |
| `/compact`       | Summarize conversation         |
| `/help`          | Show available commands        |
| `/clear`         | Clear the screen               |
| `/version`       | Show version information       |
| `/exit`          | Exit the application           |

Slash commands support nested hierarchy with colored path display:

```
/model
  ├── /openai (gpt-4o, gpt-4, gpt-4-turbo, gpt-3.5-turbo)
  ├── /qwen (qwen-72b, qwen-14b, qwen-7b)
  ├── /claude (claude-3-opus, claude-3-sonnet, claude-3-haiku)
  ├── /deepseek-v3
  └── /llama-3.3-70b
/tools
  ├── /list (list all available tools)
  ├── /refresh (rescan installed tools)
  └── /stats (show statistics)
```

## File Selection

Type `@` to open the file selection menu. Navigate directories and select files to insert their paths.

- `↑/↓` - Navigate files and folders
- `Enter` - Enter directory or select file
- `Escape` - Go back one level or exit
- Type to filter files by name
- Select `.` to choose current folder
- **Multi-file support**: Select multiple files (e.g., `analyze @src/a.ts and @src/b.ts`)

File paths are **atomic blocks**:

- Cursor skips over `@path` blocks when moving left/right
- Backspace/Delete removes the entire `@path` block at once

## Local Development Tools

axiomate-cli automatically discovers installed development tools on your system and exposes them for AI-assisted workflows.

### Supported Tools

| Category  | Tools                         |
| --------- | ----------------------------- |
| VCS       | Git                           |
| Runtime   | Node.js, NVM, Python, Java    |
| Shell     | PowerShell                    |
| IDE       | VS Code, Visual Studio 2022   |
| Diff      | Beyond Compare                |
| Container | Docker                        |
| Build     | CMake, MSBuild, Gradle, Maven |
| Database  | MySQL, PostgreSQL, SQLite     |

### Usage

Use `/tools list` to see all discovered tools:

```
## 已安装工具 (11)

### vcs
- **git** v2.43.0 - Git 版本控制系统 (C:\Program Files\Git\cmd\git.exe)
  - status: 查看仓库状态
  - diff: 查看变更
  - log: 查看提交历史
  - commit: 提交变更

### runtime
- **node** v20.10.0 - Node.js JavaScript 运行时 (C:\Program Files\nodejs\node.exe)
  - version: 查看版本
  - eval: 执行 JavaScript 代码
...
```

### MCP Server

The tool discovery system can be exposed as an MCP (Model Context Protocol) server for integration with AI assistants like Claude Desktop.

#### Standalone Mode

Run as a standalone MCP server via STDIO:

```bash
npm run mcp
# or
node dist/mcp-server.js
```

Configure in Claude Desktop's `claude_desktop_config.json`:

```json
{
	"mcpServers": {
		"axiomate-tools": {
			"command": "node",
			"args": ["path/to/axiomate-cli/dist/mcp-server.js"]
		}
	}
}
```

#### In-Process Mode

For programmatic use, the `InProcessMcpProvider` class provides direct tool access without JSON-RPC overhead:

```typescript
import { getToolRegistry } from "./services/tools/registry.js";
import { InProcessMcpProvider } from "./services/tools/mcp/inprocess.js";

const registry = getToolRegistry();
await registry.discover();

const provider = new InProcessMcpProvider(registry);
const tools = provider.listTools();
const result = await provider.callTool("git_status", {});
```

## Focus Modes

The app supports two focus modes for navigating between input and message viewing:

| Mode   | Description                        | How to Enter          |
| ------ | ---------------------------------- | --------------------- |
| Input  | Input active, ↑/↓ for history      | Default / `Shift+↑/↓` |
| Browse | Input hidden, ↑/↓ scrolls messages | `Shift+↑/↓`           |

Press `Shift+↑` or `Shift+↓` to toggle between modes. The current mode is shown in the header bar:

- **Input mode**: `[输入] Shift+↑↓ 切换` (gray)
- **Browse mode**: `[浏览] Shift+↑↓ 切换` (cyan, highlighted)

In Browse mode, the input area is hidden to maximize message viewing space.

## Keyboard Shortcuts

### Global

| Shortcut    | Action                               |
| ----------- | ------------------------------------ |
| `Shift+↑/↓` | Toggle between Input and Browse mode |
| `PageUp`    | Scroll messages up (both modes)      |
| `PageDown`  | Scroll messages down (both modes)    |
| `Ctrl+C`    | Exit application                     |

### Input Mode

| Shortcut     | Action                                      |
| ------------ | ------------------------------------------- |
| `/`          | Open slash command menu                     |
| `@`          | Open file selection menu                    |
| `?`          | Show keyboard shortcuts (when input empty)  |
| `Tab`        | Accept autocomplete suggestion              |
| `→`          | Accept one character from suggestion        |
| `←` / `→`    | Move cursor (skips over @file blocks)       |
| `↑` / `↓`    | Navigate history / command list / file list |
| `Enter`      | Submit input or select menu item            |
| `Ctrl+Enter` | Insert new line                             |
| `Ctrl+A`     | Move cursor to line start                   |
| `Ctrl+E`     | Move cursor to line end                     |
| `Ctrl+U`     | Clear text before cursor                    |
| `Ctrl+K`     | Clear text after cursor                     |
| `Escape`     | Clear suggestion / exit mode / close help   |

### Browse Mode

| Shortcut | Action               |
| -------- | -------------------- |
| `↑`      | Scroll messages up   |
| `↓`      | Scroll messages down |

## Development

```bash
npm run dev        # Watch mode
npm run build      # Build project
npm test           # Run tests
npm run test:watch # Tests in watch mode
npm run lint       # Lint code
npm run lint:fix   # Fix lint issues
npm run bundle     # Bundle with esbuild
npm run package    # Build standalone executable
```

## Architecture

### Application Layout

The layout changes based on focus mode:

**Input Mode** (default):

```
┌─────────────────────────────────────────────┐
│ Header                        [输入] Shift+↑↓│
├─────────────────────────────────────────────┤
│ MessageOutput               ← PageUp/PageDown│
├─────────────────────────────────────────────┤
│ AutocompleteInput           ← ↑/↓ for history│
├─────────────────────────────────────────────┤
│ Selection Panel             ← Mode-dependent │
│   - SlashMenu (/ commands)                  │
│   - FileMenu  (@ files)                     │
│   - HelpPanel (? help)                      │
└─────────────────────────────────────────────┘
```

**Browse Mode** (Shift+↑/↓ to toggle):

```
┌─────────────────────────────────────────────┐
│ Header                       [浏览] Shift+↑↓│
├─────────────────────────────────────────────┤
│ MessageOutput (expanded)    ← ↑/↓ to scroll │
│   - Input hidden for more space             │
└─────────────────────────────────────────────┘
```

### Input System

The input system uses a **data-driven architecture** with `InputInstance` as the single source of truth:

```typescript
type InputInstance = {
	text: string; // Raw text content
	cursor: number; // Cursor position
	type: InputType; // "message" | "command"
	segments: ColoredSegment[]; // Colored segments for rendering
	commandPath: string[]; // Command path array
	filePath: string[]; // Current file navigation path
	selectedFiles: SelectedFile[]; // Files selected via @ (with positions)
};
```

All user operations first update `InputInstance`, then rendering reads from it directly.

### Data Flow

```
User Action → dispatch(EditorAction) → Reducer updates EditorState
                                              ↓
                                    Updates InputInstance (segments, positions)
                                              ↓
                                    Render uses instance.segments
                                              ↓
                                    Submit → UserInput (message/command)
```

### UI Modes

| Mode      | Trigger   | Description                          |
| --------- | --------- | ------------------------------------ |
| `normal`  | Default   | Regular input with autocomplete      |
| `history` | `↑` / `↓` | Browse history (restores full state) |
| `slash`   | `/`       | Navigate hierarchical slash commands |
| `file`    | `@`       | Navigate file system for selection   |
| `help`    | `?`       | Display keyboard shortcuts           |

### Submit Callback

When user submits input, it's converted to a `UserInput` object:

```typescript
// Message input (includes selected files)
{
  type: "message",
  text: "analyze @src/app.ts",
  segments: [...],
  files: [{ path: "src/app.ts", isDirectory: false }]
}

// Command input
{
  type: "command",
  text: "/model → openai → gpt-4",
  segments: [...],
  commandPath: ["model", "openai", "gpt-4"]
}
```

## Project Structure

```
source/
├── cli.tsx                    # CLI entry point (meow)
├── app.tsx                    # Main application component
├── components/
│   ├── AutocompleteInput/     # Core input component
│   │   ├── index.tsx          # Main component
│   │   ├── types.ts           # EditorState, UIMode, EditorAction
│   │   ├── reducer.ts         # State machine (editorReducer)
│   │   ├── hooks/             # useAutocomplete, useInputHandler, useFileSelect
│   │   ├── utils/             # lineProcessor, heightCalculator
│   │   └── components/        # InputLine, SlashMenu, FileMenu, HelpPanel
│   ├── Divider.tsx            # Separator line
│   ├── Header.tsx             # Title bar
│   └── MessageOutput.tsx      # Message display area
├── models/
│   ├── input.ts               # UserInput type (submit callback)
│   ├── inputInstance.ts       # InputInstance (core data model)
│   └── richInput.ts           # ColoredSegment, ColorRange
├── constants/
│   ├── commands.ts            # Slash command definitions
│   ├── colors.ts              # Color constants
│   ├── platform.ts            # Cross-platform path separator
│   └── meta.ts                # Auto-generated version info
├── services/
│   ├── commandHandler.ts      # Command execution
│   └── tools/                 # Local tools discovery system
│       ├── types.ts           # Tool type definitions
│       ├── registry.ts        # ToolRegistry (discovery + lookup)
│       ├── executor.ts        # Tool command execution
│       ├── discoverers/       # Per-tool discovery modules
│       │   ├── base.ts        # Shared utilities (commandExists, etc.)
│       │   ├── git.ts, node.ts, python.ts, java.ts, ...
│       │   └── index.ts       # Export all discoverers
│       └── mcp/               # MCP Server integration
│           ├── server.ts      # MCP Server creation
│           ├── inprocess.ts   # In-process provider
│           └── stdio.ts       # STDIO transport
├── hooks/
│   ├── useTerminalWidth.ts    # Terminal width hook
│   └── useTerminalHeight.ts   # Terminal height hook
└── utils/
    ├── config.ts              # User config (~/.axiomate.json)
    ├── appdata.ts             # App data (~/.axiomate/)
    ├── localsettings.ts       # Project settings (.axiomate/)
    ├── logger.ts              # Pino logger with rotation
    ├── flags.ts               # CLI flags
    └── platform.ts            # Platform init (Windows Terminal config)
```

## Configuration

- `~/.axiomate.json` - User configuration
- `~/.axiomate/logs/` - Log files with daily rotation
- `.axiomate/localsettings.json` - Project-local settings

## Tech Stack

- [React 19](https://react.dev/) - UI framework
- [Ink 6](https://github.com/vadimdemedes/ink) - React for CLI
- [TypeScript 5.7](https://www.typescriptlang.org/) - Type safety
- [Vitest](https://vitest.dev/) - Testing framework
- [Meow 13](https://github.com/sindresorhus/meow) - CLI argument parsing
- [Pino](https://getpino.io/) - Structured logging
- [marked](https://marked.js.org/) + [marked-terminal](https://github.com/mikaelbr/marked-terminal) - Markdown rendering
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP Server
- [Zod](https://zod.dev/) - Schema validation
- [esbuild](https://esbuild.github.io/) - Fast bundling
- [Bun](https://bun.sh/) - Standalone executable packaging (optional)

## License

MIT
