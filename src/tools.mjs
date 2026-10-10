import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getShell } from './config.mjs';

const execAsync = promisify(exec);
const IGNORE = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'coverage', '.venv', 'venv', '.lunar', '.cache']);

function resolve(cwd, p) {
  const full = path.resolve(cwd, p);
  const rel = path.relative(cwd, full);
  if (rel.startsWith('..')) throw new Error(`Path escapes workspace: ${p}`);
  return full;
}

function gitignore(cwd) {
  try {
    return fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } catch { return []; }
}

function isIgnored(rel, patterns) {
  return patterns.some((p) => {
    const clean = p.replace(/\/$/, '');
    return rel === clean || rel.startsWith(`${clean}/`) || path.basename(rel) === clean;
  });
}

async function walk(cwd, dir, patterns, out) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(cwd, full).replace(/\\/g, '/');
    if (isIgnored(rel, patterns)) continue;
    if (e.isDirectory()) await walk(cwd, full, patterns, out);
    else out.push(full);
  }
  return out;
}

function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(ch)) re += `\\${ch}`;
    else re += ch;
  }
  return new RegExp(`^${re}$`);
}

function parsePatch(text) {
  const ops = [];
  let cur = null;
  const header = /^\*\*\*\s+(Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/;
  for (const line of text.split('\n')) {
    const m = line.match(header);
    if (m) {
      if (cur) ops.push(cur);
      const kind = m[1] === 'Delete File' ? 'delete' : m[1] === 'Add File' || m[1] === 'Move to' ? 'add' : 'update';
      cur = { kind, path: m[2], content: '' };
    } else if (cur && cur.kind !== 'delete') {
      cur.content += (cur.content ? '\n' : '') + line;
    }
  }
  if (cur) ops.push(cur);
  return ops;
}

export function buildTools(ctx) {
  const { cwd, config, session, hooks, extensions } = ctx;

  const read = {
    name: 'read',
    description: 'Read file contents with line numbers. Use offset/limit for large files.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (relative to workspace)' },
        offset: { type: 'number', description: 'Start line (1-indexed, default 1)' },
        limit: { type: 'number', description: 'Max lines to return' },
      },
      required: ['path'],
    },
    async execute({ path: p, offset, limit }) {
      const full = resolve(cwd, p);
      const content = await fsp.readFile(full, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, (offset ?? 1) - 1);
      const end = limit ? start + limit : lines.length;
      const body = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
      return lines.length > end ? `${body}\n… (${lines.length} lines total)` : body;
    },
  };

  const write = {
    name: 'write',
    description: 'Create or overwrite a file. Creates parent directories.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    async execute({ path: p, content }) {
      const full = resolve(cwd, p);
      await session.snapshotFile(p, cwd);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, content, 'utf-8');
      await hooks.run('post_edit', { path: p });
      return `Wrote ${content.length} chars to ${p}`;
    },
  };

  const edit = {
    name: 'edit',
    description: 'Replace an exact unique string in a file. The old_string must be unique and match exactly.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact text to find (must be unique)' },
        new_string: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    async execute({ path: p, old_string, new_string }) {
      const full = resolve(cwd, p);
      await session.snapshotFile(p, cwd);
      const content = await fsp.readFile(full, 'utf-8');
      const idx = content.indexOf(old_string);
      if (idx === -1) throw new Error(`old_string not found in ${p}`);
      if (content.indexOf(old_string, idx + 1) !== -1) throw new Error(`old_string not unique in ${p}. Add more context.`);
      await fsp.writeFile(full, content.slice(0, idx) + new_string + content.slice(idx + old_string.length), 'utf-8');
      await hooks.run('post_edit', { path: p });
      return `Edited ${p}`;
    },
  };

  const apply_patch = {
    name: 'apply_patch',
    description: 'Apply a patch with *** Add File / Update File / Delete File markers.',
    parameters: {
      type: 'object',
      properties: { patch: { type: 'string', description: 'Patch text with marker lines' } },
      required: ['patch'],
    },
    async execute({ patch: text }) {
      const ops = parsePatch(text);
      const summary = [];
      for (const op of ops) {
        const full = resolve(cwd, op.path);
        await session.snapshotFile(op.path, cwd);
        if (op.kind === 'delete') {
          await fsp.rm(full, { force: true });
          summary.push(`deleted ${op.path}`);
        } else {
          await fsp.mkdir(path.dirname(full), { recursive: true });
          await fsp.writeFile(full, op.content, 'utf-8');
          summary.push(`${op.kind === 'add' ? 'created' : 'updated'} ${op.path}`);
        }
      }
      return summary.join('\n') || 'No operations';
    },
  };

  const bash = {
    name: 'bash',
    description: 'Execute a shell command. Returns stdout, stderr, and exit code.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
        timeout: { type: 'number', description: 'Timeout in ms (default 30000)' },
        description: { type: 'string', description: 'One-line summary of what this command does' },
      },
      required: ['command'],
    },
    async execute({ command, timeout = 30000 }) {
      try {
        const { stdout, stderr } = await execAsync(command, { cwd, timeout, maxBuffer: 10 * 1024 * 1024, shell: getShell(config) });
        const out = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n').slice(0, 20000);
        return out || '(no output, exit 0)';
      } catch (err) {
        const out = [err.stdout ?? '', err.stderr ?? '', String(err.message)].filter(Boolean).join('\n').slice(0, 20000);
        throw new Error(`exit ${err.code ?? 1}: ${out}`);
      }
    },
  };

  const glob = {
    name: 'glob',
    description: 'Find files by glob pattern (e.g. **/*.ts, src/**/*.js). Sorted by modification time (newest first).',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Subdirectory to search (default .)' },
      },
      required: ['pattern'],
    },
    async execute({ pattern, path: sub = '.' }) {
      const base = resolve(cwd, sub);
      const files = await walk(cwd, base, gitignore(cwd), []);
      const re = globRe(pattern.includes('/') ? pattern : `**/${pattern}`);
      const stats = await Promise.all(files.map(async (f) => {
        const rel = path.relative(cwd, f).replace(/\\/g, '/');
        if (!re.test(rel) && !re.test(path.basename(rel))) return null;
        const st = await fsp.stat(f).catch(() => null);
        return { rel, mtime: st?.mtimeMs ?? 0 };
      }));
      const sorted = stats.filter(Boolean).sort((a, b) => b.mtime - a.mtime).slice(0, 100);
      return sorted.map((s) => s.rel).join('\n') || 'No matches';
    },
  };

  const grep = {
    name: 'grep',
    description: 'Search file contents with regex. Returns file:line matches.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        include: { type: 'string', description: 'File glob filter, e.g. *.ts' },
        path: { type: 'string', description: 'Subdirectory (default .)' },
      },
      required: ['pattern'],
    },
    async execute({ pattern, include, path: sub = '.' }) {
      const base = resolve(cwd, sub);
      const files = await walk(cwd, base, gitignore(cwd), []);
      const re = new RegExp(pattern);
      const incRe = include ? globRe(include) : null;
      const results = [];
      for (const f of files.slice(0, 500)) {
        const rel = path.relative(cwd, f).replace(/\\/g, '/');
        if (incRe && !incRe.test(path.basename(rel))) continue;
        try {
          const st = await fsp.stat(f);
          if (st.size > 500_000) continue;
          const content = await fsp.readFile(f, 'utf-8');
          if (content.includes('\0')) continue;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
              if (results.length >= 80) return results.join('\n');
            }
          }
        } catch {}
      }
      return results.join('\n') || 'No matches';
    },
  };

  const list = {
    name: 'list',
    description: 'List files and directories at a path.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory path (default .)' } },
    },
    async execute({ path: p = '.' }) {
      const dir = resolve(cwd, p);
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      return entries.sort((a, b) => a.name.localeCompare(b.name)).map((e) => `${e.isDirectory() ? 'dir ' : 'file'} ${e.name}`).join('\n');
    },
  };

  const todowrite = {
    name: 'todowrite',
    description: 'Create/update a todo list. Exactly one item should be in_progress at a time.',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['content', 'status', 'priority'],
          },
        },
      },
      required: ['todos'],
    },
    async execute({ todos }) {
      session.setTodos(todos);
      const mark = { completed: '✓', in_progress: '●', pending: '○', cancelled: '✗' };
      return todos.map((t) => `${mark[t.status] ?? '○'} ${t.content}`).join('\n');
    },
  };

  const webfetch = {
    name: 'webfetch',
    description: 'Fetch a URL and return readable text content.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        maxChars: { type: 'number', description: 'Max characters (default 15000)' },
      },
      required: ['url'],
    },
    async execute({ url, maxChars = 15000 }) {
      const res = await fetch(url, { headers: { 'User-Agent': 'lunar-cli/3.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      return text.slice(0, maxChars);
    },
  };

  const skill = {
    name: 'skill',
    description: 'Load a skill by name and return its instructions.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
    async execute({ name }) {
      const s = extensions?.getSkill(name);
      if (!s) throw new Error(`Unknown skill: ${name}. Available: ${extensions?.skills?.map((x) => x.name).join(', ') ?? 'none'}`);
      return `# Skill: ${s.name}\n${s.description}\n\n${s.body}`;
    },
  };

  const task = {
    name: 'task',
    description: 'Delegate a task to a subagent. The subagent runs in its own context and returns a summary.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Short description of the task' },
        prompt: { type: 'string', description: 'Detailed instructions for the subagent' },
        agent: { type: 'string', description: 'Agent name (default: general)' },
      },
      required: ['description', 'prompt'],
    },
    async execute({ description, prompt, agent: agentName }) {
      return ctx.runSubagent({ description, prompt, agentName });
    },
  };

  const question = {
    name: 'question',
    description: 'Ask the user a clarifying question with options.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              header: { type: 'string' },
              question: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['label'],
                },
              },
            },
            required: ['header', 'question', 'options'],
          },
        },
      },
      required: ['questions'],
    },
    async execute({ questions }) {
      return ctx.askUser(questions);
    },
  };

  return { read, write, edit, apply_patch, bash, glob, grep, list, todowrite, webfetch, skill, task, question };
}
