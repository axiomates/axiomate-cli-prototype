# axiomate-cli

A terminal-based CLI application built with [Ink](https://github.com/vadimdemedes/ink) and React, featuring a data-driven input system with slash commands, multi-file selection, and history support.

## Features

- Interactive terminal UI with fixed layout (Header, Output, Input, Selection List)
- **Data-driven input system** with `InputInstance` as single source of truth
- Auto-completion support with async provider
- Hierarchical slash commands with colored rendering (`/model → openai → gpt-4`)
- **Multi-file selection** with `@` trigger for quick file path insertion
- Command history with full state restoration (including colors and selected files)
- Keyboard shortcuts (Ctrl+C, Ctrl+U, Ctrl+K, etc.)
- Responsive layout that adapts to terminal size

## Requirements

- Node.js >= 20
- Bun (optional, for building standalone executable)

## Install

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

This creates `bundle/axiomate-cli.exe` (Windows) or `bundle/axiomate-cli` (macOS/Linux).

### Command Line Options

| Option          | Description                          |
| --------------- | ------------------------------------ |
| `-h, --help`    | Show help message and exit           |
| `-v, --verbose` | Enable verbose logging (trace level) |

Example:

```bash
# Show help information
axiomate --help
axiomate -h

# Run with verbose logging
axiomate --verbose
axiomate -v
```

## Commands

Type commands directly or use slash commands:

| Command         | Description              |
| --------------- | ------------------------ |
| `help`          | Show available commands  |
| `clear`         | Clear the screen         |
| `exit` / `quit` | Exit the application     |
| `version`       | Show version information |

### Slash Commands

Type `/` to see available slash commands. Use arrow keys to select and Enter to execute.

| Slash Command | Description              |
| ------------- | ------------------------ |
| `/help`       | Show available commands  |
| `/clear`      | Clear the screen         |
| `/exit`       | Exit the application     |
| `/version`    | Show version information |

Slash commands support nested hierarchy (e.g., `/model → openai → gpt-4`) with colored path display.

### File Selection

Type `@` to open the file selection menu. Navigate directories and select files to insert their paths into your input.

- Use `↑/↓` to navigate files and folders
- Press `Enter` to enter a directory or select a file
- Press `Escape` to go back one level or exit file mode
- Type to filter files by name
- Select `.` to choose the current folder
- **Multi-file support**: Select multiple files in a single input (e.g., `请分析 @src/a.ts 和 @src/b.ts`)

File paths are treated as atomic blocks:
- Cursor skips over `@path` blocks when moving left/right
- Backspace/Delete removes the entire `@path` block at once

## Keyboard Shortcuts

| Shortcut     | Action                                             |
| ------------ | -------------------------------------------------- |
| `/`          | Open slash command menu                            |
| `@`          | Open file selection menu                           |
| `Tab`        | Accept autocomplete suggestion                     |
| `→`          | Accept one character from suggestion               |
| `←` / `→`    | Move cursor left/right (skips over @file blocks)   |
| `↑` / `↓`    | Navigate history / command list / file list        |
| `Ctrl+Enter` | Insert new line                                    |
| `Ctrl+A`     | Move cursor to line start                          |
| `Ctrl+E`     | Move cursor to line end                            |
| `Ctrl+U`     | Clear text before cursor                           |
| `Ctrl+K`     | Clear text after cursor                            |
| `Ctrl+C`     | Exit application                                   |
| `Escape`     | Clear suggestion / exit current mode / close help  |
| `?`          | Show keyboard shortcuts help (when input is empty) |

## Development

```bash
# Watch mode for development
npm run dev

# Build project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Build standalone executable
npm run package
```

## Architecture

### Application Layout

```
┌─────────────────────────────┐
│ Header                      │
├─────────────────────────────┤
│ Output Area                 │
├─────────────────────────────┤
│ Input Area                  │
├─────────────────────────────┤
│ Selection List              │  ← Changes based on mode
│   - SlashMenu (/ commands)  │
│   - FileMenu  (@ files)     │
│   - HelpPanel (? help)      │
└─────────────────────────────┘
```

### Input System

The input system uses a **data-driven architecture** with a unified `InputInstance` model as the single source of truth:

```typescript
type InputInstance = {
  text: string;              // Raw text content
  cursor: number;            // Cursor position
  type: InputType;           // "message" | "command"
  segments: ColoredSegment[]; // Colored segments for rendering
  commandPath: string[];     // Command path array
  filePath: string[];        // Current file navigation path
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
                                    Submit → UserInput / HistoryEntry
```

### UI Modes

| Mode      | Trigger   | Description                                  |
| --------- | --------- | -------------------------------------------- |
| `normal`  | Default   | Regular input with autocomplete              |
| `history` | `↑` / `↓` | Browse history (restores full state)         |
| `slash`   | `/`       | Navigate hierarchical slash commands         |
| `file`    | `@`       | Navigate file system for selection           |
| `help`    | `?`       | Display keyboard shortcuts (overlay)         |

### File Selection System

- **Multi-file support**: Select multiple files in one input
- **Position tracking**: Each `@path` tracks its position via `atPosition` and `endPosition`
- **Atomic operations**: Cursor movement and deletion treat `@path` as single units
- **Color rendering**: `@` in light blue, path in gold

### History System

- Stores `HistoryEntry` objects (InputInstance without cursor)
- Restores complete state including colors and selected files
- Deduplication based on text content
- `?` input not stored in history

### Submit Callback

When user submits input, it's converted to a `UserInput` object:

```typescript
// Message input (includes selected files)
{
  type: "message",
  text: "请分析 @src/app.ts",
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
├── app.tsx                    # Main application component
├── cli.tsx                    # CLI entry point
├── constants/
│   ├── commands.ts            # Slash command definitions
│   └── colors.ts              # Color constants
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
└── hooks/
    ├── useTerminalHeight.ts   # Terminal height hook
    └── useTerminalWidth.ts    # Terminal width hook
```

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [React](https://react.dev/) - UI framework
- [meow](https://github.com/sindresorhus/meow) - CLI argument parsing
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vitest](https://vitest.dev/) - Testing framework
- [Bun](https://bun.sh/) - Standalone executable packaging (optional)
