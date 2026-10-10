import { Command } from 'commander';
import { loadConfig, VERSION } from './config.mjs';
import { Extensions } from './agents.mjs';
import { connectMCP, Hooks } from './mcp.mjs';
import { Session } from './session.mjs';
import { runAgent } from './agent.mjs';
import { startTUI } from './tui.mjs';
import { bannerPlain, c, glow, moonHeader, divider, statusLine, toolCallLine, pad, P } from './theme.mjs';
import { listProviders, resolveModel, getProvider } from './providers.mjs';
import { initProject, loadMemory } from './memory.mjs';
import { getMoonPhase } from './moon.mjs';
import { renderMoon } from './moonArt.mjs';

async function env(opts = {}) {
  const { config, root, globalDir, lunarDirs } = loadConfig(process.cwd());
  if (opts.model) config.model = opts.model;
  if (opts.agent) config.default_agent = opts.agent;
  const extensions = new Extensions(lunarDirs, config).load();
  const hooks = new Hooks(config, root);
  const mcpServers = await connectMCP(config);
  let resumeId = opts.session;
  if (!resumeId && opts.continue) resumeId = Session.list()[0]?.id;
  return { config, root, globalDir, lunarDirs, extensions, hooks, mcpServers, version: VERSION, model: config.model, agent: config.default_agent ?? 'build', resumeId };
}

function stopMcp(env) {
  for (const s of env.mcpServers) { try { s.stop(); } catch {} }
}

