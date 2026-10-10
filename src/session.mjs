import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir } from './config.mjs';

const sessionsDir = () => path.join(dataDir(), 'sessions');
const snapDir = (id) => path.join(sessionsDir(), id, 'snaps');

export class Session {
  constructor(id) {
    this.id = id ?? crypto.randomUUID().slice(0, 8);
    this.messages = [];
    this.todos = [];
    this.meta = {
      title: 'untitled',
      model: '',
      agent: 'build',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      created: new Date().toISOString(),
      pid: process.pid,
    };
    this._undo = [];
    this._redo = [];
  }

  get file() { return path.join(sessionsDir(), `${this.id}.jsonl`); }

  async load() {
    await fsp.mkdir(sessionsDir(), { recursive: true });
    try {
      for (const line of (await fsp.readFile(this.file, 'utf-8')).split('\n')) {
        if (!line.trim()) continue;
        const e = JSON.parse(line);
        if (e.kind === 'meta') this.meta = { ...this.meta, ...e.meta };
        else if (e.kind === 'todos') this.todos = e.todos;
        else if (!e.kind) this.messages.push(e);
      }
    } catch {}
    return this;
  }

  async persist(entry) {
    await fsp.mkdir(sessionsDir(), { recursive: true });
    await fsp.appendFile(this.file, `${JSON.stringify(entry)}\n`, 'utf-8');
  }

  async append(role, text, toolCalls, results) {
    const e = { role, text, toolCalls, results, at: new Date().toISOString() };
    this.messages.push(e);
    await this.persist(e);
  }

  async saveMeta() { await this.persist({ kind: 'meta', meta: this.meta }); }

  setTodos(todos) {
    this.todos = todos;
    this.persist({ kind: 'todos', todos });
  }

  // Replace the full message list (used by compaction). Rewrites the JSONL
  // file while preserving meta/todos. Keeps undo history intact.
  async replaceMessages(fresh) {
    this.messages = [...fresh];
    const lines = [];
    lines.push(JSON.stringify({ kind: 'meta', meta: this.meta }));
    if (this.todos.length) lines.push(JSON.stringify({ kind: 'todos', todos: this.todos }));
    for (const m of this.messages) {
      lines.push(JSON.stringify({ role: m.role, text: m.text, toolCalls: m.toolCalls, results: m.results, at: m.at }));
    }
    await fsp.mkdir(sessionsDir(), { recursive: true });
    await fsp.writeFile(this.file, `${lines.join('\n')}\n`, 'utf-8');
  }

  history() {
    return this.messages.map((m) => ({ role: m.role, text: m.text, toolCalls: m.toolCalls, results: m.results }));
  }

  async clear() {
    this.messages = [];
    this.todos = [];
    this._undo = [];
    this._redo = [];
    await fsp.writeFile(this.file, '', 'utf-8');
  }

  addUsage(inp, out, cost) {
    this.meta.inputTokens += inp;
    this.meta.outputTokens += out;
    this.meta.cost += cost;
  }

  // ── Snapshots for undo/redo ──
  async snapshotFile(relPath, cwd) {
    const full = path.resolve(cwd, relPath);
    let content = null, existed = true;
    try { content = await fsp.readFile(full, 'utf-8'); } catch { existed = false; }
    const stamp = Date.now();
    this._undo.push({ path: relPath, content, existed, stamp });
    this._redo = [];
    // Deduplicate same-stamp entries (batch)
    const dedup = [];
    for (const u of this._undo) {
      const same = dedup.find((d) => d.path === u.path && d.stamp === u.stamp);
      if (!same) dedup.push(u);
    }
    this._undo = dedup;
  }

  async undo(cwd) {
    const restored = [];
    if (!this._undo.length) return restored;
    const stamp = this._undo[this._undo.length - 1].stamp;
    const batch = [];
    while (this._undo.length && this._undo[this._undo.length - 1].stamp === stamp) {
      batch.unshift(this._undo.pop());
    }
    for (const e of batch) {
      const full = path.resolve(cwd, e.path);
      let cur = null, curExisted = true;
      try { cur = await fsp.readFile(full, 'utf-8'); } catch { curExisted = false; }
      this._redo.push({ path: e.path, content: cur, existed: curExisted });
      if (!e.existed) await fsp.rm(full, { force: true });
      else { await fsp.mkdir(path.dirname(full), { recursive: true }); await fsp.writeFile(full, e.content, 'utf-8'); }
      restored.push(e.path);
    }
    return restored;
  }

  async redo(cwd) {
    const restored = [];
    const e = this._redo.pop();
    if (!e) return restored;
    const full = path.resolve(cwd, e.path);
    if (!e.existed) await fsp.rm(full, { force: true });
    else { await fsp.mkdir(path.dirname(full), { recursive: true }); await fsp.writeFile(full, e.content, 'utf-8'); }
    restored.push(e.path);
    return restored;
  }

  exportMarkdown() {
    const m = this.meta;
    const lines = [`# ${m.title}`, '', `Model: ${m.model} · Agent: ${m.agent} · Cost: $${m.cost.toFixed(4)}`, ''];
    for (const msg of this.messages) {
      if (msg.role === 'user') lines.push(`## User\n${msg.text ?? ''}\n`);
      else if (msg.role === 'assistant' && msg.text) lines.push(`## Assistant\n${msg.text}\n`);
      else if (msg.role === 'tool' && msg.results) {
        for (const r of msg.results) lines.push(`> **${r.name}**: ${String(r.output).slice(0, 500)}\n`);
      }
    }
    return lines.join('\n');
  }

  static list() {
    let files = [];
    try { files = fs.readdirSync(sessionsDir()).filter((f) => f.endsWith('.jsonl')); } catch { return []; }
    return files.map((f) => {
      const id = f.replace('.jsonl', '');
      let meta = null, count = 0, last = null;
      try {
        for (const line of fs.readFileSync(path.join(sessionsDir(), f), 'utf-8').split('\n')) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.kind === 'meta') meta = e.meta;
          else if (!e.kind) { count++; last = e.at; }
        }
      } catch {}
      return { id, title: meta?.title ?? 'untitled', model: meta?.model ?? '', messages: count, last, cost: meta?.cost ?? 0 };
    }).sort((a, b) => String(b.last ?? '').localeCompare(String(a.last ?? '')));
  }
}
