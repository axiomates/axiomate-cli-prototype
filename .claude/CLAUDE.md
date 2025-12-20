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
- **marked** + **marked-terminal** - Markdown rendering in terminal
- **@modelcontextprotocol/sdk** - MCP Server integration
- **Zod** - Schema validation for MCP tools

## Build & Run Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run dev        # Watch mode development
npm start          # Run the CLI (node dist/cli.js)
npm run mcp        # Run standalone MCP server (STDIO)
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
│   │   │   ├── lineProcessor.ts    # Line wrapping & cursor calculation
│   │   │   └── heightCalculator.ts # Input area height calculation
│   │   └── components/
│   │       ├── InputLine.tsx       # Single line rendering with colors
│   │       ├── SlashMenu.tsx       # Slash command selection menu
│   │       ├── FileMenu.tsx        # File selection menu (@ trigger)
│   │       └── HelpPanel.tsx       # Keyboard shortcuts overlay
│   ├── Divider.tsx            # Horizontal divider
│   ├── Header.tsx             # App header with title
│   ├── MessageOutput.tsx      # Message display area (Markdown rendering)
│   ├── Splash.tsx             # Startup splash screen (standalone)
│   └── Welcome.tsx            # First-time user welcome page (standalone)
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
│   ├── commandHandler.ts      # Command execution and routing (async support)
│   ├── ai/                    # AI service integration
│   │   ├── types.ts           # ChatMessage, ToolCall, AIResponse, interfaces
│   │   ├── config.ts          # AI model configuration (~/.axiomate-ai.json)
│   │   ├── service.ts         # AIService with two-phase calling
│   │   ├── tool-call-handler.ts # Execute tools, format results
│   │   ├── index.ts           # Main exports and factory functions
│   │   ├── adapters/          # Protocol adapters
│   │   │   ├── openai.ts      # OpenAI function calling format
│   │   │   ├── anthropic.ts   # Anthropic tool use format
│   │   │   └── index.ts       # Adapter exports
│   │   └── clients/           # API clients
│   │       ├── openai.ts      # OpenAI/Azure/Custom API client
│   │       ├── anthropic.ts   # Anthropic API client
│   │       └── index.ts       # Client exports
│   └── tools/                 # Local development tools discovery
│       ├── types.ts           # DiscoveredTool, ToolAction, ToolParameter
│       ├── registry.ts        # ToolRegistry class (singleton)
│       ├── executor.ts        # executeToolAction, renderCommandTemplate
│       ├── matcher.ts         # ToolMatcher with context awareness
│       ├── discoverers/       # Per-tool discovery modules
│       │   ├── base.ts        # commandExists, getVersion, queryRegistry
│       │   ├── git.ts         # Git discoverer
│       │   ├── node.ts        # Node.js + NVM discoverer
│       │   ├── python.ts      # Python discoverer
│       │   ├── java.ts        # Java discoverer
│       │   ├── powershell.ts  # PowerShell discoverer
│       │   ├── vscode.ts      # VS Code discoverer
│       │   ├── visualstudio.ts # Visual Studio 2022 discoverer
│       │   ├── beyondcompare.ts # Beyond Compare discoverer
│       │   ├── docker.ts      # Docker discoverer
│       │   ├── build.ts       # CMake, MSBuild, Gradle, Maven
│       │   ├── database.ts    # MySQL, PostgreSQL, SQLite
│       │   └── index.ts       # Export ALL_DISCOVERERS
│       └── mcp/               # MCP Server integration
│           ├── server.ts      # createToolsMcpServer()
│           ├── inprocess.ts   # InProcessMcpProvider class
│           └── stdio.ts       # STDIO transport setup
├── mcp-server.ts              # Standalone MCP server entry point
├── hooks/
│   ├── useTerminalWidth.ts    # Terminal width hook
│   └── useTerminalHeight.ts   # Terminal height hook
├── utils/
│   ├── config.ts              # User config (~/.axiomate.json)
│   ├── appdata.ts             # App data directories (~/.axiomate/)
│   ├── localsettings.ts       # Project-local settings (.axiomate/)
│   ├── logger.ts              # Pino logger with rotation
│   ├── flags.ts               # CLI flags storage
│   ├── platform.ts            # Platform-specific initialization (Windows Terminal)
│   └── init.ts                # Async app initialization (tools, AI service)
└── types/                     # .d.ts declarations for untyped libs
```

## Startup Flow

The application uses a **three-phase rendering** architecture with first-time user detection:

```
cli.tsx (entry point)
    │
    ├── Sync init: initConfig(), initAppData(), initLocalSettings(), initPlatform()
    │
    ├── Phase 1: render(<Splash />)
    │   └── initApp() with progress callback
    │       ├── "Discovering tools..." → ToolRegistry.discover()
    │       └── "Loading AI config..." → createAIServiceFromConfig()
    │
    ├── Phase 2: unmount Splash
    │
    └── Phase 3: Check configuration status
        │
        ├── isFirstTimeUser() === true
        │   └── render(<Welcome />)
        │       ├── Display welcome message with test version notice
        │       ├── Wait for any key press
        │       ├── updateConfig() writes preset API URL and key
        │       └── restartApp() restarts with same cwd and args
        │           └── On restart: isFirstTimeUser() === false → App
        │
        └── isFirstTimeUser() === false
            └── render(<App initResult={...} />)
