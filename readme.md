# axiomate-cli

A terminal-based CLI application built with [Ink](https://github.com/vadimdemedes/ink) and React.

## Features

- Interactive terminal UI with fixed layout
- Auto-completion support with async provider
- Slash commands (`/help`, `/clear`, `/exit`, etc.)
- Command selection with arrow keys
- Keyboard shortcuts (Ctrl+C, Ctrl+U, Ctrl+K, etc.)
- Responsive layout that adapts to terminal size

## Requirements

- Node.js >= 20

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
| `/config`     | Show configuration       |
| `/status`     | Show current status      |

## Keyboard Shortcuts

| Shortcut     | Action                                             |
| ------------ | -------------------------------------------------- |
| `Tab`        | Accept autocomplete suggestion                     |
| `→`          | Accept one character from suggestion               |
| `←` / `→`    | Move cursor left/right                             |
| `↑` / `↓`    | Navigate slash command list                        |
| `Ctrl+Enter` | Insert new line                                    |
| `Ctrl+A`     | Move cursor to line start                          |
| `Ctrl+E`     | Move cursor to line end                            |
| `Ctrl+U`     | Clear text before cursor                           |
| `Ctrl+K`     | Clear text after cursor                            |
| `Ctrl+C`     | Exit application                                   |
| `Escape`     | Clear suggestion / exit slash mode / close help    |
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
```

## Input Modes

The input component supports multiple modes with structured input handling:

### Input Types

| Type      | Description                        | Example               |
| --------- | ---------------------------------- | --------------------- |
| `message` | Regular text input, sent to AI     | `hello world`         |
| `command` | Slash commands, handled by the app | `/model openai gpt-4` |

### Input Modes (Internal State)

| Mode      | Trigger   | Description                          |
| --------- | --------- | ------------------------------------ |
| `normal`  | Default   | Regular input with autocomplete      |
| `history` | `↑` / `↓` | Browse command history               |
| `slash`   | `/`       | Navigate hierarchical slash commands |
| `help`    | `?`       | Display keyboard shortcuts (overlay) |

When user submits input, it's converted to a structured `UserInput` object:

```typescript
// Message input (for AI)
{ type: "message", content: "hello world" }

// Command input (internal handling)
{ type: "command", command: ["model", "openai", "gpt-4"], raw: "/model openai gpt-4" }
```

## Project Structure

```
source/
├── app.tsx                    # Main application component
├── cli.tsx                    # CLI entry point
├── constants/
│   └── commands.ts            # Slash command definitions
├── components/
│   ├── AutocompleteInput.tsx  # Input with autocomplete & mode management
│   ├── Divider.tsx            # Separator line
│   ├── Header.tsx             # Title bar
│   └── MessageOutput.tsx      # Message display area
├── models/
│   └── input.ts               # UserInput type definitions
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
