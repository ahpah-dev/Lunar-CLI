import { spawn } from 'node:child_process';

let rpcId = 1;

class StdioMCP {
  constructor(name, cfg) {
    this.name = name;
    this.cfg = cfg;
    this.proc = null;
    this.buf = '';
    this.pending = new Map();
  }

  start() {
    this.proc = spawn(this.cfg.command, this.cfg.args ?? [], {
      env: { ...process.env, ...(this.cfg.env ?? {}) },
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: false,
    });
    this.proc.stdout.on('data', (d) => this._onData(d));
    this.proc.on('exit', () => {
      for (const [, p] of this.pending) p.reject(new Error(`MCP "${this.name}" exited`));
      this.pending.clear();
    });
  }

  _onData(d) {
    this.buf += d.toString();
    const lines = this.buf.split('\n');
    this.buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message ?? 'MCP error'));
          else p.resolve(msg.result);
        }
      } catch {}
    }
  }

  _rpc(method, params, timeout = 30000) {
    const id = rpcId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (err) => {
        if (err) { this.pending.delete(id); reject(err); }
      });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`MCP ${method} timeout`)); }
      }, timeout);
    });
  }

  async connect() {
    this.start();
    await this._rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'lunar-cli', version: '3.0.0' },
    });
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const { tools } = await this._rpc('tools/list', {});
    this.tools = tools ?? [];
    return this.tools;
  }

  async call(name, args) {
    const result = await this._rpc('tools/call', { name, arguments: args ?? {} });
    return (result?.content ?? []).map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
  }

  stop() { try { this.proc?.kill(); } catch {} }
}

async function connectRemote(name, cfg) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(cfg.headers ?? {}) };
  const init = await fetch(cfg.url, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'lunar-cli', version: '3.0.0' } } }),
  });
  if (!init.ok) throw new Error(`HTTP ${init.status}`);
  const sid = init.headers.get('mcp-session-id');
  const h = { ...headers, ...(sid ? { 'mcp-session-id': sid } : {}) };
  const rpc = async (method, params) => {
    const r = await fetch(cfg.url, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }) });
    const text = await r.text();
    const line = text.split('\n').find((l) => l.trim().startsWith('{') || l.trim().startsWith('data:'));
    const json = JSON.parse((line ?? text).replace(/^data:\s*/, ''));
    if (json.error) throw new Error(json.error.message);
    return json.result;
  };
  const { tools } = await rpc('tools/list', {});
  return { name, tools: tools ?? [], async call(n, a) {
    const r = await rpc('tools/call', { name: n, arguments: a ?? {} });
    return (r?.content ?? []).map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
  }, stop() {} };
}

export async function connectMCP(config) {
  const servers = [];
  for (const [name, cfg] of Object.entries(config?.mcp ?? {})) {
    if (cfg.enabled === false) continue;
    try {
      if (cfg.type === 'local' || cfg.command) {
        const client = new StdioMCP(name, cfg);
        const tools = await client.connect();
        servers.push({ name, tools, call: (t, a) => client.call(t, a), stop: () => client.stop() });
      } else if (cfg.type === 'remote' || cfg.url) {
        servers.push(await connectRemote(name, cfg));
      }
    } catch (err) {
      servers.push({ name, error: err.message, tools: [], call: () => { throw err; }, stop: () => {} });
    }
  }
  return servers;
}

export function mcpTools(servers) {
  const out = [];
  for (const s of servers) {
    for (const t of s.tools ?? []) {
      out.push({
        name: `${s.name}_${t.name}`,
        description: `[mcp:${s.name}] ${t.description ?? t.name}`,
        parameters: t.inputSchema ?? { type: 'object', properties: {} },
        execute: (args) => s.call(t.name, args),
      });
    }
  }
  return out;
}

export class Hooks {
  constructor(config, cwd) {
    this.config = config;
    this.cwd = cwd;
  }

  async run(event, data = {}) {
    const entries = this.config?.hooks?.[event];
    if (!entries?.length) return;
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execA = promisify(exec);
    for (const entry of entries) {
      const cmd = typeof entry === 'string' ? entry : entry.command;
      const timeout = (typeof entry === 'object' && entry.timeout) || 10000;
      try { await execA(cmd, { cwd: this.cwd, input: JSON.stringify({ event, ...data }), timeout }); } catch {}
    }
  }
}
