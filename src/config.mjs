import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const VERSION = '3.0.0';

export const DEFAULTS = {
  model: 'anthropic/claude-sonnet-4-5',
  small_model: 'anthropic/claude-haiku-4-5',
  default_agent: 'build',
  subagent_depth: 1,
  theme: 'moon',
  snapshot: true,
  shell: null,
  max_steps: 80,
  tools: {},
  permission: {},
  provider: {},
  model_prices: {},
  mcp: {},
  agent: {},
  command: {},
  hooks: {},
  instructions: [],
  disabled_providers: [],
  enabled_providers: [],
  compaction: { auto: true, reserved: 8000 },
};

function subEnv(v) {
  if (typeof v === 'string') return v.replace(/\{env:([A-Za-z_]\w*)\}/g, (_, n) => process.env[n] ?? '');
  if (Array.isArray(v)) return v.map(subEnv);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, subEnv(val)]));
  return v;
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function merge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function globalConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'lunar');
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? os.homedir(), 'lunar');
  return path.join(os.homedir(), '.config', 'lunar');
}

export function dataDir() {
  return path.join(os.homedir(), '.lunar');
}

export function findRoot(cwd) {
  let dir = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(dir, 'lunar.json')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd);
    dir = parent;
  }
}

export function loadConfig(cwd = process.cwd()) {
  const root = findRoot(cwd);
  const gdir = globalConfigDir();
  let config = { ...DEFAULTS };

  const sources = [
    path.join(gdir, 'lunar.json'),
    process.env.LUNAR_CONFIG ? path.resolve(process.env.LUNAR_CONFIG) : null,
    path.join(root, 'lunar.json'),
  ].filter(Boolean);

  for (const file of sources) {
    const parsed = readJson(file);
    if (parsed) config = merge(config, subEnv(parsed));
  }

  if (process.env.LUNAR_CONFIG_CONTENT) {
    try {
      config = merge(config, subEnv(JSON.parse(process.env.LUNAR_CONFIG_CONTENT)));
    } catch {}
  }

  const lunarDirs = [
    path.join(gdir, '.lunar'),
    path.join(root, '.lunar'),
  ];
  if (process.env.LUNAR_CONFIG_DIR) lunarDirs.push(path.resolve(process.env.LUNAR_CONFIG_DIR));

  return { config, root, globalDir: gdir, lunarDirs };
}

export function getShell(config) {
  if (config?.shell) return config.shell;
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe';
  return process.env.SHELL ?? '/bin/bash';
}