```

**Key Design Principles**:
- Splash is **standalone** - not a child of App, controlled by cli.tsx
- Welcome is **standalone** - shown only for first-time users
- App receives `initResult` prop containing pre-initialized AI service
- No `isReady` state in App - it only renders when fully ready
- Progress updates via `splashInstance.rerender(<Splash message={...} />)`

### First-Time User Detection

Defined in `utils/config.ts`:

```typescript
/**
 * Check if this is first-time use (configuration incomplete)
 *
 * Returns true if any of:
 * - Config file doesn't exist (loadConfigFile returns empty object)
 * - Config file parse failed (loadConfigFile resets to empty object)
 * - AXIOMATE_BASE_URL is missing or empty string
 * - AXIOMATE_API_KEY is missing or empty string
 */
export function isFirstTimeUser(): boolean {
  const config = getConfig();
  return (
    !config.AXIOMATE_BASE_URL ||
    config.AXIOMATE_BASE_URL.trim() === "" ||
    !config.AXIOMATE_API_KEY ||
    config.AXIOMATE_API_KEY.trim() === ""
  );
}
```

### Welcome Component

Located in `components/Welcome.tsx`:

```
┌─────────────────────────────────────────────────────────────┐
│ axiomate-cli v0.1.0                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Welcome to axiomate!                     │
│                                                             │
│                      [Test Version]                         │
│       A pre-configured AI API key is included for testing.  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Press any key to complete setup...          Configuring...  │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Full-screen terminal layout (uses `useTerminalHeight`)
- Centered welcome message with test version notice
- Pre-configured API credentials for testing (future: user registration/login)
- Status display: waiting → configuring → restarting
- Calls `restartApp()` after writing config to apply changes

**Splash Component** (`components/Splash.tsx`):
```typescript
// Simple one-line display: "axiomate-cli v0.1.0 Loading..."
export default function Splash({ message = "Loading..." }: Props) {
  return (
    <Text bold>
      <Text color={THEME_PINK}>{APP_NAME}</Text>
      <Text color={THEME_LIGHT_YELLOW}> v{VERSION}</Text>
      <Text dimColor> {message}</Text>
    </Text>
  );
}
```

**Initialization Module** (`utils/init.ts`):
```typescript
type InitResult = {
  aiService: IAIService | null;
};

type InitProgress = {
  stage: "tools" | "ai" | "done";
  message: string;
};

async function initApp(onProgress?: (progress: InitProgress) => void): Promise<InitResult>;
```

## Application Layout

The app supports two **focus modes**: Input mode and Browse mode (toggled with `Shift+↑/↓`).

