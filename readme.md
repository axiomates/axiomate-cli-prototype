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

## Commands

Type commands directly or use slash commands:

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `clear` | Clear the screen |
| `exit` / `quit` | Exit the application |
| `version` | Show version information |

### Slash Commands

Type `/` to see available slash commands. Use arrow keys to select and Enter to execute.

| Slash Command | Description |
|---------------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear the screen |
| `/exit` | Exit the application |
| `/version` | Show version information |
| `/config` | Show configuration |
| `/status` | Show current status |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Accept autocomplete suggestion |
| `→` | Accept one character from suggestion |
| `←` / `→` | Move cursor left/right |
| `↑` / `↓` | Navigate slash command list |
| `Ctrl+A` | Move cursor to line start |
| `Ctrl+E` | Move cursor to line end |
| `Ctrl+U` | Clear text before cursor |
| `Ctrl+K` | Clear text after cursor |
| `Ctrl+C` | Exit application |
| `Escape` | Clear suggestion / exit slash mode / close help |
| `?` | Show keyboard shortcuts help (when input is empty) |

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

## Project Structure

```
source/
├── app.tsx                    # Main application component
├── cli.tsx                    # CLI entry point
├── constants/
│   └── commands.ts            # Command configurations
├── components/
│   ├── AutocompleteInput.tsx  # Input with autocomplete
│   ├── Divider.tsx            # Separator line
│   ├── Header.tsx             # Title bar
│   └── MessageOutput.tsx      # Message display area
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
