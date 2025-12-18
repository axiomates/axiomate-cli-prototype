# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

axiomate-cli is a terminal-based AI agent application built with React 19 + Ink 6. It provides an interactive CLI interface with autocomplete, hierarchical slash commands, multi-file selection, and structured input handling using a data-driven architecture.

## Tech Stack

- **React 19** + **Ink 6** - Terminal UI framework
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** + **ink-testing-library** - Testing
- **ESLint + Prettier** - Code quality
- **Pino** + **pino-roll** - Structured logging with daily rotation
- **Meow 13** - CLI argument parsing
- **esbuild** - Bundling for standalone executable

## Build & Run Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run dev        # Watch mode development
npm start          # Run the CLI (node dist/cli.js)
npm test           # Run tests (vitest run)
npm run test:watch # Run tests in watch mode
npm run lint       # Check code style (ESLint + Prettier)
npm run lint:fix   # Auto-fix lint issues
npm run bundle     # Bundle with esbuild
npm run package    # Build standalone executable (requires Bun)
```

## Project Structure

```
source/
├── cli.tsx                    # Entry point, CLI argument parsing (meow)
├── app.tsx                    # Main app component, UserInput routing
├── components/
│   ├── AutocompleteInput/     # Core input component (modular architecture)
│   │   ├── index.tsx          # Main component (composition + rendering)
│   │   ├── types.ts           # EditorState, UIMode, EditorAction, re-exports
│   │   ├── reducer.ts         # State machine reducer (editorReducer)
│   │   ├── hooks/
│   │   │   ├── useAutocomplete.ts  # Autocomplete suggestions
│   │   │   ├── useInputHandler.ts  # Keyboard event handling
│   │   │   └── useFileSelect.ts    # File system reading for @ selection
│   │   ├── utils/
│   │   │   └── lineProcessor.ts    # Line wrapping & cursor calculation
│   │   └── components/
│   │       ├── InputLine.tsx       # Single line rendering with colors
│   │       ├── SlashMenu.tsx       # Slash command selection menu
│   │       ├── FileMenu.tsx        # File selection menu (@ trigger)
│   │       └── HelpPanel.tsx       # Keyboard shortcuts overlay
│   ├── Divider.tsx            # Horizontal divider
│   ├── Header.tsx             # App header with title
│   └── MessageOutput.tsx      # Message display area (scrollable)
├── models/
│   ├── input.ts               # UserInput types (for submit callback)
│   ├── inputInstance.ts       # InputInstance - core input data model
│   └── richInput.ts           # ColoredSegment, ColorRange, conversion utils
├── constants/
│   ├── commands.ts            # Slash command tree (SLASH_COMMANDS)
│   ├── colors.ts              # Color constants (PATH_COLOR, FILE_AT_COLOR, etc.)
│   ├── platform.ts            # Cross-platform path separator
│   └── meta.ts                # Auto-generated version info
├── services/
│   └── commandHandler.ts      # Command execution and routing
├── hooks/
│   ├── useTerminalWidth.ts    # Terminal width hook
│   └── useTerminalHeight.ts   # Terminal height hook
├── utils/
│   ├── config.ts              # User config (~/.axiomate.json)
│   ├── appdata.ts             # App data directories (~/.axiomate/)
│   ├── localsettings.ts       # Project-local settings (.axiomate/)
│   ├── logger.ts              # Pino logger with rotation
│   └── flags.ts               # CLI flags storage
└── types/                     # .d.ts declarations for untyped libs
```

## Application Layout

```
┌─────────────────────────────┐
│ Header                      │
├─────────────────────────────┤
│ Divider                     │
├─────────────────────────────┤
│ MessageOutput (flex-grow)   │  ← Scrollable message history
├─────────────────────────────┤
│ Divider                     │
├─────────────────────────────┤
│ AutocompleteInput           │  ← Multi-line input with colors
├─────────────────────────────┤
│ Selection Panel             │  ← Mode-dependent content
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
  text: string;               // Raw text content
  cursor: number;             // Cursor position (0-based)
  type: InputType;            // "message" | "command"
  segments: ColoredSegment[]; // Colored segments for rendering
  commandPath: string[];      // Command path (e.g., ["model", "openai"])
  filePath: string[];         // Current file navigation path
  selectedFiles: SelectedFile[]; // Files selected via @ (with position tracking)
};

