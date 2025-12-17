# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

axiomate-cli is a terminal-based AI agent application built with React + Ink. It provides an interactive CLI interface with autocomplete, slash commands, file selection, and structured input handling using a data-driven architecture.

## Tech Stack

- **React 19** + **Ink 6** - Terminal UI framework
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** - Testing
- **ESLint + Prettier** - Code quality

## Build & Run Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode development
npm start          # Run the CLI
npm test           # Run tests
npm run lint       # Check code style
npm run lint:fix   # Auto-fix lint issues
npm run package    # Build standalone executable (requires Bun)
```

## Project Structure

```
source/
├── app.tsx                    # Main app component, handles UserInput routing
├── cli.tsx                    # Entry point, CLI argument parsing (meow)
├── components/
│   ├── AutocompleteInput/     # Core input component (modular structure)
│   │   ├── index.tsx          # Main component (composition layer)
│   │   ├── types.ts           # EditorState, UIMode, EditorAction, re-exports
│   │   ├── reducer.ts         # State machine reducer (editorReducer)
│   │   ├── hooks/
│   │   │   ├── useAutocomplete.ts  # Autocomplete logic
│   │   │   ├── useInputHandler.ts  # Keyboard input handling
│   │   │   └── useFileSelect.ts    # File system reading for @ selection
│   │   ├── utils/
│   │   │   └── lineProcessor.ts    # Line wrapping calculations
│   │   └── components/
│   │       ├── InputLine.tsx       # Input line rendering with colors
│   │       ├── SlashMenu.tsx       # Slash command menu
│   │       ├── FileMenu.tsx        # File selection menu (@ trigger)
│   │       └── HelpPanel.tsx       # Keyboard shortcuts help
│   ├── Divider.tsx            # Horizontal divider
│   ├── Header.tsx             # App header
│   └── MessageOutput.tsx      # Message display area
├── models/
│   ├── input.ts               # UserInput type (for submit callback)
│   ├── inputInstance.ts       # InputInstance - core input data model
│   └── richInput.ts           # ColoredSegment, ColorRange, color utils
├── constants/
│   ├── commands.ts            # Slash command definitions (SLASH_COMMANDS)
│   └── colors.ts              # Color constants (PATH_COLOR, FILE_AT_COLOR, etc.)
├── services/
│   └── commandHandler.ts      # Command execution logic
├── hooks/                     # React hooks (useTerminalWidth/Height)
├── utils/                     # Utilities (config, logger, appdata)
└── types/                     # .d.ts type declarations for untyped libs
```

## Application Layout

The application is divided into four vertical sections:

```
┌─────────────────────────────┐
│ Header (标题栏)              │
├─────────────────────────────┤
│ Output Area (输出区域)       │
├─────────────────────────────┤
│ Input Area (输入区域)        │
├─────────────────────────────┤
│ Selection List (选择列表)    │  ← Mode-dependent content
│   - SlashMenu (/ commands)  │
│   - FileMenu  (@ files)     │
│   - HelpPanel (? help)      │
└─────────────────────────────┘
```

## Key Architecture

### Data-Driven Input System

The input system uses a **data-driven architecture** where all user operations first update a unified `InputInstance` before rendering.

#### InputInstance (Core Data Model)

Defined in `models/inputInstance.ts`:

```typescript
type InputInstance = {
  text: string;              // Raw text content
  cursor: number;            // Cursor position (0-based)
  type: InputType;           // "message" | "command"
  segments: ColoredSegment[]; // Colored segments for rendering
  commandPath: string[];     // Command path (e.g., ["model", "openai"])
  filePath: string[];        // Current file navigation path (e.g., ["src", "components"])
  selectedFiles: SelectedFile[]; // Files selected via @ (with position tracking)
};

type SelectedFile = {
  path: string;              // Full file path (e.g., "assets/icon.ico")
  isDirectory: boolean;      // Is it a directory?
  atPosition: number;        // Position of @ in text (0-based)
  endPosition: number;       // End position of file path (exclusive)
};
```

Key functions:
- `createEmptyInstance()` - Create empty instance
- `createMessageInstance(text)` - Create message type
- `createCommandInstance(path, trailing)` - Create command type with colors
- `updateInstanceFromText(text, cursor, path, filePath)` - Update from text input
- `rebuildSegmentsWithFiles(text, selectedFiles)` - Rebuild colored segments with file highlighting
- `removeSelectedFile(text, file, selectedFiles)` - Remove a selected file (whole block deletion)

#### Data Flow

```
User Action → dispatch(EditorAction) → Reducer updates EditorState
                                              ↓
                                    Updates InputInstance (includes segments)
                                              ↓
                                    Render uses instance.segments directly
                                              ↓
                                    Submit converts to UserInput/HistoryEntry