export function run(argv) {
  const prog = new Command();

  prog
    .name('lunarcode')
    .description('LUNAR — lunar-themed agentic coding CLI')
    .version(VERSION, '-v, --version', 'show version')
    .option('--model <m>', 'model (provider/model)')
    .option('--agent <a>', 'agent (build|plan|custom)')
    .option('-c, --continue', 'continue last session')
    .option('-s, --session <id>', 'session ID to resume')
    .option('--auto', 'auto-approve permissions')
    .argument('[project]', 'project directory')
    .action(async (project, opts) => {
      if (project) process.chdir(project);
      const e = await env(opts);
      await startTUI(e);
    });

  // Helper: merge global + subcommand opts (commander eats global flags before subcommand)
  const merged = (subOpts) => ({ ...prog.opts(), ...subOpts });

  // ── run (headless) ──
  prog.command('run [message...]')
    .description('Run a prompt non-interactively')
    .option('--model <m>', 'model override')
    .option('--agent <a>', 'agent override')
    .option('--format <f>', 'output format: text|json', 'text')
    .option('-c, --continue', 'continue last session')
    .option('-s, --session <id>', 'session ID')
    .option('-y, --auto', 'auto-approve')
    .action(async (msgParts, rawOpts) => {
      const opts = merged(rawOpts);
      const prompt = (msgParts ?? []).join(' ');
      if (!prompt) { console.error('No prompt provided.'); process.exit(1); }
      const e = await env(opts);
      let sessionId = opts.session;
      if (!sessionId && opts.continue) sessionId = Session.list()[0]?.id;
      const session = new Session(sessionId);
      await session.load();
      session.meta.model = opts.model ?? e.model;
      session.meta.agent = opts.agent ?? e.agent;

      const events = {
        onText: (d) => { if (opts.format === 'text') process.stdout.write(d); },
        onToolStart: (call) => { if (opts.format === 'text') console.error(toolCallLine(call.name, call.arguments)); },
        onToolResult: () => {},
        onUsage: () => {},
      };

      try {
        const r = await runAgent({
          prompt, session, config: e.config, cwd: e.root,
          extensions: e.extensions, hooks: e.hooks, mcpServers: e.mcpServers,
          agentName: opts.agent ?? e.agent, modelStr: opts.model ?? e.model,
          events, interactive: false, allowAll: opts.auto,
        });
        if (opts.format === 'json') {
          console.log(JSON.stringify({ text: r.text, session: session.id, model: r.model, agent: r.agent, usage: session.meta }, null, 2));
        } else {
          process.stdout.write('\n');
        }
      } catch (err) {
        console.error(`${c.error('✦')} ${err.message}`);
        process.exit(1);
      } finally {
        stopMcp(e);
      }
    });

  // ── init ──
  prog.command('init')
    .description('Create AGENTS.md + lunar.json')
    .action(async () => {
      const e = await env();
      const created = initProject(e.root);
      console.log();
      if (created.length) console.log(c.success(`  ✦ created: ${created.join(', ')}`));
      else console.log(c.dim('  already initialized'));
      console.log(c.dim('  next: edit AGENTS.md, then run `lunarcode` to start'));
      console.log();
    });

  // ── sessions ──
  prog.command('sessions')
    .description('List recent sessions')
    .option('--format <f>', 'format: table|json', 'table')
    .action((opts) => {
      const list = Session.list();
      console.log();
      if (opts.format === 'json') { console.log(JSON.stringify(list, null, 2)); return; }
      if (!list.length) console.log(c.dim('  no sessions yet'));
      for (const s of list.slice(0, 20)) {
        console.log(`  ${c.starlight(pad(s.id, 10))} ${c.dim(pad(s.messages + ' msgs', 12))} ${c.dim(pad('$' + s.cost.toFixed(4), 10))} ${c.dim(s.title.slice(0, 40))}`);
      }
      console.log();
    });

  // ── models ──
  prog.command('models [provider]')
    .description('List providers and key status')
    .option('--verbose', 'show more detail')
    .action((provider, opts) => {
      const e = loadConfig(process.cwd());
      let providers = listProviders(e.config);
      if (provider) providers = providers.filter((p) => p.id === provider);
      console.log();
      for (const p of providers) {
        console.log(`  ${c.starlight(pad(p.id, 16))} ${c.dim(pad(p.kind, 10))} ${p.hasKey ? c.success('● key') : c.dim('○ no key')} ${c.dim(p.baseURL)}`);
      }
      console.log();
      console.log(c.dim(`  current model: ${e.config.model}`));
      console.log(c.dim('  set: lunarcode --model <provider/model>'));
      console.log();
    });

  // ── config ──
  prog.command('config')
    .description('Show resolved configuration')
    .action(() => {
      const e = loadConfig(process.cwd());
      const view = {
        model: e.config.model,
        small_model: e.config.small_model,
        default_agent: e.config.default_agent,
        theme: e.config.theme,
        permission: e.config.permission,
        tools: e.config.tools,
        mcp: Object.keys(e.config.mcp ?? {}),
        instructions: e.config.instructions,
        hooks: Object.keys(e.config.hooks ?? {}),
        agents: Object.keys(e.config.agent ?? {}),
        commands: Object.keys(e.config.command ?? {}),
      };
      console.log();
      console.log(c.dim(`  root: ${e.root}`));
      console.log(c.dim(`  global: ${e.globalDir}`));
      console.log(JSON.stringify(view, null, 2).split('\n').map((l) => '  ' + l).join('\n'));
      console.log();
    });

  // ── doctor ──
  prog.command('doctor')
    .description('Diagnose setup and configuration')
    .action(async () => {
      const e = await env();
      console.log();
      console.log(glow('  ✦ doctor'));
      console.log(divider(44));

      const providers = listProviders(e.config);
      const keyed = providers.filter((p) => p.hasKey);
      console.log(keyed.length ? `  ${c.success('✓')} API keys: ${keyed.map((p) => p.id).join(', ')}` : `  ${c.error('✗')} no API keys (set ANTHROPIC_API_KEY etc.)`);

      const mem = loadMemory(e.root, e.config);
      console.log(mem ? `  ${c.success('✓')} project memory loaded` : `  ${c.dim('·')} no AGENTS.md (run lunarcode init)`);

      console.log(e.extensions.skills.length ? `  ${c.success('✓')} ${e.extensions.skills.length} skills` : `  ${c.dim('·')} no skills`);
      console.log(e.extensions.commands.length ? `  ${c.success('✓')} ${e.extensions.commands.length} custom commands` : `  ${c.dim('·')} no custom commands`);
      console.log(e.extensions.agents.length ? `  ${c.success('✓')} ${e.extensions.agents.length} custom agents` : `  ${c.dim('·')} no custom agents`);

      const badMcp = e.mcpServers.filter((s) => s.error);
      console.log(badMcp.length ? `  ${c.error('✗')} MCP errors: ${badMcp.map((s) => `${s.name}(${s.error})`).join(', ')}` : `  ${c.success('✓')} MCP: ${e.mcpServers.length} servers`);

      console.log(`  ${c.dim('·')} node ${process.version} · lunar ${VERSION}`);
      console.log(divider(44));
      console.log();
      stopMcp(e);
    });

  // ── mcp ──
  prog.command('mcp')
    .description('Show MCP server status')
    .action(async () => {
      const e = await env();
      console.log();
      if (!e.mcpServers.length) {
        console.log(c.dim('  no MCP servers. Add to lunar.json:'));
        console.log(c.dim('  { "mcp": { "name": { "command": "npx", "args": ["-y", "pkg"] } } }'));
      }
      for (const s of e.mcpServers) {
        if (s.error) console.log(`  ${c.dim(s.name)} ${c.error('✗ ' + s.error)}`);
        else {
          console.log(`  ${c.starlight(s.name)} ${c.dim(`${s.tools?.length ?? 0} tools`)}`);
          for (const t of (s.tools ?? []).slice(0, 10)) console.log(c.dim(`    - ${t.name}`));
        }
      }
      console.log();
      stopMcp(e);
    });

  // ── share / export ──
  prog.command('share [id]')
    .description('Export session to markdown')
    .action(async (id) => {
      const target = id ?? Session.list()[0]?.id;
      if (!target) { console.log(c.dim('  no sessions to share')); return; }
      const s = new Session(target);
      await s.load();
      if (!s.messages.length) { console.log(c.dim('  session not found or empty')); return; }
      const file = `${process.cwd()}/.lunar-share-${target}.md`;
      const { writeFileSync } = await import('node:fs');
      writeFileSync(file, s.exportMarkdown(), 'utf-8');
      console.log(c.success(`  ✦ exported to ${file}`));
    });

  // ── stats ──
  prog.command('stats')
    .description('Show token usage and cost statistics')
    .option('--days <n>', 'show stats for last N days')
    .action(() => {
      const list = Session.list();
      let totalIn = 0, totalOut = 0, totalCost = 0, totalMsgs = 0;
      for (const s of list) { totalCost += s.cost; totalMsgs += s.messages; }
      console.log();
      console.log(`  ${c.starlight('sessions')}  ${list.length}`);
      console.log(`  ${c.starlight('messages')}  ${totalMsgs}`);
      console.log(`  ${c.starlight('total cost')} $${totalCost.toFixed(4)}`);
      if (list.length) {
        console.log();
        for (const s of list.slice(0, 10)) {
          console.log(`    ${c.dim(s.id)} ${c.dim(`$${s.cost.toFixed(4)} · ${s.messages} msgs`)}`);
        }
      }
      console.log();
    });

  // ── agent ──
  prog.command('agent [name]')
    .description('List agents or show agent detail')
    .action(async (name) => {
      const e = await env();
      if (name) {
        const a = e.extensions.getAgent(name);
        if (!a) { console.log(c.error(`  unknown agent: ${name}`)); stopMcp(e); return; }
        console.log();
        console.log(`  ${c.starlight(a.name)} ${c.dim(`(${a.mode ?? 'primary'})`)}`);
        console.log(`  ${a.description ?? ''}`);
        console.log(`  ${c.dim('permission:')} ${JSON.stringify(a.permission ?? a.meta?.permission ?? 'defaults')}`);
        console.log(`  ${c.dim('model:')} ${a.model ?? a.meta?.model ?? 'inherit'}`);
        console.log();
      } else {
        console.log();
        console.log(c.bold('  agents'));
        const all = [...e.extensions.primaryAgents(), ...e.extensions.subagents()];
        for (const a of all) {
          console.log(`    ${c.starlight(pad(a.name, 16))} ${c.dim(pad(a.mode ?? 'primary', 10))} ${c.dim(a.description ?? '')}`);
        }
        console.log();
      }
      stopMcp(e);
    });

  // ── Moon-themed extras ──
  prog.command('phase')
    .description("Show tonight's moon")
    .action(() => showPhase());

  prog.command('vibe')
    .description('Receive a vibe-coding blessing')
    .action(async () => { await showVibe(); });

  prog.command('dashboard')
    .description('Show the moon dashboard')
    .action(() => showDashboard());

  prog.parse(argv);
}