type SelectedFile = {
  path: string;               // Full file path (e.g., "src/app.tsx")
  isDirectory: boolean;       // Is it a directory?
  atPosition: number;         // Position of @ in text (0-based)
  endPosition: number;        // End position of file path (exclusive)
};
```

Key functions:
- `createEmptyInstance()` - Create empty instance
- `createMessageInstance(text, cursor?)` - Create message type
- `createCommandInstance(path, trailing)` - Create command type with colors
- `updateInstanceFromText(text, cursor, path, filePath)` - Update from text input
- `updateInstanceCursor(instance, cursor)` - Update cursor only
- `enterCommandLevel(instance, name)` - Navigate into command
- `exitCommandLevel(instance)` - Navigate back
- `rebuildSegmentsWithFiles(text, selectedFiles)` - Rebuild colored segments
- `removeSelectedFile(text, file, selectedFiles)` - Remove file block
- `updateSelectedFilesPositions(text, oldSelectedFiles)` - Recalc positions
- `findSelectedFileAtCursor/EndingAt/StartingAt()` - Find file at cursor
- `toHistoryEntry(instance)` / `fromHistoryEntry(entry)` - History conversion
- `toUserInput(instance)` - Convert to submit format

#### Single Source of Truth Principle

**Rule: InputInstance is the single source of truth for the input system**

All user operations that change input content must:
1. First update `InputInstance` in memory
2. Then render based on `InputInstance.segments`

This ensures:
- History stores `HistoryEntry` (InputInstance without cursor)
- Restoring from history displays exactly as original (including colors)
- No need to re-parse from text to rebuild state
- Multi-file selection positions are always accurate

**Never** create display state by parsing text - always derive from `InputInstance`.

### Editor State

Defined in `AutocompleteInput/types.ts`:

```typescript
type EditorState = {
  instance: InputInstance;    // Current input data (single source of truth)
  uiMode: UIMode;             // UI mode state
  suggestion: string | null;  // Autocomplete suggestion
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

### Data Flow

```
User Keyboard Input
    ↓
useInputHandler (via Ink's useInput hook)
    ↓
dispatch(EditorAction)
    ↓
editorReducer updates EditorState
    ├── instance.text, cursor
    ├── instance.segments (rebuilt if needed)
    ├── instance.selectedFiles (positions updated)
    ├── instance.commandPath / filePath
    └── uiMode (controls UI behavior)
    ↓
Hooks compute derived values:
    ├── useAutocomplete → filteredCommands, suggestions
    └── useFileSelect → filteredFiles
    ↓
Components render based on state:
    ├── InputLine: instance.segments → colored text
    ├── SlashMenu: filteredCommands → command menu
    ├── FileMenu: filteredFiles → file menu
    └── HelpPanel: static help display
    ↓
onSubmit triggered (Enter key)
    ↓
toUserInput(instance) → UserInput
    ↓
App.handleSubmit routes based on type
    ├── MessageInput → sendToAI()
    └── CommandInput → handleCommand() service
```

### File Selection System

File selection is triggered by `@` and supports:
- **Multi-file selection**: Select multiple files in a single input
- **Position tracking**: Each selected file tracks `atPosition` and `endPosition`
- **Atomic block operations**: Cursor movement and deletion treat `@path` as units
- **Prefix/Suffix preservation**: Text before/after `@` is preserved during selection

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
  - instance.text = prefix + "@path/"
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
  text: string;                                        // Raw text
  segments: ColoredSegment[];                          // For display
  files: { path: string; isDirectory: boolean }[];     // Selected files
};

type CommandInput = {
  type: "command";
  text: string;                                        // Raw text
  segments: ColoredSegment[];                          // For display
  commandPath: string[];                               // Parsed path
};
```

### Rendering System

#### Color Rendering Pipeline

```
InputInstance.segments (ColoredSegment[])
    ↓
