import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.mjs';

const MEMORY_FILES = ['AGENTS.md', 'LUNAR.md'];

function readCap(file, maxLines = 200) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    return lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + '\n…(truncated)' : content;
  } catch { return null; }
}

function globFiles(cwd, pattern) {
  if (!pattern.includes('*')) {
    const p = path.resolve(cwd, pattern);
    return fs.existsSync(p) ? [p] : [];
  }
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const searchDir = dir.includes('*') ? cwd : path.resolve(cwd, dir);
  const re = new RegExp(`^${base.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
  try { return fs.readdirSync(searchDir).filter((f) => re.test(f)).map((f) => path.join(searchDir, f)); } catch { return []; }
}

export function loadMemory(cwd, config) {
  const parts = [];

  // Global auto-memory
  const globalMem = readCap(path.join(dataDir(), 'MEMORY.md'));
  if (globalMem) parts.push(`<memory>\n${globalMem}\n</memory>`);

  // Project memory files
  for (const name of MEMORY_FILES) {
    const body = readCap(path.join(cwd, name));
    if (body) {
      const tag = name.toLowerCase().replace('.md', '');
      parts.push(`<${tag}>\n${body}\n</${tag}>`);
    }
  }

  // Instructions config (globs)
  for (const pattern of config?.instructions ?? []) {
    for (const file of globFiles(cwd, pattern)) {
      const body = readCap(file);
      if (body) parts.push(`<rule file="${path.basename(file)}">\n${body}\n</rule>`);
    }
  }

  return parts.join('\n\n');
}

export function initProject(cwd) {
  const created = [];

  const agents = path.join(cwd, 'AGENTS.md');
  if (!fs.existsSync(agents)) {
    fs.writeFileSync(agents, [
      '# AGENTS.md',
      '',
      '## Project Overview',
      '<!-- What this project is, in 3 sentences. -->',
      '',
      '## Commands',
      '- Build:',
      '- Test:',
      '- Lint:',
      '',
      '## Conventions',
      '<!-- Style, patterns, things to always/never do. -->',
      '',
      '## Architecture',
      '<!-- Key components and how they connect. -->',
    ].join('\n'), 'utf-8');
    created.push('AGENTS.md');
  }

  const lunarJson = path.join(cwd, 'lunar.json');
  if (!fs.existsSync(lunarJson)) {
    fs.writeFileSync(lunarJson, JSON.stringify({
      $schema: 'https://lunar.sh/lunar.json',
      model: 'anthropic/claude-sonnet-4-5',
      permission: { edit: 'ask', bash: 'ask' },
    }, null, 2), 'utf-8');
    created.push('lunar.json');
  }

  return created;
}

export function appendMemory(line) {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.appendFileSync(path.join(dataDir(), 'MEMORY.md'), `- ${line}\n`, 'utf-8');
  } catch {}
}
