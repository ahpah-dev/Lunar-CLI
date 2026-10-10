import fs from 'node:fs';
import path from 'node:path';

export function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: content };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: content.slice(m[0].length).trim() };
}

function readMdDir(dir, ext = '.md') {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) continue;
    if (!e.name.endsWith(ext)) continue;
    try {
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, e.name), 'utf-8'));
      out.push({ name: meta.name ?? e.name.replace(/\.md$/, ''), description: meta.description ?? '', meta, body, source: path.join(dir, e.name) });
    } catch {}
  }
  return out;
}

function readSkillDir(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      const file = path.join(dir, e.name, 'SKILL.md');
      if (fs.existsSync(file)) {
        try {
          const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
          out.push({ name: meta.name ?? e.name, description: meta.description ?? '', meta, body, source: file });
        } catch {}
      }
    } else if (e.name.endsWith('.md')) {
      try {
        const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, e.name), 'utf-8'));
        out.push({ name: meta.name ?? e.name.replace(/\.md$/, ''), description: meta.description ?? '', meta, body, source: path.join(dir, e.name) });
      } catch {}
    }
  }
  return out;
}

export const BUILTIN_AGENTS = {
  build: {
    name: 'build',
    description: 'Full access builder. Reads, edits, runs commands.',
    mode: 'primary',
    permission: null,
    model: null,
    temperature: null,
    prompt: 'You are Lunar, a senior software engineer. Make the requested changes, verify with builds/tests, keep diffs minimal, be concise in responses.',
  },
  plan: {
    name: 'plan',
    description: 'Read-only planner. Proposes plans without editing.',
    mode: 'primary',
    permission: { edit: 'deny', write: 'deny', apply_patch: 'deny', bash: 'deny' },
    model: null,
    temperature: 0.2,
    prompt: 'You are Lunar in plan mode. Explore the codebase and output a concrete step-by-step plan. Do NOT edit files or run mutating commands. Be specific about which files to change and why.',
  },
  general: {
    name: 'general',
    description: 'General-purpose subagent for research and multi-step tasks.',
    mode: 'subagent',
    permission: null,
    model: null,
    temperature: null,
    prompt: 'You are a general-purpose agent. Complete the task thoroughly and return a concise summary of what you found/did.',
  },
  explore: {
    name: 'explore',
    description: 'Fast read-only agent for exploring codebases.',
    mode: 'subagent',
    permission: { edit: 'deny', write: 'deny', apply_patch: 'deny', bash: 'deny' },
    model: null,
    temperature: 0.1,
    prompt: 'You are an exploration agent. Search, read, and analyze code. Do NOT make any changes. Return findings clearly.',
  },
};

export class Extensions {
  constructor(lunarDirs, config) {
    this.lunarDirs = lunarDirs;
    this.config = config;
    this.agents = [];
    this.commands = [];
    this.skills = [];
    this.agentsByName = {};
  }

  load() {
    this.agents = [];
    this.commands = [];
    this.skills = [];

    // Custom agents from directories
    for (const dir of this.lunarDirs) {
      this.agents.push(...readMdDir(path.join(dir, 'agents')));
      this.commands.push(...readMdDir(path.join(dir, 'commands')));
      this.skills.push(...readSkillDir(path.join(dir, 'skills')));
    }

    // Agents from config
    for (const [name, a] of Object.entries(this.config?.agent ?? {})) {
      if (a.disable) continue;
      this.agents.push({
        name,
        description: a.description ?? '',
        meta: a,
        body: a.prompt ?? '',
        source: 'lunar.json',
      });
    }

    // Commands from config
    for (const [name, cmd] of Object.entries(this.config?.command ?? {})) {
      this.commands.push({
        name,
        description: cmd.description ?? '',
        meta: { agent: cmd.agent, model: cmd.model },
        body: cmd.template ?? '',
        source: 'lunar.json',
      });
    }

    // Index by name (config overrides files, files override builtins)
    this.agentsByName = { ...BUILTIN_AGENTS };
    for (const a of this.agents) this.agentsByName[a.name] = a;

    return this;
  }

  getAgent(name) {
    if (!name) return this.agentsByName[this.config?.default_agent ?? 'build'] ?? BUILTIN_AGENTS.build;
    return this.agentsByName[name] ?? null;
  }

  static agentMode(a) {
    return a.mode ?? a.meta?.mode ?? 'primary';
  }

  primaryAgents() {
    return Object.values(this.agentsByName).filter((a) => Extensions.agentMode(a) === 'primary');
  }

  subagents() {
    return Object.values(this.agentsByName).filter((a) => Extensions.agentMode(a) === 'subagent');
  }

  getCommand(name) {
    return this.commands.find((c) => c.name === name);
  }

  getSkill(name) {
    return this.skills.find((s) => s.name === name);
  }

  skillCatalog() {
    return this.skills.map((s) => `- ${s.name}: ${s.description}`);
  }
}

export function resolveAgent(name, extensions) {
  const found = extensions.getAgent(name) ?? BUILTIN_AGENTS.build;
  if (found.prompt !== undefined) return found;
  const meta = found.meta ?? {};
  const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',').map((t) => t.trim()).filter(Boolean));
  return {
    name: found.name,
    description: found.description ?? '',
    mode: meta.mode ?? 'primary',
    permission: meta.permission ?? null,
    model: meta.model ?? null,
    temperature: num(meta.temperature),
    tools: meta.tools !== undefined ? list(meta.tools) : null,
    steps: num(meta.steps),
    prompt: found.body ?? '',
  };
}

export function expandCommand(cmd, args) {
  return cmd.body.replace(/\$ARGUMENTS/g, args ?? '').replace(/\$0/g, args ?? '');
}