### Input Mode (Default)
```
┌─────────────────────────────────────────────┐
│ Header                        [输入] Shift+↑↓ │
├─────────────────────────────────────────────┤
│ Divider                                     │
├─────────────────────────────────────────────┤
│ MessageOutput (flex-grow)   ← PageUp/PageDown│
├─────────────────────────────────────────────┤
│ Divider                                     │
├─────────────────────────────────────────────┤
│ AutocompleteInput           ← ↑/↓ for history│
├─────────────────────────────────────────────┤
│ Selection Panel             ← Mode-dependent │
│   - SlashMenu (/ commands)                  │
│   - FileMenu  (@ files)                     │
│   - HelpPanel (? help)                      │
└─────────────────────────────────────────────┘
```

### Browse Mode (Output Focus)
```
┌─────────────────────────────────────────────┐
│ Header                       [浏览] Shift+↑↓ │
├─────────────────────────────────────────────┤
│ Divider                                     │
├─────────────────────────────────────────────┤
│ MessageOutput (expanded)    ← ↑/↓ to scroll │
│   - Input hidden for more space             │
│   - PageUp/PageDown also work               │
└─────────────────────────────────────────────┘
```

### Focus Mode Details

| Mode   | Toggle          | ↑/↓ Behavior     | Input Area        |
|--------|-----------------|------------------|-------------------|
| Input  | `Shift+↑/↓`     | History navigation | Visible + active |
| Browse | `Shift+↑/↓`     | Scroll messages  | Hidden            |

**Implementation** (`app.tsx`):
```typescript
type FocusMode = "input" | "output";

const [focusMode, setFocusMode] = useState<FocusMode>("input");

// AutocompleteInput reports its dynamic height
const [inputAreaHeight, setInputAreaHeight] = useState(1);
const handleInputHeightChange = useCallback((height: number) => {
  setInputAreaHeight(height);
}, []);

// Global key handler for mode switching
useInput((_input, key) => {
  if (key.shift && (key.upArrow || key.downArrow)) {
    toggleFocusMode();
  }
}, { isActive: true });

// Dynamic height calculation (accounts for variable input area)
// Input mode: Header(1) + Divider(1) + MessageOutput + Divider(1) + InputArea(dynamic)
// Browse mode: Header(1) + Divider(1) + MessageOutput = 2 rows fixed
const fixedHeight = isOutputMode ? 2 : 2 + 1 + inputAreaHeight;
const messageOutputHeight = Math.max(1, terminalHeight - fixedHeight);

// Conditional rendering
{isInputMode && <AutocompleteInput onHeightChange={handleInputHeightChange} ... />}
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
/tools
  /list (internal: tools_list, async)
  /refresh (internal: tools_refresh, async)
  /stats (internal: tools_stats, async)
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
  | { type: "async"; handler: () => Promise<string> }  // Async commands
  | { type: "error"; message: string };

type CommandCallbacks = {
  showMessage: (content: string) => void;
  sendToAI: (content: string) => void;
  setConfig: (key: string, value: string) => void;
  clear: () => void;
  exit: () => void;
};
```

**Note**: The `handleCommand` function is now async to support commands like `/tools list` that require async operations.

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
- `~/.axiomate-ai.json` - AI model configuration (via `services/ai/config.ts`)
  - `currentModel` - Active model ID
  - `models` - Configured model list with API keys
  - `twoPhaseEnabled` - Two-phase calling toggle
  - `contextAwareEnabled` - Context-aware matching toggle
  - `maxToolCallRounds` - Max tool call iterations
- `~/.axiomate/` - App data directory
  - `logs/` - Log files with daily rotation
  - `history/` - Command history
- `.axiomate/localsettings.json` - Project-local settings

## Platform-Specific Notes

**Windows Backspace Handling**: On Windows terminals, the backspace key may trigger `key.delete` instead of `key.backspace`. The input handler detects this by checking `inputChar` (backspace produces `""`, `"\b"`, or `"\x7f"`).