segmentsToRanges() → ColorRange[]
    ↓
processLines() → line positions + cursor location
    ↓
InputLine receives line text + colorRanges + cursorPos
    ↓
renderWithColorRanges() applies colors to text
    ↓
Cursor rendered with inverse video
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
- `FILE_COLOR = "#87ceeb"` - File names (light blue)
- `DIR_COLOR = "#ffd700"` - Directory names (gold)

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

Current command tree:
```
/model
  /openai (gpt-4o, gpt-4, gpt-4-turbo, gpt-3.5-turbo)
  /qwen (qwen-72b, qwen-14b, qwen-7b)
  /claude (claude-3-opus, claude-3-sonnet, claude-3-haiku)
  /deepseek-v3
  /llama-3.3-70b
/compact (prompt: summarize conversation)
/help (internal: help)
/clear (internal: clear)
/version (internal: version)
/exit (internal: exit)
```

### Command Handler Service

Located in `services/commandHandler.ts`:

```typescript
type CommandResult =
  | { type: "message"; content: string }
  | { type: "prompt"; content: string }
  | { type: "config"; key: string; value: string }
  | { type: "action"; action: "clear" | "exit" }
  | { type: "error"; message: string };

type CommandCallbacks = {
  showMessage: (content: string) => void;
  sendToAI: (content: string) => void;
  setConfig: (key: string, value: string) => void;
  clear: () => void;
  exit: () => void;
};
```

### Component Communication

```
App.tsx
├── provides: onSubmit, onClear, onExit, slashCommands
├── receives: UserInput from AutocompleteInput.onSubmit
├── manages: messages[]
└── executes: commandHandler for CommandInput

AutocompleteInput
├── manages: EditorState (instance + uiMode + suggestion)
├── manages: history[]
├── produces: UserInput on submit
└── contains:
    ├── useInputHandler → EditorAction dispatch
    ├── useAutocomplete → suggestions, filteredCommands
    ├── useFileSelect → filteredFiles
    └── Sub-components (InputLine, SlashMenu, FileMenu, HelpPanel)
```

## Code Conventions

- Use `useMemo` for derived values that are dependencies of other hooks
- Use `useCallback` for event handlers
- Prefer `if/else` over ternary expressions for statements (ESLint rule)
- Types go in `models/` folder, `.d.ts` declarations go in `types/`
- Chinese comments are acceptable in this codebase
- Use `PATH_SEPARATOR` from `constants/platform.ts` for file paths

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
| `SET_SUGGESTION` | Update autocomplete suggestion |
| `ENTER_HISTORY` | Enter history mode, save current entry |
| `NAVIGATE_HISTORY` | Navigate history, restore entry |
| `EXIT_HISTORY` | Exit history, restore saved entry |
| `ENTER_SLASH` | Explicitly enter slash mode |
| `SELECT_SLASH` | Change selected index in slash menu |
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

## Testing

Tests are located in `test/` directory using Vitest:

- `test/models/input.test.ts` - UserInput type tests
- `test/models/inputInstance.test.ts` - InputInstance functions tests
- `test/components/reducer.test.ts` - EditorReducer state machine tests
- `test/app.test.tsx` - App component integration tests

Run tests:
```bash
npm test           # Single run
npm run test:watch # Watch mode
```

## Configuration Files

- `~/.axiomate.json` - User configuration (via `utils/config.ts`)
- `~/.axiomate/` - App data directory
  - `logs/` - Log files with daily rotation
  - `history/` - Command history
- `.axiomate/localsettings.json` - Project-local settings

## Platform-Specific Notes

**Windows Backspace Handling**: On Windows terminals, the backspace key may trigger `key.delete` instead of `key.backspace`. The input handler detects this by checking `inputChar` (backspace produces `""`, `"\b"`, or `"\x7f"`).

**Path Separator**: Always use `PATH_SEPARATOR` from `constants/platform.ts` for file paths to ensure cross-platform compatibility (`/` on Unix, `\` on Windows).
