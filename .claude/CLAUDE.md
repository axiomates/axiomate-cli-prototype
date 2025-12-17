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
│   │   ├── types.ts           # EditorState, UIMode, EditorAction, helpers
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
│   └── commands.ts            # Slash command definitions (SLASH_COMMANDS)
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
};
```

Key functions:
- `createEmptyInstance()` - Create empty instance
- `createMessageInstance(text)` - Create message type
- `createCommandInstance(path, trailing)` - Create command type with colors
- `updateInstanceFromText(text, cursor, path)` - Update from text input
- `buildCommandText(path, trailing)` - Build command text from path

#### Data Flow

```
User Action → dispatch(EditorAction) → Reducer updates EditorState
                                              ↓
                                    Updates InputInstance (includes segments)
                                              ↓
                                    Render uses instance.segments directly
```

### Editor State

Defined in `AutocompleteInput/types.ts`:

```typescript
type EditorState = {
  instance: InputInstance;    // Current input data
  uiMode: UIMode;            // UI mode state
  suggestion: string | null; // Autocomplete suggestion
};

type UIMode =
  | { type: "normal" }
  | { type: "history"; index: number; savedInstance: InputInstance }
  | { type: "slash"; selectedIndex: number }
  | { type: "file"; selectedIndex: number; basePath: string; atPosition: number }
  | { type: "help" };
```

### UI Modes

| Mode      | Trigger | Description                          |
| --------- | ------- | ------------------------------------ |
| `normal`  | default | Regular input with autocomplete      |
| `history` | ↑/↓     | Browse command history (restores full InputInstance) |
| `slash`   | `/`     | Navigate hierarchical commands       |
| `file`    | `@`     | Navigate file system for selection   |
| `help`    | `?`     | Display shortcuts overlay            |

### Selection List System

Both slash commands and file selection share similar interaction patterns:

| Feature | Slash Mode (`/`) | File Mode (`@`) |
|---------|------------------|-----------------|
| Data Source | Static command config | Async file system |
| Enter | Next level / Execute | Enter directory / Select file |
| Escape | Back one level / Exit | Back one level / Exit |
| ↑/↓ | Navigate commands | Navigate files |
| Component | `SlashMenu` | `FileMenu` |

### History System

- Stores `InputInstance[]` (complete data including colors)
- Deduplication based on `text` field
- `?` input not stored in history
- Up/down navigation restores all properties including colored segments

### UserInput (Submit Callback)

For the `onSubmit` callback, a simpler `UserInput` type is used:

```typescript
type UserInput = MessageInput | CommandInput;

// Regular input -> sent to AI
type MessageInput = { type: "message"; content: string };

// Slash commands -> handled internally
type CommandInput = { type: "command"; command: string[]; raw: string };
```

### Slash Commands

Slash commands support nested hierarchy defined in `constants/commands.ts`:

```typescript
type SlashCommand = {
  name: string;
  description?: string;
  children?: SlashCommand[];  // Nested subcommands
  action?: CommandAction;     // Command behavior (leaf nodes)
};

// Command action types
type CommandAction =
  | { type: "internal"; handler?: string }  // Internal handler (e.g., /version, /clear)
  | { type: "prompt"; template: string }    // Convert to prompt and send to AI (e.g., /compact)
  | { type: "config"; key: string };        // Configuration change (e.g., /model)
```

Example: `/model → openai → gpt-4` with path `["model", "openai", "gpt-4"]`

### File Selection

File selection is triggered by `@` and provides hierarchical navigation:

```typescript
// useFileSelect hook returns
type FileItem = {
  name: string;
  isDirectory: boolean;
  path: string;
};

// File mode state
type FileUIMode = {
  type: "file";
  selectedIndex: number;
  basePath: string;      // Current directory path
  atPosition: number;    // Position of @ in input text
};
```

**File Selection Flow:**
```
User types @
    ↓
ENTER_FILE action → file mode activated
    ↓
useFileSelect reads current directory
    ↓
User navigates with ↑/↓, enters directories
    ↓
CONFIRM_FILE → file path inserted at @ position
```

### Command Handler

Command execution is handled by `services/commandHandler.ts`:

```typescript
type CommandResult =
  | { type: "message"; content: string }    // Display message (internal complete)
  | { type: "prompt"; content: string }     // Send to AI
  | { type: "config"; key: string; value: string }  // Config change
  | { type: "action"; action: "clear" | "exit" }    // Special action
  | { type: "error"; message: string };

// Execute command and get result
executeCommand(path: string[], context: CommandContext): CommandResult
```

### Color Rendering

Colors are stored in `InputInstance.segments` and converted to `ColorRange[]` for rendering:

```typescript
type ColoredSegment = { text: string; color?: string };
type ColorRange = { start: number; end: number; color?: string };
```

Color constants (in `richInput.ts`):
- `PATH_COLOR = "#ffd700"` - Command path color (gold)
- `ARROW_COLOR = "gray"` - Arrow separator color

File colors (in `FileMenu.tsx`):
- `FILE_COLOR = "#87ceeb"` - File color (light blue)
- `DIR_COLOR = "#ffd700"` - Directory color (gold)

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
| `SET_TEXT` | Update text and cursor, auto-detect mode |
| `SET_CURSOR` | Move cursor position |
| `ENTER_HISTORY` | Enter history mode, save current instance |
| `NAVIGATE_HISTORY` | Navigate history, restore instance |
| `EXIT_HISTORY` | Exit history, restore saved instance |
| `ENTER_SLASH_LEVEL` | Enter next command level (has children) |
| `SELECT_FINAL_COMMAND` | Select leaf command (no children) |
| `EXIT_SLASH_LEVEL` | Go back one level or exit slash mode |
| `ENTER_FILE` | Enter file selection mode |
| `SELECT_FILE` | Navigate file list |
| `ENTER_FILE_DIR` | Enter subdirectory |
| `CONFIRM_FILE` | Select file and insert path |
| `EXIT_FILE` | Go back one level or exit file mode |
| `TOGGLE_HELP` | Toggle help panel |
| `RESET` | Reset to initial state |
