# LUNAR 🌙
### *Moonlit Terminal AI Coding Assistant*

> **Single File · Zero Dependencies · Node 18+ · Multi-Provider · Surgical Code Editing**

```
  ██╗     ██╗   ██╗ ███╗   ██╗ █████╗ ██████╗ 
  ██║     ██║   ██║ ████╗  ██║██╔══██╗██╔══██╗
  ██║     ██║   ██║ ██╔██╗ ██║███████║██████╔╝
  ██║     ██║   ██║ ██║╚██╗██║██╔══██║██╔══██╗
  ███████╗╚██████╔╝ ██║ ╚████║██║  ██║██║  ██║
  ╚══════╝ ╚═════╝  ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝
```

---

## ✦ Highlights

- **🌑 Complete Single File**: The entire agent lives in `lunar.mjs`. Zero `node_modules` required, zero build steps, zero external dependencies.
- **✨ Moonlit Aesthetic**: Real-time astronomical moon phase calculation (🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘), lavender/starlight terminal glow, structured panels, live streaming markdown, and colored code diffs.
- **⚡ Broad Provider Intelligence**:
  - **9Router**: Automatic local SQLite vault key discovery and connection on port 20128.
  - **Ollama**: Zero-key local model discovery (e.g. `gemma4:gpu`, `qwen2.5-coder`).
  - **OpenRouter**: Auto-detects credentials, with out-of-the-box free models (`nvidia/nemotron-3.5-lightning:free`, `liquid/lfm-2.5-2.6b:free`, etc.) and frontier reasoning models.
  - **OpenAI & Anthropic**: Native function calling and Anthropic Messages API support.
  - **Groq & DeepSeek & LM Studio & Custom Endpoints**.
- **🛠️ Surgical Tool Calling**: Native JSON tool calls and fallback XML `<lunar_tool>` streaming:
  - `read`: Line-numbered source reading with pagination.
  - `write`: Safe file creation with auto-directory generation and undo checkpoints.
  - `edit`: Exact string replacements with visual red/green terminal diffs.
  - `list`: Recursive glob-aware directory scanning respecting `.lunarignore` and `.gitignore`.
  - `grep`: Fast regular expression and keyword search.
  - `bash`: Safe shell execution with destructive command protection.
  - `fetch`: Web documentation scraper stripping HTML to clean markdown.
  - `todos`: Dynamic checklist tracker.
- **🛡️ Checkpoint & Undo Engine**: Every file change is snapshotted before modification. Type `/undo` in the REPL or CLI to immediately revert!
- **🎭 6 Adaptive Personas**: `vibe` (momentum pair-programmer), `architect` (systems design), `debug` (scientific root-cause hunt), `teach` (walkthroughs), `plan` (read-only blueprinting), and `review` (findings-first auditor).

---

## 🚀 Quickstart

Run directly using Node 18+:

```bash
# Launch interactive moonlit REPL
node lunar.mjs

# Or use the convenience wrappers:
./lunar          # Linux/macOS
lunar.cmd        # Windows
npm start        # npm
```

Run one-shot tasks directly from your shell:

```bash
# Ask a quick question
node lunar.mjs ask "How do WebSockets work in Node?"

# Plan a feature (read-only codebase exploration)
node lunar.mjs plan "Add JWT authentication"

# Implement a change surgically
node lunar.mjs implement "Refactor error handling in server.js"

# Comprehensive code review with findings first
node lunar.mjs review src/

# Explain a file's role and architecture
node lunar.mjs explain lunar.mjs
```

---

## 🩺 System Diagnostics (`doctor`)

Check your runtime, providers, models, local gateways, and API connectivity in one glance:

```bash
node lunar.mjs doctor
```

Output:
```
  ☾ LUNAR  🌘  moonlit coding agent  v2.2.0

  ─── LUNAR SYSTEM & CONNECTIVITY DIAGNOSTICS ───

  ╭─ [LUNAR HEALTH MATRIX] ──────────────────────────────────────────────────╮
  │  Node Runtime     v26.5.0 (win32 x64)                                    │
  │  Config File      C:\Users\David\.lunar\config.json                      │
  │  Active Provider  openrouter                                             │
  │  Active Model     nvidia/nemotron-3.5-lightning:free                     │
  │  Base URL         https://openrouter.ai/api/v1                           │
  │  9Router Gateway  online (137 models advertised)                         │
  │  Ollama Local     online [gemma4:gpu]                                    │
  │  API Key          sk-o…8c00 (73 chars)                                   │
  │  Model Test Ping  200 OK (ready to code!)                                │
  │  Workspace Guide  LUNAR.md present                                       │
  │                                                                          │
  ╰─ All systems nominal. Ready for orbit. ──────────────────────────────────╯
```

---

## ⚙️ Interactive Setup & Management

Configure providers, keys, and models interactively:

```bash
# Interactive setup wizard
node lunar.mjs setup

# Switch active provider
node lunar.mjs providers

# Switch or browse models
node lunar.mjs models

# Lifetime token metrics and cost estimation
node lunar.mjs stats

# Initialize LUNAR.md project guidelines
node lunar.mjs init
```

---

## 💬 Interactive REPL & Slash Commands

When you run `node lunar.mjs`, you enter the moonlit REPL:

```
  ☾ lunar › Can you add input validation to the login route?
```

### Slash Commands
- `/help`, `/?` — Show command reference and keybindings
- `/mode <persona>` — Switch persona (`vibe`, `architect`, `debug`, `teach`, `plan`, `review`)
- `/permission <mode>` — Set permission gate (`ask`, `auto`, `plan`, `yolo`)
- `/provider` — Select or switch active AI provider
- `/model` — Select or switch active model
- `/undo` — Rollback the last file edit
- `/stats` — Display orbit token usage and estimated cost
- `/doctor` — Run connectivity diagnostics
- `/clear` — Clear terminal screen
- `/exit`, `/quit` — Exit orbit

### REPL Shortcuts
- `@<filepath>` — Attach file contents into your prompt (e.g. `Can you review @src/auth.js?`)
- `!<command>` — Run a shell command immediately (e.g. `!git status`)

---

## 🔐 Permission Modes

| Mode | Behavior |
| :--- | :--- |
| `ask` *(default)* | Shows colored diffs and prompts before writing or executing commands |
| `auto` | Auto-approves file writes/edits; prompts for bash commands |
| `plan` | Read-only mode; write and bash tools are disabled |
| `yolo` | Runs all tools automatically without interruption |

Pass via CLI flag: `--permission-mode auto` or `-y`.

---

## 📁 Repository Structure

```
Lunar/
├── lunar.mjs      # The entire agent in ONE clean file
├── lunar          # Linux/macOS executable wrapper
├── lunar.cmd      # Windows executable wrapper
├── package.json   # Package metadata and scripts
├── LICENSE        # MIT License
├── LUNAR.md       # Project guide and instructions
├── .lunarignore   # Patterns ignored during file searches
└── README.md      # Documentation
```

---

## 📜 License

MIT © LUNAR Contributors
