import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { runAgent, compactNow } from './agent.mjs';
import { Session } from './session.mjs';
import { banner3D, moonHeader, c, glow, divider, toolCallLine, toolResultLine, permissionPrompt, helpDialog, statusLine, sessionLine, pad, P } from './theme.mjs';
import { expandCommand, resolveAgent } from './agents.mjs';
import { appendMemory, initProject, loadMemory } from './memory.mjs';
import { listProviders } from './providers.mjs';

// ── Commands registry ──
const COMMANDS = [
  ['/help', 'Show this help', null],
  ['/init', 'Create AGENTS.md + lunar.json', null],
  ['/models', 'List available models', 'ctrl+x m'],
  ['/model [m]', 'Show or switch model', null],
  ['/agent [name]', 'Show or switch agent', 'tab'],
  ['/plan', 'Switch to plan mode (read-only)', 'tab'],
  ['/build', 'Switch to build mode', 'tab'],
  ['/new', 'Start a new session', 'ctrl+x n'],
  ['/sessions', 'List/resume sessions', 'ctrl+x l'],
  ['/resume <id>', 'Resume a session', null],
  ['/fork', 'Fork current session', null],
  ['/undo', 'Revert last file changes', 'ctrl+x u'],
  ['/redo', 'Redo undone changes', 'ctrl+x r'],
  ['/compact', 'Compact conversation context', 'ctrl+x c'],
  ['/clear', 'Clear screen', null],
  ['/stats', 'Show token usage and cost', null],
  ['/export', 'Export session to markdown', 'ctrl+x x'],
  ['/thinking', 'Toggle thinking display', null],
  ['/details', 'Toggle tool execution details', null],
  ['/remember <fact>', 'Save to long-term memory', null],
  ['/memory', 'Show project memory', null],
  ['/skills', 'List available skills', null],
  ['/commands', 'List custom commands', null],
  ['/mcp', 'Show MCP server status', null],
  ['/share', 'Export to file for sharing', null],
  ['/themes', 'Show theme info', null],
  ['/exit', 'Quit', 'ctrl+x q'],
];

function completer(extensions, line) {
  const parts = line.split(/\s+/);
  const last = parts[parts.length - 1] ?? '';

  // Slash commands
  if (last.startsWith('/')) {
    const names = [...COMMANDS.map(([cmd]) => cmd.split(' ')[0]), ...(extensions?.commands ?? []).map((cm) => `/${cm.name}`)];
    return [names.filter((n) => n.toLowerCase().startsWith(last.toLowerCase())), last];
  }

  // @ file references
  if (last.startsWith('@')) {
    try {
      const frag = last.slice(1);
      const dir = path.dirname(frag) === '.' ? '' : path.dirname(frag);
      const base = path.basename(frag);
      const searchDir = dir || '.';
      const entries = fs.readdirSync(searchDir, { withFileTypes: true });
      const hits = entries
        .filter((e) => e.name.startsWith(base) || (frag.includes('/') && e.name === base))
        .slice(0, 30)
        .map((e) => `@${dir ? dir + '/' : ''}${e.name}${e.isDirectory() ? '/' : ''}`);
      return [hits, last];
    } catch { return [[], last]; }
  }

  return [[], last];
}

// ── Expand @file references in prompt ──
async function expandRefs(cwd, text) {
  const refs = [...text.matchAll(/@([^\s@][^\s]*)/g)].map((m) => m[1]);
  if (!refs.length) return text;
  const chunks = [];
  for (const ref of refs) {
    const full = path.resolve(cwd, ref);
    try {
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        const files = fs.readdirSync(full).slice(0, 30);
        chunks.push(`@${ref}/ (directory listing):\n${files.join('\n')}`);
      } else {
        const content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n').slice(0, 300).map((l, i) => `${i + 1}: ${l}`).join('\n');
        chunks.push(`@${ref}:\n${lines}`);
      }
    } catch {
      chunks.push(`@${ref}: (not found)`);
    }
  }
  return `${text}\n\n<attached_files>\n${chunks.join('\n\n')}\n</attached_files>`;
}