**Path Separator**: Always use `PATH_SEPARATOR` from `constants/platform.ts` for file paths to ensure cross-platform compatibility (`/` on Unix, `\` on Windows).

**Windows Terminal Auto-Configuration** (`utils/platform.ts`):

On Windows, the packaged exe automatically configures Windows Terminal:

1. **Profile Registration**: Adds/updates `axiomate-cli` profile in Windows Terminal's `settings.json`
2. **Icon Integration**: Uses the exe itself as icon source (no separate .ico needed)
3. **Auto-Restart**: If profile is added/updated, restarts to apply changes
4. **Legacy Migration**: Detects and migrates profiles with old invalid GUIDs

Supports multiple Windows Terminal installations:
- Microsoft Store (stable)
- Microsoft Store (preview)
- Unpackaged (scoop, chocolatey, etc.)

**Cross-Platform Restart** (`restartApp()`):

The `restartApp()` function provides cross-platform restart with cwd and args preservation:

- **Windows**: Auto-detects best terminal by priority:
  1. `wt.exe` (Windows Terminal) - Best experience
  2. `powershell.exe` - Available on Win7+
  3. `cmd.exe` - Ultimate fallback
- **macOS/Linux**: Spawns new process with `stdio: "inherit"`

Helper functions:
- `commandExists(cmd)` - Uses `where` (Windows) or `which` (Unix)
- `detectWindowsTerminal()` - Returns `"wt"` | `"powershell"` | `"cmd"`
- `escapePowerShellArg(arg)` - Single quote escaping
- `escapeCmdArg(arg)` - Double quote escaping for special chars

The `initPlatform()` function handles all platform-specific initialization and is called at startup in `cli.tsx`.

## Local Development Tools System

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  axiomate-cli (主进程)                               │
│  ┌─────────────────────────────────────────────────┐│
│  │  ToolRegistry (Singleton)                       ││
│  │    ↓ discover()                                 ││
│  │  ALL_DISCOVERERS → DiscoveredTool[]             ││
│  │    ↓                                            ││
│  │  McpToolProvider (抽象层)                        ││
│  │    ├── InProcessMcpProvider (直接调用)           ││
│  │    └── createToolsMcpServer() (STDIO 导出)      ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Key Types

```typescript
// services/tools/types.ts
type DiscoveredTool = {
  id: string;              // Unique identifier (e.g., "git", "node")
  name: string;            // Display name
  description: string;     // Tool description
  category: ToolCategory;  // "vcs" | "runtime" | "shell" | "ide" | "diff" | etc.
  installed: boolean;      // Whether the tool is installed
  installHint?: string;    // Installation instructions if not installed
  executablePath: string;  // Full path to executable
  version?: string;        // Detected version
  actions: ToolAction[];   // Available actions
  env?: Record<string, string>;  // Environment variables
};

type ToolAction = {
  name: string;            // Action name (e.g., "status", "diff")
  description: string;     // Action description
  commandTemplate: string; // Command template with {{param}} placeholders
  parameters: ToolParameter[];  // Required/optional parameters
};

type ToolParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "directory";
  description: string;
  required: boolean;
  default?: unknown;
};
```

### ToolRegistry

Singleton class managing tool discovery and lookup:

```typescript
// Get singleton instance
const registry = getToolRegistry();

// Discover all tools (async)
await registry.discover();

// Query tools
registry.getAll();           // All discovered tools
registry.getInstalled();     // Only installed tools
registry.getNotInstalled();  // Only not-installed tools
registry.getByCategory("vcs");  // Filter by category
registry.getTool("git");     // Get specific tool
registry.getStats();         // { total, installed, notInstalled, byCategory }
registry.formatToolList(includeNotInstalled);  // Markdown formatted list
```

### Adding a New Tool Discoverer

1. Create discoverer file in `services/tools/discoverers/`:

```typescript
// services/tools/discoverers/mytool.ts
import { createInstalledTool, createNotInstalledTool, commandExists, getVersion } from "./base.js";
import type { ToolDiscoverer } from "../types.js";

