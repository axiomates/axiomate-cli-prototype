# axiomate

A terminal-based AI assistant built with React + Ink, featuring streaming responses, multi-file context, and intelligent session management.

## Features

- **Streaming AI responses** with animated spinner
- **Multi-file selection** via `@` - attach multiple files to your message
- **Session management** - multiple sessions with auto-save and persistence
- **Auto-compact** - automatically summarizes conversation when context fills up
- **Thinking mode** - supports DeepSeek-R1, QwQ models with collapsible reasoning
- **Tool integration** - AI can use local dev tools (Git, Node.js, etc.)
- **i18n** - English, Chinese, Japanese

## Quick Start

```bash
cp .env.local.example .env.local
# edit .env.local
npm install
npm run build
npm run start
```

On first launch, a welcome page appears with pre-configured API credentials for testing.

### Standalone Executable

```bash
npm run package  # Requires Bun
```

Creates `bundle/axiomate.exe` (Windows) or `bundle/axiomate` (macOS/Linux).

## Usage

### Slash Commands

Type `/` to open the command menu:

| Command | Description |
|---------|-------------|
| `/model` | Switch AI model |
| `/thinking on\|off` | Toggle thinking mode |
| `/session list\|new\|switch\|delete\|clear` | Session management |
| `/compact` | Summarize conversation to free context |
| `/stop` | Stop AI processing |
| `/tools list\|refresh\|stats` | Manage local tools |
| `/suggestion on\|off\|model` | AI input suggestions |
| `/language en\|zh-CN\|ja` | Switch language |
| `/exit` | Exit application |

### File Selection

Type `@` to browse and select files:

```
analyze @src/app.ts and @src/utils.ts
```

- `↑/↓` navigate, `Enter` select, `Escape` go back
- Multiple files supported
- `@path` blocks are atomic (cursor skips over, delete removes whole block)

### Focus Modes

| Mode | Toggle | Description |
|------|--------|-------------|
| Input | `Shift+↑/↓` | Input active, `↑/↓` for history |
| Browse | `Shift+↑/↓` | Input hidden, `↑/↓` scrolls messages |

### Context Management

Two independent mechanisms handle context limits:

| Mechanism | Trigger | What it does |
|-----------|---------|--------------|
| **Truncation** | File > available space | Truncates large files to fit |
| **Auto-Compact** | Usage > 85% with history | Summarizes conversation |

Example flow:
```
Message 1: @large-file.md → File truncated (too big for context)
Message 2: @small-file.ts → Auto-compact triggers (history + new > 85%)
```

## Keyboard Shortcuts

### Global
| Key | Action |
|-----|--------|
| `Shift+↑/↓` | Toggle Input/Browse mode |
| `PageUp/Down` | Scroll messages |
| `Ctrl+C` | Exit |

### Input Mode
| Key | Action |
|-----|--------|
| `/` | Slash commands |
| `@` | File selection |
| `?` | Help (when empty) |
| `Tab` | Accept suggestion |
| `↑/↓` | History / menu navigation |
| `Ctrl+Enter` | New line |

### Browse Mode
| Key | Action |
|-----|--------|
| `↑/↓` | Scroll |
| `Enter` | Toggle group/thinking collapse |
| `e` / `c` | Expand/collapse all |

## Configuration

- `~/.axiomate.json` - User config (models, current model, settings)
- `~/.axiomate/` - App data (logs, sessions)

## Development

```bash
npm run dev        # Watch mode
npm test           # Run tests
npm run lint:fix   # Fix lint issues
```

## Tech Stack

- **React 19 + Ink 6** - Terminal UI
- **TypeScript 5.7** - Language
- **Node.js >= 20** - Runtime
- **Vitest** - Testing
- **marked + marked-terminal** - Markdown rendering
- **@modelcontextprotocol/sdk** - MCP Server integration