// ── Streaming markdown renderer ──
// Buffers partial lines so inline styles never render mid-token,
// and tracks ``` fences across lines so code blocks stay styled.
function renderInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, t) => c.bold(t))
    .replace(/`([^`]+)`/g, (_, t) => c.info(t))
    .replace(/^(#{1,4}\s+.+)$/, (_, t) => c.moonlight.bold(t))
    .replace(/^\s*[-*]\s+/, () => c.starlight('  • '))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => `${c.info(txt)} ${c.dim(`(${url})`)}`);
}

function createStreamRenderer(write) {
  let buf = '';
  let inFence = false;

  const renderLine = (line) => {
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        write(`\n${c.dim(`┌───${fence[1] || 'code'}───`)}\n`);
      } else {
        inFence = false;
        write(`${c.dim('└───────')}\n`);
      }
      return;
    }
    if (inFence) write(`│ ${c.info(line)}\n`);
    else write(`${renderInline(line)}\n`);
  };

  return {
    push(chunk) {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        renderLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    },
    flush() {
      if (inFence) {
        if (buf) write(`│ ${c.info(buf)}\n`);
        write(`${c.dim('└───────')}\n`);
      } else if (buf) {
        write(`${renderInline(buf)}\n`);
      }
      buf = '';
      inFence = false;
    },
  };
}

// ── Main TUI ──
export async function startTUI(env) {
  const { config, root: cwd, extensions, hooks, mcpServers } = env;

  let session = new Session(env.resumeId);
  await session.load();
  session.meta.model = session.meta.model || env.model;
  session.meta.agent = session.meta.agent || env.agent;

  let mode = session.meta.agent === 'plan' ? 'plan' : 'build';
  let currentAgent = session.meta.agent;
  let model = session.meta.model;
  let showThinking = false;
  let showDetails = false;
  let busy = false;
  let history = [];
  let historyIdx = -1;

  // ── Startup banner ──
  console.log();
  console.log('  ' + banner3D());
  console.log();
  console.log(divider(56));
  console.log(moonHeader());
  console.log(divider(56));
  console.log();
  console.log(statusLine({ model, agent: currentAgent, session: session.id.slice(0, 8), cost: session.meta.cost, mode }));
  console.log(c.dim('  /help for commands · @file to attach · !cmd for shell · Tab to switch agent · Ctrl+X leader'));
  console.log();

  await hooks.run('session_start', { session: session.id });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line) => completer(extensions, line),
  });

  const promptStr = () => (mode === 'plan' ? `${c.warning('☾?')}` : `${c.moonlight('☾')}`) + ' ';
  const safePrompt = () => {
    if (!rl.closed) {
      rl.setPrompt(promptStr());
      rl.prompt();
    }
  };

  const ask = (q) => new Promise((res) => rl.question(q, res));

  // ── Permission approval ──
  const approve = async (call, patterns) => {
    console.log();
    console.log(permissionPrompt(call.name, call.arguments));
    const ans = (await ask(`    `)).trim().toLowerCase();
    if (ans === 'a' || ans === 'always') return 'always';
    if (ans === 'n' || ans === 'no' || ans === 'r' || ans === 'reject') return 'deny';
    return 'allow';
  };

  // ── Question tool ──
  const onQuestion = async (questions) => {
    const answers = [];
    for (const q of questions) {
      console.log();
      console.log(c.bold(`  ◈ ${q.header}`));
      console.log(`  ${q.question}`);
      q.options.forEach((o, i) => console.log(`    ${c.starlight(`${i + 1})`)} ${o.label} ${c.dim(o.description ?? '')}`));
      const raw = await ask(c.dim('    pick (number) or type: '));
      const n = parseInt(raw.trim(), 10);
      answers.push(n >= 1 && n <= q.options.length ? q.options[n - 1].label : raw.trim());
    }
    return `User answers:\n${questions.map((q, i) => `- ${q.header}: ${answers[i]}`).join('\n')}`;
  };

  // ── Run a prompt through the agent ──
  let aborter = null;

  const runPrompt = async (rawPrompt) => {
    busy = true;
    aborter = new AbortController();
    const prompt = await expandRefs(cwd, rawPrompt);
    const stream = createStreamRenderer((s) => process.stdout.write(s));

    let textStarted = false;
    const startText = () => {
      if (!textStarted) { process.stdout.write('\n'); textStarted = true; }
    };
    const events = {
      onText: (d) => { startText(); stream.push(d); },
      onThinking: (d) => {
        if (showThinking) { startText(); process.stdout.write(c.dim(d)); }
      },
      onToolStart: (call) => {
        stream.flush();
        if (textStarted) process.stdout.write('\n');
        textStarted = false;
        console.log(toolCallLine(call.name, call.arguments));
      },
      onToolResult: (call, out, verdict) => {
        if (showDetails) console.log(toolResultLine({ output: out }));
        else console.log(`  ${c.dim('└')} ${c.dim(String(out).split('\n')[0].slice(0, 100) || 'done')}`);
      },
      onUsage: () => {},
      askApproval: approve,
      onQuestion,
    };

    try {
      const r = await runAgent({
        prompt, session, config, cwd, extensions, hooks, mcpServers,
        agentName: mode === 'plan' ? 'plan' : currentAgent,
        modelStr: model, events, interactive: true, signal: aborter.signal,
      });
      stream.flush();
      if (r.text) console.log();
      session.meta.model = model;
      session.meta.agent = mode === 'plan' ? 'plan' : currentAgent;
      await session.saveMeta();
    } catch (err) {
      stream.flush();
      console.log();
      if (err.name === 'AbortError' || aborter.signal.aborted) {
        console.log(c.warning('  ✦ interrupted'));
      } else {
        console.log(c.error(`  ✦ ${err.message}`));
        console.log(c.dim('  (check /models and lunar.json configuration)'));
      }
      console.log();
    }
    aborter = null;

    // Status footer
    console.log(c.dim(`  ── ${statusLine({ model, agent: currentAgent, session: session.id.slice(0, 8), cost: session.meta.cost, mode })}`));
    console.log();
    busy = false;
  };

  // ── Command handlers ──
  const cmd = {
    help() { console.log(helpDialog(COMMANDS)); },

    init() {
      const created = initProject(cwd);
      console.log(created.length ? c.success(`  ✦ created: ${created.join(', ')}`) : c.dim('  already initialized'));
      console.log();
    },

    async models() {
      const providers = listProviders(config);
      console.log();
      for (const p of providers) {
        console.log(`  ${c.starlight(pad(p.id, 16))} ${c.dim(pad(p.kind, 10))} ${p.hasKey ? c.success('● key') : c.dim('○ no key')} ${c.dim(p.baseURL)}`);
      }
      console.log();
      console.log(c.dim(`  current: ${model}`));
      console.log(c.dim('  switch: /model <provider/model> or --model flag'));
      console.log();
    },

    async model(arg) {
      if (!arg) {
        console.log();
        console.log(c.dim(`  model: ${model}`));
        console.log(c.dim('  usage: /model <provider/model>  (see /models)'));
        console.log();
        return;
      }
      model = arg;
      session.meta.model = model;
      await session.saveMeta();
      console.log(c.success(`  ✦ model → ${model}`));
      console.log();
    },

    async agent(arg) {
      if (!arg) {
        const agents = extensions.primaryAgents();
        console.log();
        console.log(`  current: ${c.starlight(currentAgent)} ${c.dim(`(${mode})`)}`);
        for (const a of agents) console.log(`    ${c.starlight(pad(a.name, 16))} ${c.dim(a.description ?? '')}`);
        console.log();
        return;
      }
      if (arg === 'plan' || arg === 'build') { mode = arg; console.log(c.success(`  ✦ mode → ${mode}`)); console.log(); return; }
      const a = extensions.getAgent(arg);
      if (a) {
        currentAgent = arg;
        mode = resolveAgent(arg, extensions).mode === 'plan' ? 'plan' : 'build';
        console.log(c.success(`  ✦ agent → ${arg} (${mode})`));
      } else {
        console.log(c.error(`  unknown agent: ${arg}`));
      }
      console.log();
    },

    plan() { mode = 'plan'; currentAgent = 'plan'; console.log(c.success('  ✦ plan mode')); console.log(); },
    build() { mode = 'build'; currentAgent = 'build'; console.log(c.success('  ✦ build mode')); console.log(); },

    async 'new'() {
      await session.saveMeta();
      session = new Session();
      await session.load();
      session.meta.model = model;
      session.meta.agent = currentAgent;
      console.clear();
      console.log();
      console.log('  ' + banner3D());
      console.log();
      console.log(statusLine({ model, agent: currentAgent, session: session.id.slice(0, 8), cost: 0, mode }));
      console.log();
    },

    async sessions() {
      const list = Session.list();
      console.log();
      if (!list.length) { console.log(c.dim('  no sessions')); console.log(); return; }
      for (const s of list.slice(0, 12)) {
        const cur = s.id === session.id ? c.moonlight(' ●') : '  ';
        console.log(`${cur} ${c.starlight(s.id)} ${c.dim(`${s.messages} msgs · $${s.cost.toFixed(4)} · ${s.title.slice(0, 40)}`)}`);
      }
      console.log(c.dim('  /resume <id> to load one'));
      console.log();
    },

    async resume(id) {
      if (!id) { console.log(c.dim('  usage: /resume <id>')); console.log(); return; }
      session = new Session(id);
      await session.load();
      model = session.meta.model || model;
      currentAgent = session.meta.agent || currentAgent;
      console.log(c.success(`  ✦ resumed ${id} (${session.messages.length} messages)`));
      console.log();
    },

    async fork() {
      const f = new Session();
      for (const m of session.messages) await f.persist({ ...m });
      f.messages = [...session.messages];
      f.meta = { ...session.meta };
      await f.saveMeta();
      session = f;
      console.log(c.success(`  ✦ forked → ${session.id}`));
      console.log();
    },

    async undo() {
      const restored = await session.undo(cwd);
      console.log(restored.length ? c.success(`  ✦ reverted: ${restored.join(', ')}`) : c.dim('  nothing to undo'));
      console.log();
    },

    async redo() {
      const restored = await session.redo(cwd);
      console.log(restored.length ? c.success(`  ✦ restored: ${restored.join(', ')}`) : c.dim('  nothing to redo'));
      console.log();
    },

    async compact() {
      try {
        const msg = await compactNow(session, config, { onText: (d) => process.stdout.write(c.dim(`  ${d}`)) });
        console.log(c.success(`  ✦ ${msg}`));
      } catch (err) {
        console.log(c.error(`  ✦ compact failed: ${err.message}`));
      }
      console.log();
    },
    clear() { console.clear(); },

    async stats() {
      const m = session.meta;
      console.log();
      console.log(`  ${c.starlight('session')}     ${session.id}`);
      console.log(`  ${c.starlight('model')}       ${m.model}`);
      console.log(`  ${c.starlight('agent')}       ${m.agent}`);
      console.log(`  ${c.starlight('messages')}     ${session.messages.length}`);
      console.log(`  ${c.starlight('input tokens')} ${m.inputTokens}`);
      console.log(`  ${c.starlight('output tokens')} ${m.outputTokens}`);
      console.log(`  ${c.starlight('cost')}         $${m.cost.toFixed(4)}`);
      console.log();
    },

    async export() {
      const md = session.exportMarkdown();
      const file = path.join(cwd, `.lunar-${session.id}.md`);
      fs.writeFileSync(file, md, 'utf-8');
      console.log(c.success(`  ✦ exported to ${file}`));
      console.log();
    },

    async thinking() {
      showThinking = !showThinking;
      console.log(c.dim(`  thinking display: ${showThinking ? 'on' : 'off'}`));
      console.log();
    },

    async details() {
      showDetails = !showDetails;
      console.log(c.dim(`  tool details: ${showDetails ? 'on' : 'off'}`));
      console.log();
    },

    async remember(arg) {
      if (!arg) { console.log(c.dim('  usage: /remember <fact>')); }
      else { appendMemory(arg); console.log(c.success('  ✦ remembered')); }
      console.log();
    },

    async memory() {
      const mem = loadMemory(cwd, config);
      console.log(mem || c.dim('  no memory. /init to create AGENTS.md'));
      console.log();
    },

    async skills() {
      console.log();
      if (!extensions.skills.length) console.log(c.dim('  no skills'));
      for (const s of extensions.skills) console.log(`  ${c.starlight(pad(s.name, 20))} ${c.dim(s.description)}`);
      console.log();
    },

    async commands() {
      console.log();
      if (!extensions.commands.length) console.log(c.dim('  no custom commands'));
      for (const cm of extensions.commands) console.log(`  ${c.starlight(pad('/' + cm.name, 20))} ${c.dim(cm.description)}`);
      console.log();
    },

    async mcp() {
      console.log();
      if (!mcpServers.length) console.log(c.dim('  no MCP servers'));
      for (const s of mcpServers) {
        if (s.error) console.log(`  ${c.dim(s.name)} ${c.error('✗ ' + s.error)}`);
        else console.log(`  ${c.starlight(s.name)} ${c.dim(`${s.tools?.length ?? 0} tools`)}`);
      }
      console.log();
    },

    async share() {
      const md = session.exportMarkdown();
      const file = path.join(cwd, `.lunar-share-${session.id}.md`);
      fs.writeFileSync(file, md, 'utf-8');
      console.log(c.success(`  ✦ exported to ${file}`));
      console.log();
    },

    async themes() {
      console.log();
      console.log(`  ${c.starlight('theme')}  ${config.theme ?? 'moon'}`);
      console.log(c.dim('  moon palette: cosmic → nebula → dusk → moonlight'));
      console.log();
    },

    exit() { rl.close(); },
    quit() { rl.close(); },
    q() { rl.close(); },
  };

  // Aliases
  const alias = { continue: cmd.sessions, c: cmd.compact };
  Object.assign(cmd, alias);

  // ── Main loop (serialized: rapid lines can't interleave async handlers) ──
  let chain = Promise.resolve();
  rl.on('line', (line) => {
    chain = chain.then(() => handleLine(line)).catch((err) => {
      console.log(c.error(`  ✦ ${err.message}`));
      console.log();
      safePrompt();
    });
  });

  const handleLine = async (line) => {
    if (busy) return;
    const raw = line.trim();
    if (!raw) { safePrompt(); return; }

    // !shell command
    if (raw.startsWith('!')) {
      const shellCmd = raw.slice(1).trim();
      console.log(c.dim(`  $ ${shellCmd}`));
      try {
        const { execSync } = await import('node:child_process');
        const out = execSync(shellCmd, { cwd, encoding: 'utf-8', timeout: 30000, shell: config.shell || undefined }).trim();
        console.log(out.slice(0, 5000));
      } catch (err) {
        console.log(c.error(`  ${err.stderr?.trim() || err.message}`));
      }
      console.log();
      safePrompt();
      return;
    }

    // /slash command
    if (raw.startsWith('/')) {
      const spaceIdx = raw.indexOf(' ');
      const name = (spaceIdx === -1 ? raw : raw.slice(0, spaceIdx)).slice(1);
      const args = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1).trim();

      // Custom command first
      const custom = extensions.getCommand(name);
      if (custom) {
        await runPrompt(expandCommand(custom, args));
      } else if (cmd[name]) {
        await cmd[name](args);
      } else {
        console.log(c.dim(`  unknown /${name} — try /help`));
        console.log();
      }
      safePrompt();
      return;
    }

    // Normal prompt → agent
    history.push(raw);
    historyIdx = history.length;
    await runPrompt(raw);
    safePrompt();
  };

  // ── Keybinds (Ctrl+X leader) ──
  let leaderPending = false;
  let leaderTimer = null;

  if (process.stdin.isTTY) readline.emitKeypressEvents(process.stdin);

  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if (key.ctrl && key.name === 'x') {
      leaderPending = true;
      clearTimeout(leaderTimer);
      leaderTimer = setTimeout(() => { leaderPending = false; }, 2000);
      return;
    }
    if (leaderPending) {
      leaderPending = false;
      clearTimeout(leaderTimer);
      const actions = {
        'q': () => rl.close(),
        'n': () => cmd.new(),
        'l': () => cmd.sessions(),
        'u': () => cmd.undo(),
        'r': () => cmd.redo(),
        'c': () => cmd.compact(),
        'm': () => cmd.models(),
        't': () => cmd.themes(),
        'x': () => cmd.export(),
        'e': () => cmd.details(),
        'h': () => cmd.help(),
        's': () => cmd.stats(),
      };
      if (actions[key.name]) actions[key.name]();
      return;
    }
    // Tab → cycle agents
    if (key.name === 'tab' && !busy) {
      const agents = extensions.primaryAgents();
      const idx = agents.findIndex((a) => a.name === currentAgent);
      const next = agents[(idx + 1) % agents.length];
      currentAgent = next.name;
      mode = resolveAgent(next.name, extensions).mode === 'plan' ? 'plan' : 'build';
      console.log(c.success(`  ✦ agent → ${currentAgent} (${mode})`));
      console.log();
      rl.setPrompt(promptStr());
      rl.prompt();
    }
    // Escape → interrupt running agent
    if (key.name === 'escape' && busy && aborter) {
      aborter.abort();
      return;
    }
    // Ctrl+C → clear input
    if (key.ctrl && key.name === 'c') {
      readline.clearLine(process.stdin, 0);
      readline.cursorTo(process.stdin, 0);
      rl.setPrompt(promptStr());
      rl.prompt();
    }
  });

  rl.on('close', async () => {
    try {
      await chain;
    } catch {}
    console.log(c.dim('\n  session saved. the moon remembers.\n'));
    await hooks.run('session_end', { session: session.id });
    for (const s of mcpServers) { try { s.stop(); } catch {} }
    process.exit(0);
  });

  rl.setPrompt(promptStr());
  rl.prompt();
}
