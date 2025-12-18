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

### Command Line Options

| Option          | Description                          |
| --------------- | ------------------------------------ |
| `-h, --help`    | Show help message and exit           |
| `-v, --verbose` | Enable verbose logging (trace level) |

## Slash Commands

Type `/` to open the slash command menu. Use arrow keys to navigate and Enter to select.

| Command    | Description                |
| ---------- | -------------------------- |
| `/model`   | Select AI model provider   |
| `/compact` | Summarize conversation     |
| `/help`    | Show available commands    |
| `/clear`   | Clear the screen           |
| `/version` | Show version information   |
| `/exit`    | Exit the application       |

Slash commands support nested hierarchy with colored path display:

```
/model
  ├── /openai (gpt-4o, gpt-4, gpt-4-turbo, gpt-3.5-turbo)
  ├── /qwen (qwen-72b, qwen-14b, qwen-7b)
  ├── /claude (claude-3-opus, claude-3-sonnet, claude-3-haiku)
  ├── /deepseek-v3
  └── /llama-3.3-70b
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

## Keyboard Shortcuts

| Shortcut     | Action                                           |
| ------------ | ------------------------------------------------ |
| `/`          | Open slash command menu                          |
| `@`          | Open file selection menu                         |
| `?`          | Show keyboard shortcuts (when input empty)       |
| `Tab`        | Accept autocomplete suggestion                   |
| `→`          | Accept one character from suggestion             |
| `←` / `→`    | Move cursor (skips over @file blocks)            |
| `↑` / `↓`    | Navigate history / command list / file list      |
| `Enter`      | Submit input or select menu item                 |
| `Ctrl+Enter` | Insert new line                                  |
| `Ctrl+A`     | Move cursor to line start                        |
| `Ctrl+E`     | Move cursor to line end                          |
| `Ctrl+U`     | Clear text before cursor                         |
| `Ctrl+K`     | Clear text after cursor                          |
| `Ctrl+C`     | Exit application                                 |
| `Escape`     | Clear suggestion / exit mode / close help        |

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

```
┌─────────────────────────────┐
│ Header                      │
├─────────────────────────────┤
│ MessageOutput               │  ← Scrollable message history
├─────────────────────────────┤
│ AutocompleteInput           │  ← Multi-line input with colors
├─────────────────────────────┤
│ Selection Panel             │  ← Mode-dependent content
│   - SlashMenu (/ commands)  │
│   - FileMenu  (@ files)     │
│   - HelpPanel (? help)      │
└─────────────────────────────┘
```

### Input System

The input system uses a **data-driven architecture** with `InputInstance` as the single source of truth:

```typescript
type InputInstance = {
  text: string;               // Raw text content
  cursor: number;             // Cursor position
  type: InputType;            // "message" | "command"
  segments: ColoredSegment[]; // Colored segments for rendering
  commandPath: string[];      // Command path array
  filePath: string[];         // Current file navigation path
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
│   │   ├── utils/             # lineProcessor
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
│   └── commandHandler.ts      # Command execution
├── hooks/
│   ├── useTerminalWidth.ts    # Terminal width hook
│   └── useTerminalHeight.ts   # Terminal height hook
└── utils/
    ├── config.ts              # User config (~/.axiomate.json)
    ├── appdata.ts             # App data (~/.axiomate/)
    ├── localsettings.ts       # Project settings (.axiomate/)
    ├── logger.ts              # Pino logger with rotation
    └── flags.ts               # CLI flags
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
- [esbuild](https://esbuild.github.io/) - Fast bundling
- [Bun](https://bun.sh/) - Standalone executable packaging (optional)

## License

MIT