```

#### InputInstance 唯一真相来源原则

**规则：InputInstance 是输入系统的唯一真相来源**

所有导致输入框内容变化的用户操作必须：
1. 首先更新内存中的 `InputInstance`
2. 然后基于 `InputInstance.segments` 进行渲染

这确保了：
- 历史记录存储 `HistoryEntry`（从 InputInstance 转换，去除 cursor）
- 从历史恢复时显示与原始输入完全一致（包括彩色分段）
- 不需要从文本重新解析来重建状态
- 多文件选择时位置信息始终准确

**禁止**从文本解析创建显示状态 - 始终从 `InputInstance` 派生。

### Editor State

Defined in `AutocompleteInput/types.ts`:

```typescript
type EditorState = {
  instance: InputInstance;    // Current input data (single source of truth)
  uiMode: UIMode;            // UI mode state
  suggestion: string | null; // Autocomplete suggestion
};

type UIMode =
  | { type: "normal" }
  | { type: "history"; index: number; savedEntry: HistoryEntry }
  | { type: "slash"; selectedIndex: number }
  | { type: "file"; selectedIndex: number; prefix: string; suffix: string; atPosition: number }
  | { type: "help" };
```

### UI Modes

| Mode      | Trigger | Description                          |
| --------- | ------- | ------------------------------------ |
| `normal`  | default | Regular input with autocomplete      |
| `history` | ↑/↓     | Browse command history (restores full HistoryEntry) |
| `slash`   | `/`     | Navigate hierarchical commands       |
| `file`    | `@`     | Navigate file system for selection   |
| `help`    | `?`     | Display shortcuts overlay            |

### File Selection System

File selection is triggered by `@` and supports:
- **Multi-file selection**: Select multiple files in a single input (e.g., `请分析 @src/a.ts 和 @src/b.ts`)
- **Position tracking**: Each selected file tracks its position in text via `atPosition` and `endPosition`
- **Whole block operations**: Cursor movement and deletion treat `@path` as atomic units
- **Prefix/Suffix preservation**: Text before and after `@` is preserved during selection

#### File Mode State

```typescript
type FileUIMode = {
  type: "file";
  selectedIndex: number;  // Currently highlighted item in FileMenu
  prefix: string;         // Text before @ (preserved during selection)
  suffix: string;         // Text after cursor when @ was typed (restored on exit)
  atPosition: number;     // Position where @ was inserted
};
```

#### File Selection Flow

```
User types @ at position N
    ↓
ENTER_FILE action:
  - prefix = text[0..N], suffix = text[N..]
  - instance.text = prefix + "@"
  - uiMode = { type: "file", prefix, suffix, atPosition: N }
    ↓
useFileSelect reads current directory (instance.filePath)
    ↓
User navigates with ↑/↓, filters by typing
    ↓
ENTER_FILE_DIR: Enter subdirectory
  - instance.filePath.push(dirName)
  - instance.text = prefix + "@path\"
    ↓
CONFIRM_FILE: Select file
  - newSelectedFile = { path, atPosition, endPosition }
  - instance.text = prefix + "@path" + suffix
  - instance.selectedFiles.push(newSelectedFile)
  - Update positions of files in suffix
  - Rebuild segments with file colors
  - Exit to normal mode
```

#### Cursor and Deletion Behavior

When `selectedFiles` exist:
- **Left/Right Arrow**: Skip over `@path` blocks (cursor jumps to start/end)
- **Backspace at file end**: Delete entire `@path` block
- **Delete at file start**: Delete entire `@path` block
- **Backspace/Delete inside file**: Delete entire `@path` block (defensive)

### History System

- Stores `HistoryEntry[]` (InputInstance without cursor)
- Deduplication based on `text` field
- `?` input not stored in history
- Up/down navigation restores all properties including colored segments and selectedFiles

```typescript
type HistoryEntry = {
  text: string;
  type: InputType;
  segments: ColoredSegment[];
  commandPath: string[];
  filePath: string[];
  selectedFiles: SelectedFile[];
};

// Conversion functions
toHistoryEntry(instance: InputInstance): HistoryEntry  // Remove cursor
fromHistoryEntry(entry: HistoryEntry): InputInstance   // Set cursor to text.length
```

### UserInput (Submit Callback)

For the `onSubmit` callback, InputInstance is converted to `UserInput`:

```typescript
type UserInput = MessageInput | CommandInput;

type MessageInput = {
  type: "message";
  text: string;                    // Raw text
  segments: ColoredSegment[];      // For display
  files: { path: string; isDirectory: boolean }[];  // Selected files
};

type CommandInput = {
  type: "command";
  text: string;                    // Raw text (e.g., "/model → openai")
  segments: ColoredSegment[];      // For display
  commandPath: string[];           // Parsed path (e.g., ["model", "openai"])
};
```

### Rendering System

#### Color Rendering Pipeline

```
InputInstance.segments (ColoredSegment[])
    ↓
segmentsToRanges() → ColorRange[]
    ↓
InputLine receives colorRanges
    ↓
