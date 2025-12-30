# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Maintenance Rule

**IMPORTANT**: After making code changes, Claude Code should update this file to reflect any architectural changes, new features, modified commands, or updated file structures. Keep this document accurate and concise.

## Project Overview

axiomate is a terminal-based AI agent application built with React 19 + Ink 6. It provides an interactive CLI interface with autocomplete, hierarchical slash commands, multi-file selection, and structured input handling.

## Tech Stack

- **React 19** + **Ink 6** - Terminal UI framework
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** - Testing
- **marked** + **marked-terminal** - Markdown rendering
- **@modelcontextprotocol/sdk** - MCP Server integration

## Build & Run Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm start          # Run CLI
npm test           # Run tests
npm run lint:fix   # Auto-fix lint issues
npm run package    # Build standalone executable (requires Bun)
```

## Project Structure

```
source/
├── cli.tsx                    # Entry point
├── app.tsx                    # Main app component
├── components/
│   ├── AutocompleteInput/     # Core input component
│   │   ├── index.tsx          # Main component
│   │   ├── types.ts           # EditorState, UIMode, EditorAction
│   │   ├── reducer.ts         # State machine reducer
│   │   ├── hooks/             # useAutocomplete, useInputHandler, useFileSelect
│   │   └── components/        # InputLine, SlashMenu, FileMenu, HelpPanel
│   ├── MessageOutput.tsx      # Message display (Markdown, scrolling, collapse)
│   ├── StatusBar.tsx          # Bottom status bar (mode indicator, hints)
│   ├── Splash.tsx             # Startup splash screen
│   └── Welcome.tsx            # First-time user setup
├── models/
│   ├── input.ts               # UserInput types
│   ├── inputInstance.ts       # InputInstance - core input data model
│   └── messageGroup.ts        # Message grouping and collapse
├── constants/
│   ├── commands.ts            # Slash command tree (dynamic generation)
│   ├── models.ts              # DEFAULT_MODEL_ID, DEFAULT_SUGGESTION_MODEL_ID
│   └── colors.ts              # Color constants
├── services/
│   ├── commandHandler.ts      # Command execution and routing
│   ├── ai/                    # AI service (session, streaming, tools)
│   │   ├── service.ts         # AIService main class
│   │   ├── session.ts         # Session with token tracking
│   │   ├── sessionStore.ts    # Multi-session persistence
│   │   ├── messageQueue.ts    # Sequential message processing
│   │   └── clients/           # OpenAI/Anthropic API clients
│   └── tools/                 # Local development tools discovery
│       ├── registry.ts        # ToolRegistry singleton
│       ├── matcher.ts         # Tool selection based on context
│       ├── executor.ts        # Tool action execution
│       ├── fileOperations.ts  # File ops with encoding detection
│       ├── encodingDetector.ts # BOM + chardet encoding detection
│       ├── scriptWriter.ts    # Script file generation (UTF-8 BOM for PS)
│       └── discoverers/       # Per-tool discovery modules
├── i18n/                      # Internationalization (en, zh-CN, ja)
└── utils/
    ├── config.ts              # User config (~/.axiomate.json)
    └── logger.ts              # Async logging with rotation
```

## Slash Commands

Commands are defined in `constants/commands.ts` with dynamic generation:

```
/model [current]           - Switch AI model (dynamically generated from config)
/thinking [on|off]         - Toggle AI thinking mode
/session                   - Session management
  /list                    - List all sessions
  /new                     - Create new session
  /switch <name>           - Switch to session (by name, shows ID in description)
  /delete <name>           - Delete session (by name)
  /clear                   - Clear current session
/compact                   - Summarize and compress context
/stop                      - Stop current AI processing
/tools [list|refresh|stats] - Tool management
/suggestion [on|off]       - Toggle AI suggestions
  /model [current]         - Select suggestion model (shows current in description)