export const myToolDiscoverer: ToolDiscoverer = {
  id: "mytool",

  async discover() {
    const exists = await commandExists("mytool");
    if (!exists) {
      return createNotInstalledTool({
        id: "mytool",
        name: "My Tool",
        description: "Description of my tool",
        category: "build",
        installHint: "Install via: npm install -g mytool",
      });
    }

    const version = await getVersion("mytool", ["--version"]);

    return createInstalledTool({
      id: "mytool",
      name: "My Tool",
      description: "Description of my tool",
      category: "build",
      executablePath: await getExecutablePath("mytool"),
      version,
      actions: [
        {
          name: "run",
          description: "Run mytool",
          commandTemplate: "{{execPath}} run {{file}}",
          parameters: [
            { name: "file", type: "file", description: "File to process", required: true }
          ],
        },
      ],
    });
  },
};
```

2. Add to `services/tools/discoverers/index.ts`:

```typescript
import { myToolDiscoverer } from "./mytool.js";

export const ALL_DISCOVERERS: ToolDiscoverer[] = [
  // ... existing discoverers
  myToolDiscoverer,
];
```

### MCP Server Integration

#### In-Process Usage

```typescript
import { getToolRegistry } from "./services/tools/registry.js";
import { InProcessMcpProvider } from "./services/tools/mcp/inprocess.js";

const registry = getToolRegistry();
await registry.discover();

const provider = new InProcessMcpProvider(registry);

// List available tools (MCP format)
const tools = provider.listTools();

// Call a tool
const result = await provider.callTool("git_status", {});
// result: { content: [{ type: "text", text: "..." }], isError?: boolean }
```

#### Standalone MCP Server

The `source/mcp-server.ts` entry point runs a standalone MCP server via STDIO transport:

```bash
npm run mcp
```

This can be configured in Claude Desktop or other MCP clients.

### Markdown Rendering

`MessageOutput.tsx` uses `marked` + `marked-terminal` for Markdown rendering:

```typescript
// Lazy-loaded to avoid test environment issues
const { markedTerminal } = await import("marked-terminal");
const m = new Marked();
m.use(markedTerminal({ width, reflowText: true }));
```

Features:
- Syntax highlighting for code blocks
- Colored headings, bold, italic
- Tables with proper formatting
- Links and lists
- Emoji support

Set `markdown: false` on a message to disable Markdown rendering:
```typescript
setMessages(prev => [...prev, { content: "raw text", markdown: false }]);
```

### MessageOutput Row Rendering

**Important**: Each row in MessageOutput must have explicit `height={1}` to prevent Ink from collapsing empty lines:

```typescript
// Each content row must specify height={1}
<Box key={`line-${index}`} height={1}>
  <Text>{line.text || " "}</Text>
</Box>

// Empty lines must have content (space) to prevent collapse
{line.text || " "}
```

**Why**: In Ink, a `<Box>` containing an empty `<Text>` may collapse to 0 height. This causes layout issues where content appears to only fill half the allocated space. Always:
1. Add `height={1}` to each row Box
2. Use `line.text || " "` to ensure empty lines have content

The component also handles:
- **ANSI escape code stripping** for accurate width calculation
- **CJK character width** (Chinese, Japanese, Korean characters count as 2 columns)
- **Line wrapping** for lines exceeding terminal width
- **Top padding** with empty rows when content is less than available height

### Message Scrolling

`MessageOutput.tsx` supports scrolling with focus mode awareness:

```typescript
type Props = {
  messages: Message[];
  height: number;
  focusMode?: FocusMode;  // "input" | "output"
};
```

**Scrolling Controls**:

| Key           | Input Mode     | Browse Mode    |
|---------------|----------------|----------------|
| `↑`           | History nav    | Scroll up      |
| `↓`           | History nav    | Scroll down    |
| `PageUp`      | Scroll up      | Scroll up      |
| `PageDown`    | Scroll down    | Scroll down    |
| `Shift+↑/↓`   | Mode switch    | Mode switch    |

**Implementation** (`MessageOutput.tsx`):
```typescript
// Ignore Shift+↑/↓ (used for mode switching at App level)
useInput((_input, key) => {
  if (key.shift && (key.upArrow || key.downArrow)) return;

  // In browse mode: plain ↑/↓ scrolls
  if (isOutputMode) {
    if (key.upArrow) { /* scroll up */ }
    if (key.downArrow) { /* scroll down */ }
  }

  // PageUp/PageDown work in both modes
  if (key.pageUp) { /* scroll up page */ }
  if (key.pageDown) { /* scroll down page */ }
}, { isActive: true });
```

**Scroll State**:
- `scrollOffset`: Lines to skip from the top
- Auto-scrolls to bottom when new messages arrive (unless manually scrolled up)
- Shows scroll hints when content extends beyond visible area

## AI Service Integration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  App.tsx                                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  AIService                                                     │  │
│  │    ├── IAIClient (OpenAI / Anthropic)                         │  │
│  │    ├── ToolMatcher (context-aware tool selection)             │  │
│  │    └── ToolCallHandler (execute & format results)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ToolRegistry (Singleton)                                      │  │
│  │    └── DiscoveredTool[] (local development tools)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
source/services/ai/
├── types.ts              # Core AI types and interfaces
├── config.ts             # AI model configuration management
├── service.ts            # AIService with two-phase calling
├── tool-call-handler.ts  # Tool execution and result formatting
├── index.ts              # Main exports and factory functions
├── adapters/
│   ├── openai.ts         # OpenAI protocol adapter
│   ├── anthropic.ts      # Anthropic protocol adapter
│   └── index.ts          # Adapter exports
└── clients/
    ├── openai.ts         # OpenAI API client
    ├── anthropic.ts      # Anthropic API client
    └── index.ts          # Client exports

source/services/tools/
├── matcher.ts            # ToolMatcher with context awareness
└── ... (existing tool system)
```