renderWithColorRanges() applies colors to text
    ↓
CursorLineContent handles cursor position with colors
```

#### ColoredSegment vs ColorRange

```typescript
// Storage format (in InputInstance)
type ColoredSegment = { text: string; color?: string };

// Rendering format (position-based)
type ColorRange = { start: number; end: number; color?: string };
```

#### Color Constants

Defined in `constants/colors.ts`:
- `PATH_COLOR = "#ffd700"` - Command path / directory name (gold)
- `ARROW_COLOR = "gray"` - Arrow separator / backslash
- `FILE_AT_COLOR = "#87ceeb"` - @ symbol in file paths (light blue)

### Slash Commands

Slash commands support nested hierarchy defined in `constants/commands.ts`:

```typescript
type SlashCommand = {
  name: string;
  description?: string;
  children?: SlashCommand[];  // Nested subcommands
  action?: CommandAction;     // Command behavior (leaf nodes)
};

type CommandAction =
  | { type: "internal"; handler?: string }  // Internal handler
  | { type: "prompt"; template: string }    // Convert to AI prompt
  | { type: "config"; key: string };        // Configuration change
```

Example: `/model → openai → gpt-4` with path `["model", "openai", "gpt-4"]`

### Component Communication

```
AutocompleteInput
    │
    ├── onSubmit(UserInput)  → App handles message/command routing
    ├── onClear()            → App clears messages
    └── onExit()             → App exits
```

## Code Conventions

- Use `useMemo` for derived values that are dependencies of other hooks
- Use `useCallback` for event handlers
- Prefer `if/else` over ternary expressions for statements (ESLint rule)
- Types go in `models/` folder, `.d.ts` declarations go in `types/`
- Chinese comments are acceptable in this codebase

## Common Tasks

### Adding a new slash command

1. Add to `SLASH_COMMANDS` in `constants/commands.ts` with appropriate `action`:
   - `{ type: "internal", handler: "handlerName" }` - for internal commands
   - `{ type: "prompt", template: "..." }` - for AI prompt commands
   - `{ type: "config", key: "configKey" }` - for configuration commands
2. For internal commands, add handler function in `services/commandHandler.ts` `internalHandlers` registry

### Adding a new UI mode

1. Extend `UIMode` type in `AutocompleteInput/types.ts`
2. Add corresponding `EditorAction` types in `types.ts`
3. Update `editorReducer` in `reducer.ts` to handle transitions
4. Add mode detection helper in `types.ts` (e.g., `isNewMode()`)
5. Handle keyboard events in `hooks/useInputHandler.ts`
6. Create selection menu component in `components/` if needed
7. Add hook for data fetching if needed (e.g., `useFileSelect.ts`)
8. Integrate in `AutocompleteInput/index.tsx`

### Modifying input handling

- Keyboard logic: `AutocompleteInput/hooks/useInputHandler.ts`
- Autocomplete logic: `AutocompleteInput/hooks/useAutocomplete.ts`
- File selection: `AutocompleteInput/hooks/useFileSelect.ts`
- State transitions: `AutocompleteInput/reducer.ts`
- Command execution: `services/commandHandler.ts`
- Submit handling: `App.tsx` `handleSubmit` callback
- Input data model: `models/inputInstance.ts`

### Key EditorAction Types

| Action | Description |
|--------|-------------|
| `SET_TEXT` | Update text and cursor, auto-detect mode, update selectedFiles positions |
| `SET_CURSOR` | Move cursor position |
| `ENTER_HISTORY` | Enter history mode, save current entry |
| `NAVIGATE_HISTORY` | Navigate history, restore entry |
| `EXIT_HISTORY` | Exit history, restore saved entry |
| `ENTER_SLASH_LEVEL` | Enter next command level (has children) |
| `SELECT_FINAL_COMMAND` | Select leaf command (no children) |
| `EXIT_SLASH_LEVEL` | Go back one level or exit slash mode |
| `ENTER_FILE` | Enter file selection mode (save prefix/suffix) |
| `SELECT_FILE` | Navigate file list (change selectedIndex) |
| `ENTER_FILE_DIR` | Enter subdirectory (update filePath) |
| `CONFIRM_FILE` | Select file, add to selectedFiles, rebuild segments |
| `CONFIRM_FOLDER` | Select current folder (`.` entry) |
| `EXIT_FILE` | Go back one level or exit file mode |
| `EXIT_FILE_KEEP_AT` | Exit file mode but keep `@` and path text |
| `REMOVE_SELECTED_FILE` | Delete a selected file block entirely |
| `TOGGLE_HELP` | Toggle help panel |
| `RESET` | Reset to initial state |

### Platform-Specific Notes

**Windows Backspace Handling**: On Windows terminals, the backspace key may trigger `key.delete` instead of `key.backspace`. The input handler detects this by checking `inputChar` (backspace produces `""`, `"\b"`, or `"\x7f"`).