// ── Moon command handlers ──
function showPhase() {
  const moon = getMoonPhase();
  const art = renderMoon(moon.position, { radius: 6 });
  console.log();
  console.log(art.split('\n').map((l) => '  ' + l).join('\n'));
  console.log();
  console.log(`  ${c.starlight.bold(moon.phase.name)} · ${c.moonlight(Math.round(moon.illumination * 100) + '% lit')}`);
  console.log(`  ${c.dusk(`"${moon.phase.vibe}"`)}`);
  console.log();
}

async function showVibe() {
  const VIBES = [
    'Ship it small. The moon was not built in a night either.',
    'Let the tests pass quietly, like moonlight on water.',
    'Refactor by moonlight, commit by dawn.',
    'Even the moon borrows its light. Remix fearlessly.',
    'Stay in flow. The tide follows the moon, and so does momentum.',
    'One phase at a time. Wax, never wane.',
    'Commit little, shine often.',
    'Every bug hides on the dark side of the moon.',
    'Small commits, long horizons, zero gravity.',
    'Your night owl hours are a feature, not a bug.',
  ];
  const moon = getMoonPhase();
  const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
  console.log();
  console.log(`  ${c.moonlight.bold(vibe)}`);
  console.log(`  ${c.dim('— during a ' + moon.phase.name.toLowerCase())}`);
  console.log();
}

function showDashboard() {
  const moon = getMoonPhase();
  console.log();
  console.log('  ' + bannerPlain());
  console.log(c.dim('  lunar-themed agentic coding CLI  ·  v' + VERSION));
  console.log();
  console.log('  ' + divider(50));
  console.log(moonHeader());
  console.log('  ' + divider(50));
  console.log();
  const cmds = [
    ['lunarcode', 'start interactive session'],
    ['lunarcode run "..."', 'headless single-shot run'],
    ['lunarcode init', 'create AGENTS.md + lunar.json'],
    ['lunarcode sessions', 'list sessions'],
    ['lunarcode models', 'list providers + key status'],
    ['lunarcode doctor', 'diagnose setup'],
    ['lunarcode stats', 'token usage + cost'],
    ['lunarcode agent', 'list agents'],
    ['lunarcode mcp', 'MCP status'],
    ['lunarcode phase', "tonight's moon"],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`  ${c.starlight(pad(cmd, 26))} ${c.dim(desc)}`);
  }
  console.log();
}