### Core Types

```typescript
// services/ai/types.ts

// Message types for AI conversation
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];      // AI requests tool execution
  tool_call_id?: string;        // For tool result messages
};

type ToolCall = {
  id: string;                   // Unique call ID (e.g., "call_abc123")
  type: "function";
  function: {
    name: string;               // Tool action name (e.g., "git_status")
    arguments: string;          // JSON string of parameters
  };
};

// AI response
type AIResponse = {
  message: ChatMessage;
  finish_reason: FinishReason;  // "stop" | "tool_calls" | "length"
  usage?: { prompt_tokens, completion_tokens, total_tokens };
};

// Tool matching context
type MatchContext = {
  cwd: string;                  // Current working directory
  userMessage: string;          // User's input message
  projectType?: ProjectType;    // Detected project type
};

type ProjectType = "node" | "python" | "java" | "dotnet" | "rust" | "go" | "unknown";
```

### Two-Phase Calling Flow

AIService implements a two-phase calling strategy for efficient tool selection:

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Intent Analysis (no tools)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  User Message → AI → Intent Analysis                      │  │
│  │    - Extracts: keywords, capabilities, file types         │  │
│  │    - Returns: IntentAnalysis object                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  Phase 2: Tool-Assisted Response                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ToolMatcher.matchTools(intent, context)                  │  │
│  │    - Filters tools based on intent                        │  │
│  │    - Returns: relevant DiscoveredTool[] only              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  AI Chat with Filtered Tools                              │  │
│  │    - Only relevant tools are provided                     │  │
│  │    - Reduces token usage and improves accuracy            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation** (`services/ai/service.ts`):

```typescript
class AIService implements IAIService {
  async sendMessage(userMessage: string, context: MatchContext): Promise<AIResponse> {
    // Phase 1: Analyze intent (if twoPhaseEnabled)
    if (this.config.twoPhaseEnabled) {
      const intent = await this.analyzeIntent(userMessage);
      const tools = this.matchToolsForIntent(intent, context);
      return this.chatWithTools(tools);
    }

    // Direct mode: provide all tools
    return this.chatWithTools(this.registry.getInstalled());
  }
}
```

### Tool Call Loop

