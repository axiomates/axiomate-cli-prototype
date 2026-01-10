# axiomate

Terminal AI assistant with streaming responses, multi-file context, and session management.

## Tech Stack

React 19, Ink 6, TypeScript, Node.js >= 20

## Quick Start

```bash
cp .env.local.example .env.local  # Configure API
npm install
npm run build
npm start
```

On first launch, a welcome screen will appear. You can use the built-in test API directly.

### Build Executables

```bash
npm run package              # Current platform (requires Bun)
npm run package -- --all     # All platforms (cross-compile)
npm run package -- --mac     # macOS (Intel + Apple Silicon)
npm run package -- --windows # Windows x64
npm run package -- --linux   # Linux (x64 + ARM64)
```

Output files are in the `bundle/` directory.

## Features

- **Streaming Responses** - Real-time AI reply display
- **Native Terminal Scrolling** - Messages flow into terminal's native scrollback
- **Multi-file Selection** - Use `@` to select and attach files to messages
- **Session Management** - Multiple sessions with auto-save
- **Auto Compaction** - Automatic summarization when context is full
- **Thinking Mode** - Support for reasoning models (DeepSeek-R1, QwQ, etc.)
- **Tool Calling** - AI can use local tools (Git, Node.js, etc.)
- **i18n** - English, Chinese, Japanese

## Keyboard Shortcuts

### Basic Navigation

| Key          | Function                             |
| ------------ | ------------------------------------ |
| `Enter`      | Submit message                       |
| `Ctrl+Enter` | Insert newline                       |
| `Ctrl+C`     | Exit application                     |
| `Escape`     | Exit current mode / Clear suggestion |

### Cursor Movement

| Key                | Function                  |
| ------------------ | ------------------------- |
| `Left/Right Arrow` | Move cursor by character  |
| `Ctrl+A`           | Move to beginning of line |
| `Ctrl+E`           | Move to end of line       |

### Text Editing

| Key         | Function                       |
| ----------- | ------------------------------ |
| `Backspace` | Delete character before cursor |
| `Delete`    | Delete character after cursor  |
| `Ctrl+U`    | Delete all text before cursor  |
| `Ctrl+K`    | Delete all text after cursor   |

### Special Modes

| Key             | Function                             |
| --------------- | ------------------------------------ |
| `/`             | Open slash command menu              |
| `@`             | Open file selector                   |
| `?`             | Show help (when input is empty)      |
| `Tab`           | Accept suggestion                    |
| `Right Arrow`   | Accept one character from suggestion |
| `Up/Down Arrow` | Navigate history / Navigate menu     |

## Slash Commands

### Model & AI Settings

| Command         | Description           |
| --------------- | --------------------- |
| `/model`        | Switch AI model       |
| `/model <name>` | Select specific model |
| `/thinking`     | Toggle thinking mode  |
| `/thinking on`  | Enable thinking mode  |
| `/thinking off` | Disable thinking mode |

### Plan Mode

| Command     | Description       |
| ----------- | ----------------- |
| `/plan`     | Toggle plan mode  |
| `/plan on`  | Enable plan mode  |
| `/plan off` | Disable plan mode |

### Session Management

| Command           | Description               |
| ----------------- | ------------------------- |
| `/session`        | Session management menu   |
| `/session list`   | List all sessions         |
| `/session new`    | Create new session        |
| `/session switch` | Switch to another session |
| `/session delete` | Delete a session          |
| `/session clear`  | Clear current session     |

### Context Management

| Command    | Description                               |
| ---------- | ----------------------------------------- |
| `/compact` | Compress context (summarize conversation) |
| `/stop`    | Stop current AI response                  |

### Tools

| Command          | Description                |
| ---------------- | -------------------------- |
| `/tools`         | Tool management menu       |
| `/tools list`    | List available tools       |
| `/tools refresh` | Refresh tool discovery     |
| `/tools stats`   | Show tool usage statistics |

### Input Suggestions

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `/suggestion`       | Toggle input suggestions     |
| `/suggestion on`    | Enable suggestions           |
| `/suggestion off`   | Disable suggestions          |
| `/suggestion model` | Select model for suggestions |

### Interface

| Command           | Description               |
| ----------------- | ------------------------- |
| `/language`       | Switch interface language |
| `/language en`    | English                   |
| `/language zh-CN` | Simplified Chinese        |
| `/language ja`    | Japanese                  |
| `/exit`           | Exit application          |

## Plan Mode

Plan Mode is designed for complex tasks that require step-by-step planning and execution. It provides a structured workflow where the AI first creates a detailed plan, then executes it systematically.

### Concept

Plan Mode operates in two distinct modes:

| Mode            | Description              | Available Tools                               |
| --------------- | ------------------------ | --------------------------------------------- |
| **Plan Mode**   | Read-only planning phase | Only `plan` tool (read, write, edit, search)  |
| **Action Mode** | Full execution phase     | All tools (file operations, shell, git, etc.) |

### How to Use

#### Manual Control

Use slash commands to manually toggle Plan Mode:

```
/plan on   # Enter Plan Mode
/plan off  # Exit to Action Mode
```

#### AI-Controlled

Ask the AI to create and execute a plan:

```
"Create a plan to refactor the authentication module, then execute it"
```

The AI will automatically:

1. Enter Plan Mode
2. Create a detailed plan
3. Exit Plan Mode
4. Execute each step

### Workflow

1. **Enter Plan Mode**
   - AI calls `plan_enter_mode` tool
   - Only planning tools become available
   - AI can read files but cannot modify them

2. **Create Plan**
   - AI uses `plan_write` to create plan at `.axiomate/plans/plan.md`
   - Plan typically includes:
     - Overview and objectives
     - Step-by-step tasks with checkboxes `- [ ]`
     - Dependencies and considerations

3. **Exit Plan Mode**
   - AI calls `plan_exit_mode` tool
   - Full tool access is restored
   - AI begins executing the plan

4. **Execute Plan**
   - AI works through each step
   - Uses `plan_edit` to mark completed steps: `- [ ]` to `- [x]`
   - Can read plan to check remaining tasks

### Plan Tool Actions

| Action            | Description                      |
| ----------------- | -------------------------------- |
| `plan_read`       | Read the entire plan file        |
| `plan_read_lines` | Read specific lines from plan    |
| `plan_write`      | Create or replace entire plan    |
| `plan_append`     | Append content to plan           |
| `plan_edit`       | Find and replace content in plan |
| `plan_search`     | Search for patterns in plan      |
| `plan_enter_mode` | Switch to Plan Mode              |
| `plan_exit_mode`  | Switch to Action Mode            |

### Example Plan Structure

```markdown
# Refactor Authentication Module

## Objectives

- Improve code organization
- Add proper error handling
- Implement token refresh

## Tasks

- [ ] Review current auth implementation
- [ ] Create new auth service structure
- [ ] Migrate login functionality
- [ ] Migrate logout functionality
- [ ] Add token refresh logic
- [ ] Update error handling
- [ ] Write unit tests
- [ ] Update documentation
```

### Best Practices

1. **Use for complex tasks** - Plan Mode is most useful for multi-step tasks
2. **Let AI manage mode** - Allow AI to enter/exit automatically for best results
3. **Review plans** - Check the generated plan before AI executes it
4. **Incremental execution** - AI marks progress, making it easy to resume

## Configuration

- `~/.axiomate.json` - Model and API configuration
- `~/.axiomate/` - Logs and session data

## Development

```bash
npm run dev        # Development mode
npm run test       # Run tests
npm run coverage   # Run tests coverage
npm run lint       # Lint code
npm run lint:fix   # Fix code style
```
