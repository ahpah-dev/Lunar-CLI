# LUNAR

```
  _    _   _ _   _    _    ____
 | |  | | | | \ | |  / \  |  _ \
 | |  | | | |  \| | / _ \ | |_) |
 | |__| |_| | |\  |/ ___ \|  _ <
 |_____\___/|_| \_/_/   \_\_| \_\
```

**LUNAR is a lunar-themed agentic coding CLI** — an OpenCode-class assistant that
reads your codebase, edits files, runs commands, and verifies its work, all from
your terminal. Moon palette, 3D banner, real moon-phase header, zero native
dependencies.

- Agentic loop with streaming + real tool-calling (Anthropic, OpenAI-compatible, Ollama, …)
- 13 built-in tools, allow/ask/deny permissions with glob rules
- Build / plan modes, subagents, skills, custom commands, MCP servers, hooks
- Sessions with resume, fork, undo/redo, auto-compaction, cost tracking
- Interactive TUI and headless `run` for scripts and CI

---

## Contents

1. [Requirements](#requirements)
2. [Install](#install)
3. [Quickstart](#quickstart)
4. [Interactive TUI](#interactive-tui)
5. [Headless mode](#headless-mode)
6. [Configuration](#configuration)
7. [Providers & models](#providers--models)
8. [Tools](#tools)
9. [Permissions](#permissions)
10. [Agents](#agents)
11. [Sessions & safety](#sessions--safety)
12. [Memory](#memory)
13. [Skills, commands, MCP, hooks](#skills-commands-mcp-hooks)
14. [CLI reference](#cli-reference)
15. [Website](#website)
16. [Project structure](#project-structure)
17. [Troubleshooting](#troubleshooting)
18. [License](#license)

---

## Requirements

- **Node.js ≥ 18**
- An API key for at least one provider (or a local Ollama)

## Install

The package is not on npm yet — install from source:

```bash
git clone https://github.com/ahpah-dev/Lunar-CLI.git
cd Lunar-CLI
npm install
npm link        # exposes `lunarcode` on your PATH
```

Or run it in place without linking:

```bash
node bin/lunarcode.mjs
```

Check it works:

```bash
lunarcode --version   # 3.0.0
lunarcode doctor      # diagnoses keys, memory, skills, MCP
```

## Quickstart

```bash
cd your-project
export ANTHROPIC_API_KEY="sk-ant-..."   # or OPENAI_API_KEY, etc.

lunarcode init     # creates AGENTS.md + lunar.json
lunarcode          # start coding
```

Then just talk to it:

```
☾ read src/ and explain how auth works
☾ add a /health endpoint with tests, then run the suite
☾ review git diff for bugs, don't commit anything
```

Lunar plans, reads, edits, runs commands, and verifies — asking for approval
when your permission rules say so.

---

## Interactive TUI

Running `lunarcode` opens the session: 3D banner, live moon phase, model/agent/cost
status line. Everything streams token-by-token with markdown rendering.

### Prompt extras

| Syntax    | Effect                                            |
|-----------|---------------------------------------------------|
| `@path`   | Attach a file or directory (`@src/app.ts`, `@docs/`) with Tab completion |
| `!cmd`    | Run a shell command inline, output joins the chat |
| `Tab`     | Cycle primary agents (build ↔ plan ↔ custom)       |
| `Ctrl+X` then key | Leader shortcuts (see below)              |
| `Esc`     | Interrupt the running agent                       |

### Leader shortcuts (`Ctrl+X`, then…)

| Key | Action        | Key | Action        |
|-----|---------------|-----|---------------|
| `q` | quit          | `l` | sessions      |
| `n` | new session   | `u` | undo          |
| `r` | redo          | `c` | compact       |
| `m` | models        | `t` | themes        |
| `x` | export        | `e` | tool details  |
| `h` | help          | `s` | stats         |

### Slash commands

| Command       | Description                              |
|---------------|------------------------------------------|
| `/help`       | Command + shortcut reference             |
| `/init`       | Create `AGENTS.md` + `lunar.json`        |
| `/models`     | Providers and key status                 |
| `/model <m>`  | Switch model (`provider/model`)          |
| `/agent [a]`  | List or switch agents                    |
| `/plan`       | Read-only planning mode                  |
| `/build`      | Full-access build mode                   |
| `/new`        | Fresh session                            |
| `/sessions`, `/resume <id>` | List / resume past sessions |
| `/fork`       | Branch the current session               |
| `/undo`, `/redo` | Revert / restore file changes         |
| `/compact`    | Summarize context now                    |
| `/clear`      | Clear the screen                         |
| `/stats`      | Tokens, cost, message counts             |
| `/export`, `/share` | Save transcript to markdown       |
| `/thinking`   | Toggle reasoning-block display           |
| `/details`    | Toggle full tool output                  |
| `/remember <fact>` | Save to long-term memory           |
| `/memory`     | Show loaded project memory               |
| `/skills`, `/commands` | List skills / custom commands   |
| `/mcp`        | MCP server status                        |
| `/themes`     | Theme info                               |
| `/exit`       | Quit (aliases: `/quit`, `/q`)            |

Any `.lunar/commands/*.md` file automatically becomes a `/command` too
(see [Skills, commands, MCP, hooks](#skills-commands-mcp-hooks)).

### Approvals

When a tool needs approval you get:

```
◈ permission required — bash
    npm run deploy
    [y] once  [a] always  [n] reject
```

- **y / once** — allow just this call
- **a / always** — allow matching calls for the rest of the session
- **n / reject** — deny; the agent reroutes

---

## Headless mode

`run` executes one prompt without the TUI — for scripts, hooks, and CI:

```bash
lunarcode run "summarize what changed in git diff" -y
lunarcode run "find dead code in src/" --model ollama/gemma4:gpu --auto
lunarcode run "audit deps" --format json > audit.json
```

Useful flags:

| Flag | Effect |
|------|--------|
| `-y, --auto` | Auto-allow anything not explicitly denied |
| `--model <provider/model>` | Override the model |
| `--agent <name>` | Override the agent |
| `--format text\|json` | `json` emits `{text, session, model, agent, usage}` |
| `-s, --session <id>` | Continue a session |
| `-c, --continue` | Continue the most recent session |

Piping works both ways:

```bash
tail -200 app.log | lunarcode run "flag any anomalies" -y
git diff main --name-only | lunarcode run "review these for security issues" -y
```

Tool calls go to stderr, the final answer to stdout — safe to pipe.

---

## Configuration

Lunar merges `lunar.json` from multiple locations (later wins on conflicts,
everything else merges):

1. Global: `~/.config/lunar/lunar.json` (or `%APPDATA%\lunar` on Windows)
2. `LUNAR_CONFIG` env var path (optional override file)
3. Project: `./lunar.json` (found by walking up to `.git`)
4. `LUNAR_CONFIG_CONTENT` env var (inline JSON, highest precedence)

`{env:VAR_NAME}` anywhere in config is replaced from the environment — the safe
way to inject keys:

```jsonc
{
  "$schema": "https://lunar.sh/lunar.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  "default_agent": "build",
  "subagent_depth": 1,
  "max_steps": 80,
  "shell": null,
  "permission": {
    "edit": "ask",
    "bash": { "*": "ask", "git *": "allow", "rm -rf *": "deny" }
  },
  "provider": {
    "anthropic": { "apiKey": "{env:ANTHROPIC_API_KEY}" }
  },
  "instructions": ["CONTRIBUTING.md", "docs/*.md"],
  "mcp": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  },
  "hooks": {
    "post_edit": ["npx prettier --write {file}"]
  }
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `model` | `anthropic/claude-sonnet-4-5` | Main model as `provider/model` |
| `small_model` | `anthropic/claude-haiku-4-5` | Model for compaction/summaries |
| `default_agent` | `build` | Agent used when none is specified |
| `subagent_depth` | `1` | How deep `task` subagents may nest |
| `max_steps` | `80` | Agentic iterations before forced stop |
| `shell` | OS default | Shell for `bash` (`cmd.exe` on Windows) |
| `permission` | `{}` (allow) | See [Permissions](#permissions) |
| `tools` | `{}` | `{ "write": false }` disables a tool |
| `provider` | `{}` | Per-provider `kind`, `baseURL`, `apiKey` |
| `model_prices` | built-in table | `{"my-model": [in$/1M, out$/1M]}` overrides |
| `mcp` | `{}` | MCP servers (stdio + remote) |
| `agent` | `{}` | Custom agents |
| `command` | `{}` | Custom commands (`template`, `description`, `agent`, `model`) |
| `hooks` | `{}` | Event → shell commands |
| `instructions` | `[]` | Extra memory files (paths/globs) |
| `disabled_providers` / `enabled_providers` | `[]` | Provider allow/deny lists |
| `compaction.auto` | `true` | Auto-summarize when context fills |

Inspect the merged result anytime: `lunarcode config`.

---

## Providers & models

| Provider | Kind | Key env var | Default endpoint |
|----------|------|-------------|------------------|
| `anthropic` | native | `ANTHROPIC_API_KEY` | `https://api.anthropic.com` |
| `openai` | OpenAI-compatible | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| `ollama` | OpenAI-compatible | none (local) | `http://localhost:11434/v1` |
| `openrouter` | OpenAI-compatible | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| `groq` | OpenAI-compatible | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` |
| `together` | OpenAI-compatible | `TOGETHER_API_KEY` | `https://api.together.xyz/v1` |
| `deepseek` | OpenAI-compatible | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/v1` |
| `xai` | OpenAI-compatible | `XAI_API_KEY` | `https://api.x.ai/v1` |

Any OpenAI-compatible endpoint works:

```jsonc
{ "provider": {
    "lmstudio": { "kind": "openai", "baseURL": "http://localhost:1234/v1", "apiKey": "x" }
} }
```

```bash
lunarcode --model ollama/gemma4:gpu
lunarcode --model lmstudio/qwen3-8b
```

`lunarcode models` shows every provider with key status. Token usage and
estimated cost are tracked per session (`/stats`, `lunarcode stats`).

---

## Tools

| Tool | Does | Key params |
|------|------|------------|
| `read` | Read files with line numbers | `path`, `offset`, `limit` |
| `write` | Create/overwrite files (mkdirs) | `path`, `content` |
| `edit` | Exact unique-string replacement | `path`, `old_string`, `new_string` |
| `apply_patch` | Multi-file patch with `*** Add/Update/Delete File:` markers | `patch` |
| `bash` | Shell commands (git, npm, tests…) | `command`, `timeout`, `description` |
| `glob` | Find files (`**/*.ts`), newest first | `pattern`, `path` |
| `grep` | Regex content search → `file:line` | `pattern`, `include`, `path` |
| `list` | List a directory | `path` |
| `todowrite` | Session todo list (one `in_progress`) | `todos[]` |
| `webfetch` | URL → readable text | `url`, `maxChars` |
| `skill` | Load a skill's instructions | `name` |
| `task` | Delegate to a subagent, get a summary | `description`, `prompt`, `agent` |
| `question` | Ask you a multiple-choice question | `questions[]` |

Search tools respect `.gitignore` and skip `node_modules`/`.git`/build output.

---

## Permissions

Every tool call resolves to **allow**, **ask**, or **deny**:

```jsonc
{ "permission": {
    "*": "ask",
    "bash": { "*": "ask", "git *": "allow", "npm test": "allow", "rm -rf *": "deny" },
    "edit": { "*": "ask", "docs/**": "allow" },
    "read": { "*.env": "deny", "*.env.example": "allow" },
    "webfetch": "allow"
} }
```

Rules that matter:

- **Last matching rule wins** — put the `"*"` catch-all first, specifics after.
- `*` matches anything, `?` matches one char. `~`/`$HOME` expand to your home.
- `edit` covers `write` and `apply_patch`; each can still be set separately.
- `read` defaults to allow, but `.env` files are denied (except `.env.example`).
- `external_directory` gates absolute paths outside the workspace (default: ask).
- `doom_loop` fires when the agent repeats an identical call 3× (default: ask —
  the loop breaks with a nudge; `deny` stops it cold).
- Agent-level `permission` tables override globals for that agent.
- **Plan mode** denies all mutations (`write`, `edit`, `apply_patch`, `bash`).
- `lunarcode run -y` / `--auto` auto-allows anything not explicitly denied.

---

## Agents

Built-ins:

| Agent | Mode | Description |
|-------|------|-------------|
| `build` | primary | Default. Full tools, makes and verifies changes |
| `plan` | primary | Read-only. Explores and writes a step-by-step plan |
| `general` | subagent | Research + multi-step work, full tools |
| `explore` | subagent | Fast read-only codebase search |

Switch with `Tab`, `/agent <name>`, `/plan`, `/build`, `--agent`, or invoke a
subagent with `@general …` / the `task` tool. `subagent_depth` caps nesting.

Custom agents — markdown with frontmatter (project `.lunar/agents/` or global
`~/.config/lunar/.lunar/agents/`):

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-haiku-4-5
temperature: 0.2
---
You are in code review mode. Focus on:
- Bugs, edge cases, security implications
- Constructive feedback without making changes
```

Frontmatter fields: `description`, `mode` (`primary`/`subagent`), `model`,
`temperature`, `tools` (comma list), `steps`. The same shape works in
`lunar.json` under `agent`, plus a nested `permission` table:

```jsonc
{ "agent": {
    "review": { "description": "...", "mode": "subagent",
                "permission": { "edit": "deny", "bash": "deny" } }
} }
```

---

## Sessions & safety

Sessions persist as JSONL in `~/.lunar/sessions/` — every message, tool call,
and token count survives restarts.

- **Resume:** `lunarcode --continue`, `-s <id>`, `/resume <id>`, `/sessions`
- **Fork:** `/fork` branches the conversation into a new session id
- **Undo/redo:** `/undo` reverts the last batch of file changes from snapshots
  (repeat to go further back), `/redo` restores — or Ctrl+X `u` / `r`
- **Compaction:** context auto-summarizes past ~100k tokens (preserving goals,
  decisions, todos); `/compact` forces it anytime
- **Share/export:** `/share`, `/export`, `lunarcode share [id]` write a markdown
  transcript next to the project
- **Stats:** token counts + estimated cost per session and globally

---

## Memory

The agent loads, in order:

1. `~/.lunar/MEMORY.md` — learnings saved across projects (`/remember <fact>`)
2. `./AGENTS.md` + `./LUNAR.md` — project conventions (commit these)
3. `instructions` globs from `lunar.json` (e.g. `docs/*.md`)

`lunarcode init` scaffolds `AGENTS.md` with Overview / Commands / Conventions /
Architecture sections — fill in your build, test, and lint commands so the
agent verifies its own work. `/memory` shows exactly what loaded.

---

## Skills, commands, MCP, hooks

Directory layout (project `.lunar/` first, then global, then `LUNAR_CONFIG_DIR`):

```
.lunar/
  skills/<name>/SKILL.md   # frontmatter: name, description + markdown body
  commands/<name>.md       # custom /command, $ARGUMENTS for args
  agents/<name>.md         # custom agents (see above)
```

`SKILL.md` example:

```markdown
---
name: review-pr
description: Review the current diff for quality and correctness
---
Check for: logic errors, missing tests, security issues, style drift.
Quote file:line for every finding. Suggest fixes, don't apply them.
```

The agent loads skills on demand via the `skill` tool; `/skills` and
`/commands` list what's available.

**MCP servers** (`lunar.json`):

```jsonc
{ "mcp": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "jira": { "type": "remote", "url": "https://jira.example.com/mcp",
              "headers": { "Authorization": "Bearer {env:JIRA_TOKEN}" } }
} }
```

MCP tools appear as `server_tool` (e.g. `context7_resolve-library-id`) and obey
the same permission system (`"context7_*": "ask"`). `/mcp` and
`lunarcode mcp` show connection status. Set `"enabled": false` to skip one.

**Hooks** run shell commands on agent events:

```jsonc
{ "hooks": {
    "session_start": ["echo session started >> lunar.log"],
    "post_edit": [{ "command": "npx prettier --write", "timeout": 15000 }],
    "post_tool": ["notify-send lunar done"]
} }
```

Events: `session_start`, `session_end`, `prompt_submit`, `pre_tool`,
`post_tool`, `post_edit`. Each receives JSON on stdin.

---

## CLI reference

```
lunarcode [project] [--model m] [--agent a] [-c] [-s id] [--auto]
```

| Command | Description |
|---------|-------------|
| *(none)* | Open the interactive TUI (optional project dir) |
| `run [msg…]` | Headless run (`--format text\|json`, `-y`, `--model`, `--agent`, `-s`, `-c`) |
| `init` | Scaffold `AGENTS.md` + `lunar.json` |
| `sessions [--format table\|json]` | List sessions |
| `models [provider] [--verbose]` | Providers + key status |
| `config` | Print merged config |
| `doctor` | Diagnose keys, memory, skills, MCP |
| `mcp` | MCP server status |
| `share [id]` | Export session to markdown |
| `stats` | Global token/cost totals |
| `agent [name]` | List agents / show one |
| `phase` | Tonight's moon |
| `vibe` | A vibe-coding blessing |
| `dashboard` | Moon dashboard + command map |

---

## Website

`website/` is a static lunar-themed landing page (deployed on Vercel from this
repo). It is independent of the CLI — the CLI never reads it, and it never
imports the CLI.

---

## Project structure

```
bin/lunarcode.mjs   # executable entry
src/
  cli.mjs           # commander wiring, all commands
  tui.mjs           # interactive session: streaming, completions, keybinds
  agent.mjs         # agentic loop: approvals, subagents, compaction, doom-guard
  providers.mjs     # Anthropic + OpenAI-compatible streaming + tool-calling
  tools.mjs         # the 13 built-in tools
  permissions.mjs   # allow/ask/deny + glob rules
  session.mjs       # JSONL store, snapshots, undo/redo, export
  memory.mjs        # AGENTS.md / instructions / auto-memory
  agents.mjs        # built-in + custom agents, skills/commands loaders
  mcp.mjs           # MCP stdio + remote clients, hooks runner
  config.mjs        # layered lunar.json loading
  theme.mjs         # moon palette, 3D banner, renderers
  moon.mjs          # moon-phase math
  moonArt.mjs       # moon renderer
website/            # static landing page (Vercel)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No API key for "x"` | Set the env var (`lunarcode models` shows which) or add `provider.x.apiKey` |
| `Model request failed: … 404` | That model id doesn't exist on the provider — pick one from `lunarcode models` |
| `ollama … connection refused` | Start Ollama (`ollama serve`) and `ollama pull <model>` |
| Tools all denied | Check `permission` in `lunarcode config`; plan mode denies edits (`/build` to exit) |
| `/undo` says nothing to undo | Snapshots cover `write`/`edit`/`apply_patch` in the current session only |
| Context feels lost mid-session | Run `/compact`; move persistent rules into `AGENTS.md` |
| `lunarcode doctor` | Runs all of the above checks for you |

---

## License

MIT — see [LICENSE](LICENSE).