When AI requests tool execution, a loop handles multiple rounds:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tool Call Loop                                                 │
│                                                                 │
│  while (rounds < maxToolCallRounds) {                          │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  1. AI Response                                         │  │
│    │     finish_reason: "tool_calls"                         │  │
│    │     tool_calls: [{ id, function: { name, arguments }}]  │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  2. ToolCallHandler.handleToolCalls(toolCalls)          │  │
│    │     - Parse tool name: "git_status" → toolId="git",     │  │
│    │       actionName="status"                               │  │
│    │     - Execute tool action via executor                  │  │
│    │     - Format result as ChatMessage[]                    │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  3. Add Results to Messages                             │  │
│    │     messages.push(...toolResults)                       │  │
│    │     // Each result: { role: "tool", tool_call_id, ... } │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  4. Send Back to AI                                     │  │
│    │     response = await client.chat(messages, tools)       │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│    if (finish_reason !== "tool_calls") break;                  │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Result Message Format

**Critical**: Tool results must include `tool_call_id` to match the original request:

```typescript
// services/ai/tool-call-handler.ts
async handleToolCalls(toolCalls: ToolCall[]): Promise<ChatMessage[]> {
  const results: ChatMessage[] = [];

  for (const call of toolCalls) {
    const { result, tool, action } = await this.executeSingleCall(call);

    // Format content with tool info
    let content = result.success
      ? result.output || "(执行成功，无输出)"
      : `Error: ${result.error || "未知错误"}`;

    if (tool && action) {
      content = `[${tool.name}:${action.name}] (${result.duration}ms)\n${content}`;
    }

    // IMPORTANT: Include tool_call_id to match the request
    results.push({
      role: "tool",
      tool_call_id: call.id,  // Must match call.id from AI response
      content,
    });
  }

  return results;
}
```

**Message Flow Example**:

```typescript
// 1. User sends message
messages = [
  { role: "user", content: "Show me the git status" }
];

// 2. AI responds with tool_calls
aiResponse = {
  message: {
    role: "assistant",
    content: "",
    tool_calls: [{
      id: "call_abc123",
      type: "function",
      function: { name: "git_status", arguments: "{}" }
    }]
  },
  finish_reason: "tool_calls"
};

// 3. ToolCallHandler executes and returns result
toolResults = [{
  role: "tool",
  tool_call_id: "call_abc123",  // Matches the request
  content: "[Git:status] (45ms)\nOn branch main\nnothing to commit"
}];

// 4. Messages sent back to AI
messages = [
  { role: "user", content: "Show me the git status" },
  { role: "assistant", content: "", tool_calls: [...] },
  { role: "tool", tool_call_id: "call_abc123", content: "..." }
];

// 5. AI generates final response
finalResponse = {
  message: { role: "assistant", content: "You're on the main branch with a clean working directory." },
  finish_reason: "stop"
};
```

### Context-Aware Tool Matching

ToolMatcher uses multiple strategies to select relevant tools:

```typescript
// services/tools/matcher.ts
class ToolMatcher implements IToolMatcher {
  matchTools(intent: IntentAnalysis, context: MatchContext): DiscoveredTool[] {
    const matched = new Set<DiscoveredTool>();

    // 1. Keyword matching (e.g., "git" → git tool)
    for (const keyword of intent.keywords) {
      const tools = this.matchByKeyword(keyword);
      tools.forEach(t => matched.add(t));
    }

    // 2. Capability matching (e.g., "version control" → git tool)
    for (const cap of intent.capabilities) {
      const tools = this.matchByCapability(cap);
      tools.forEach(t => matched.add(t));
    }

    // 3. Project type matching (e.g., node project → node, npm tools)
    if (context.projectType) {
      const tools = this.matchByProjectType(context.projectType);
      tools.forEach(t => matched.add(t));
    }

    // 4. File extension inference (e.g., .py file → python tool)
    for (const ext of intent.fileExtensions) {
      const tools = this.matchByFileExtension(ext);
      tools.forEach(t => matched.add(t));
    }

    return Array.from(matched);
  }
}
```

**Project Type Detection**:

```typescript
function detectProjectType(cwd: string): ProjectType {
  // Check for project markers
  if (existsSync(join(cwd, "package.json"))) return "node";
  if (existsSync(join(cwd, "requirements.txt")) ||
      existsSync(join(cwd, "pyproject.toml"))) return "python";
  if (existsSync(join(cwd, "pom.xml")) ||
      existsSync(join(cwd, "build.gradle"))) return "java";
  if (existsSync(join(cwd, "*.csproj"))) return "dotnet";
  if (existsSync(join(cwd, "Cargo.toml"))) return "rust";
  if (existsSync(join(cwd, "go.mod"))) return "go";
  return "unknown";
}
```

### AI Configuration

Config file: `~/.axiomate-ai.json`

```typescript
// services/ai/config.ts
type AIConfig = {
  currentModel: string;           // Active model ID (e.g., "gpt-4o")
  models: Record<string, AIModelConfig>;  // Configured models
  twoPhaseEnabled: boolean;       // Enable two-phase calling (default: true)
  contextAwareEnabled: boolean;   // Enable context-aware matching (default: true)
  maxToolCallRounds: number;      // Max tool call iterations (default: 5)
};

type AIModelConfig = {
  provider: "openai" | "anthropic" | "azure" | "custom";
  apiKey: string;
  model: string;                  // Model name (e.g., "gpt-4o")
  baseUrl?: string;               // Custom API endpoint
};
```

**Model Presets** (pre-configured models):

| Preset | Provider | Model |
|--------|----------|-------|
| `gpt-4o` | openai | gpt-4o |
| `gpt-4-turbo` | openai | gpt-4-turbo |
| `claude-3.5-sonnet` | anthropic | claude-3-5-sonnet-20241022 |
| `claude-3-opus` | anthropic | claude-3-opus-20240229 |
| `deepseek-v3` | custom | deepseek-chat |
| `llama-3.3-70b` | custom | llama-3.3-70b-versatile |

**Commands**:
- `/model list` - Show configured models and current settings
- `/model presets` - Show available model presets

### Protocol Adapters

Adapters convert between internal types and provider-specific formats:

**OpenAI Format** (`adapters/openai.ts`):
```typescript
// Tool definition
type OpenAITool = {
  type: "function";
  function: {
    name: string;        // "toolId_actionName" (e.g., "git_status")
    description: string;
    parameters: JSONSchema;
  };
};

// Conversion
function toOpenAITools(tools: DiscoveredTool[]): OpenAITool[];
function parseOpenAIToolCalls(response): ToolCall[];
function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[];
```

**Anthropic Format** (`adapters/anthropic.ts`):
```typescript
// Tool definition
type AnthropicTool = {
  name: string;
  description: string;
  input_schema: JSONSchema;
};

// Conversion
function toAnthropicTools(tools: DiscoveredTool[]): AnthropicTool[];
function parseAnthropicToolUse(blocks): ToolCall[];
function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[];
```

### Integration Points

**App.tsx Integration**:

```typescript
type Props = {
  initResult: InitResult;  // Received from cli.tsx after Splash phase
};

export default function App({ initResult }: Props) {
  // AI service pre-initialized during Splash phase
  const aiServiceRef = useRef<IAIService | null>(initResult.aiService);

  // Send message to AI
  const sendToAI = useCallback(async (text: string) => {
    if (!aiServiceRef.current) {
      showMessage("AI 服务未配置");
      return;
    }

    const context = { cwd: process.cwd(), userMessage: text };
    const response = await aiServiceRef.current.sendMessage(text, context);

    setMessages(prev => [...prev, { content: response.message.content }]);
  }, []);
  // ...
}
```

**Tool Execution Flow**:

```
User Input → App.sendToAI()
    ↓
AIService.sendMessage(text, context)
    ↓
[Phase 1] analyzeIntent() → IntentAnalysis
    ↓
[Phase 2] matchToolsForIntent() → filtered tools
    ↓
chatWithTools() → AI response
    ↓
if (finish_reason === "tool_calls"):
    ToolCallHandler.handleToolCalls()
        ↓
    parseToolCallName("git_status") → { toolId: "git", actionName: "status" }
        ↓
    registry.getTool("git") → DiscoveredTool
        ↓
    getToolAction(tool, "status") → ToolAction
        ↓
    executeToolAction() → result
        ↓
    Format as ChatMessage with tool_call_id
        ↓
    Add to messages, send back to AI
        ↓
    Loop until finish_reason === "stop"
    ↓
Return final AI response