/language [en|zh-CN|ja]    - Switch interface language
/exit                      - Exit application
```

**Dynamic Command Features**:
- Model commands show current selection with `▸` prefix
- `/model` description shows `[ModelName]` suffix
- `/suggestion model` description shows `[ModelName]` suffix
- Session switch/delete use session name as command name, ID in description

**Adding a new command**:
1. Add to `getSlashCommands()` in `constants/commands.ts`
2. Add handler in `services/commandHandler.ts` `internalHandlers`
3. Call `clearCommandCache()` if command state changes dynamically

## Configuration

**User config** (`~/.axiomate.json`):
```typescript
{
  models: Record<string, ModelConfig>;  // Per-model API configs
  currentModel: string;                 // Current model ID
  suggestionModel: string;              // Suggestion model ID
  suggestionEnabled?: boolean;          // Default: true
  thinkingEnabled?: boolean;            // Default: false
}
```

**Default constants** (`constants/models.ts`):
- `DEFAULT_MODEL_ID = "Qwen/Qwen3-8B"`
- `DEFAULT_SUGGESTION_MODEL_ID = "THUDM/glm-4-9b-chat"`

## Key Architecture Patterns

### Data-Driven Input System

`InputInstance` is the **single source of truth** for all input state:
- All operations update `InputInstance` first, then render from it
- History stores `HistoryEntry` (InputInstance without cursor)
- File selections track positions for atomic block operations

### UI Modes

| Mode      | Trigger | Description                     |
|-----------|---------|--------------------------------|
| `normal`  | default | Regular input with autocomplete |
| `history` | ↑/↓     | Browse command history          |
| `slash`   | `/`     | Navigate hierarchical commands  |
| `file`    | `@`     | Navigate file system            |
| `help`    | `?`     | Display shortcuts overlay       |

### Focus Modes

| Mode   | Toggle      | ↑/↓ Behavior      |
|--------|-------------|-------------------|
| Input  | `Shift+↑/↓` | History navigation |
| Browse | `Shift+↑/↓` | Scroll messages    |

### Message Collapsing

- Messages grouped into Q&A pairs
- Auto-collapse old groups when new arrives
- Browse mode: `Enter` to toggle, `e` expand all, `c` collapse all
- Uses `▶` (collapsed) and `▼` (expanded) indicators

### Welcome Message

- Shown once per app lifecycle when session is empty
- Uses `type: "welcome"` message type with colored segments syntax: `{{color:text}}`
- Not saved to session, not collapsible
- Supports `pink` and `yellow` color keys (maps to theme colors)
- i18n key: `app.welcomeMessage`

### Session Management

- `SessionStore` manages multiple sessions with persistence
- `/session list` displays sessions with `▸` for active, `○` for inactive
- Session switch/delete commands use **session name** (not ID) as identifier

**Session Restoration**:
- `restoreSession()` in `service.ts` clears persisted system prompt and resets `contextInjected` flag
- System prompt is lazily set on first message via `ensureContextInSystemPrompt()`
- This ensures consistent behavior: system prompt is always set when user sends first message

### StatusBar Usage Display

- Shows token usage in format: `1.5k/32k (5%)`
- Updates on: AI response, session new/switch/clear, `/stop`
- Color coding: gray (normal), yellow (>80%), red (>95%)
- `updateUsageStatus()` callback refreshes display from `AIService.getSessionStatus()`

### Context Window Management

**Two Mechanisms**:

| Mechanism | Trigger | Purpose |
|-----------|---------|---------|
| **File Truncation** | File content > available space | Truncate large files to fit context |
| **Auto-Compact** | History + new message > 85% | Summarize history to free space |

**File Truncation** (`contentBuilder.ts`): When file content exceeds available context space, it's truncated proportionally using `truncateFilesProportionally()`. Large files are cut, not history.

**Auto-Compact** (`shouldCompact` + `compactWith`): When projected usage exceeds 85% AND there are ≥2 real messages in history, the system calls AI to summarize the conversation. Only compacts history, not current message's file attachments.

**Key Design Decisions**:
- `reserveRatio` = 0 (compact threshold provides buffer, no double-reservation)
- Compact check happens BEFORE file truncation (maximize available space)
- `realMessageCount >= 2` prevents compact on first message or right after compact
- No `trimHistory` mechanism - files are truncated, history is preserved

## AI Service

### Streaming

- Real-time SSE streaming with Braille spinner animation
- Supports `reasoning_content` for thinking models
- Tool calls accumulated during stream, executed on `finish_reason: "tool_calls"`

### Tool Selection

Uses local directory analysis (not AI two-phase):
- Detects project type from marker files (package.json, requirements.txt, etc.)
- Infers from @selected file extensions
- Saves tokens and reduces latency

**Default Tools** (always provided to AI):
1. **Shell tools** (platform-specific):
   - Windows: `pwsh`, `powershell`, `cmd`
   - Unix/macOS: `bash`
2. **Builtin utility tools** (cross-platform):
   - `file` - File operations with auto encoding detection
   - `ask_user` - Ask user questions and wait for response

### File Tool

Cross-platform builtin tool for file operations with automatic encoding detection.

**Actions**:
| Action | Description |
|--------|-------------|
| `read` | Read file with auto encoding detection |
| `read_lines` | Read specific line range (1-based) |
| `write` | Write file (preserves encoding for existing, UTF-8 for new) |
| `edit` | Replace content (preserves original encoding) |
| `search` | Search for pattern (string or regex) |

**Encoding Support**:

### Ask User Tool

Builtin tool that allows AI to pause execution and ask user a question.

**Usage**:
- AI calls `ask_user_ask` with `question` and optional `options` (JSON array string)
- UI displays question with predefined options + custom input option
- User navigates with ↑/↓, selects with Enter, cancels with Escape
- User can choose "[Custom input...]" to type their own answer
- AI receives user's answer and continues processing

**Implementation**:
- Tool discoverer: `source/services/tools/discoverers/ask_user.ts`
- UI component: `source/components/AskUserMenu.tsx`
- Callback type: `AskUserCallback` in `source/services/ai/types.ts`
- Integration: `app.tsx` state `pendingAskUser` + handlers

**Encoding Support**:
- Two-stage detection: BOM first (100% confidence), then chardet statistical analysis
- Supported: UTF-8, UTF-16 LE/BE, UTF-32 LE/BE, GBK, GB18030, Shift-JIS, Windows-1252, ISO-8859-1
- BOM preservation: Files with BOM keep BOM after edit
- Uses `iconv-lite` for encoding conversion

### Script Execution

For AI-generated scripts, `scriptWriter.ts` handles proper encoding:

| Script Type | Line Endings | Encoding |
|-------------|--------------|----------|
| PowerShell 5.1 (.ps1) | CRLF (Windows) | UTF-8 with BOM |
| pwsh (.ps1) | CRLF (Windows) | UTF-8 (no BOM) |
| CMD (.bat) | CRLF | UTF-8 (no BOM) |
| Bash (.sh) | LF | UTF-8 (no BOM) |
| Python (.py) | Platform default | UTF-8 (no BOM) |

**Why UTF-8 BOM for PowerShell 5.1 only**: PowerShell 5.1 defaults to system encoding (e.g., GBK on Chinese Windows) without BOM. pwsh (PowerShell Core) defaults to UTF-8 on all platforms, no BOM needed.

## Internationalization

- System locale auto-detection
- Instant language switching via listener pattern
- Commands: `/language en|zh-CN|ja`
- Translation files in `source/i18n/locales/`

## Code Conventions

- Use `useMemo` for derived values, `useCallback` for handlers
- Types in `models/`, `.d.ts` in `types/`
- Chinese comments acceptable
- Use `PATH_SEPARATOR` from `constants/platform.ts`
- Markdown rendering may strip leading spaces - use visible markers (like `○`) instead
- **All user-facing text must use i18n** - add translations to `i18n/locales/*.json` files (en, zh-CN, ja) and use `t()` function

## Common Tasks

### Adding a Tool Discoverer

1. Create file in `services/tools/discoverers/`
2. Export discoverer with `id` and `async discover()` method
3. Add to `ALL_DISCOVERERS` in `discoverers/index.ts`

### Modifying Input Handling

- Keyboard: `AutocompleteInput/hooks/useInputHandler.ts`
- State transitions: `AutocompleteInput/reducer.ts`
- Command execution: `services/commandHandler.ts`

### Platform Notes

- Windows backspace may trigger `key.delete` - check `inputChar`
- Windows Terminal auto-configuration in `utils/platform.ts`
