// Provider abstraction: Anthropic Messages API + OpenAI-compatible Chat Completions
// Both support streaming + tool-calling. Ollama uses OpenAI-compatible endpoint.

const PRICES = [
  [/claude.*opus/i, 15, 75],
  [/claude.*sonnet/i, 3, 15],
  [/claude.*haiku/i, 1, 5],
  [/gpt-5(?!.*mini)/i, 5, 20],
  [/gpt-5.*mini/i, 0.5, 2],
  [/gpt-4/i, 5, 15],
  [/o[134].*mini/i, 1, 4],
  [/o[134]/i, 10, 40],
  [/gemini.*flash/i, 0.5, 2],
  [/gemini/i, 1, 4],
  [/deepseek/i, 0.5, 2],
  [/llama.*3/i, 0.5, 1],
];

export function estimateCost(model, inTok, outTok, overrides = {}) {
  let inp = 3, out = 15;
  const key = Object.keys(overrides).find((k) => model.toLowerCase().includes(k.toLowerCase()));
  if (key) [inp, out] = overrides[key];
  else {
    const row = PRICES.find(([re]) => re.test(model));
    if (row) [, inp, out] = row;
  }
  return (inTok / 1e6) * inp + (outTok / 1e6) * out;
}

export function resolveModel(str) {
  const i = str.indexOf('/');
  return i === -1 ? { provider: 'anthropic', model: str } : { provider: str.slice(0, i), model: str.slice(i + 1) };
}

const BUILTINS = {
  anthropic: { kind: 'anthropic', baseURL: 'https://api.anthropic.com', envKey: 'ANTHROPIC_API_KEY' },
  openai: { kind: 'openai', baseURL: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY' },
  ollama: { kind: 'openai', baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' },
  'openrouter': { kind: 'openai', baseURL: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY' },
  'groq': { kind: 'openai', baseURL: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY' },
  'together': { kind: 'openai', baseURL: 'https://api.together.xyz/v1', envKey: 'TOGETHER_API_KEY' },
  'deepseek': { kind: 'openai', baseURL: 'https://api.deepseek.com/v1', envKey: 'DEEPSEEK_API_KEY' },
  'xai': { kind: 'openai', baseURL: 'https://api.x.ai/v1', envKey: 'XAI_API_KEY' },
};

export function getProvider(id, config) {
  const custom = config?.provider?.[id] ?? {};
  const builtin = BUILTINS[id] ?? { kind: 'openai', envKey: `${id.replace(/-/g, '_').toUpperCase()}_API_KEY` };
  return {
    id,
    kind: custom.kind ?? builtin.kind,
    baseURL: (custom.baseURL ?? custom.base_url ?? builtin.baseURL).replace(/\/$/, ''),
    apiKey: custom.apiKey ?? custom.api_key ?? process.env[custom.envKey ?? builtin.envKey ?? ''] ?? builtin.apiKey ?? '',
    options: custom.options ?? {},
  };
}

export function listProviders(config) {
  const ids = new Set(['anthropic', 'openai', 'ollama', ...Object.keys(BUILTINS), ...Object.keys(config?.provider ?? {})]);
  return [...ids]
    .filter((id) => !config?.disabled_providers?.includes(id))
    .filter((id) => !config?.enabled_providers?.length || config.enabled_providers.includes(id))
    .map((id) => {
      const p = getProvider(id, config);
      return { id, kind: p.kind, baseURL: p.baseURL, hasKey: Boolean(p.apiKey) };
    });
}

// ── SSE reader ──
async function* sse(response) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const data = part.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { yield JSON.parse(data); } catch {}
    }
  }
}

// ── Anthropic streaming ──
function toA(messages) {
  return messages.map((m) => {
    if (m.role === 'tool') return { role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.output, is_error: r.isError === true })) };
    const content = [];
    if (m.text) content.push({ type: 'text', text: m.text });
    for (const tc of m.toolCalls ?? []) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
    return { role: m.role, content };
  });
}

async function* streamAnthropic({ provider, model, system, messages, tools, maxTokens, signal, temperature }) {
  const body = {
    model, max_tokens: maxTokens ?? 8192, system,
    messages: toA(messages),
    tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    stream: true,
  };
  if (temperature != null) body.temperature = temperature;
  const res = await fetch(`${provider.baseURL}/v1/messages`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);

  let block = null, jsonBuf = '';
  for await (const ev of sse(res)) {
    const t = ev.type;
    if (t === 'message_start') yield { type: 'usage', input: ev.message?.usage?.input_tokens ?? 0, output: 0 };
    else if (t === 'content_block_start') { block = ev.content_block; jsonBuf = ''; }
    else if (t === 'content_block_delta') {
      const d = ev.delta;
      if (d?.type === 'text_delta') yield { type: 'text', delta: d.text };
      else if (d?.type === 'input_json_delta') jsonBuf += d.partial_json ?? '';
      else if (d?.type === 'thinking_delta') yield { type: 'thinking', delta: d.thinking };
    }
    else if (t === 'content_block_stop') {
      if (block?.type === 'tool_use') {
        let args = {};
        try { args = JSON.parse(jsonBuf || '{}'); } catch {}
        yield { type: 'tool_use', id: block.id, name: block.name, arguments: args };
      }
      block = null;
    }
    else if (t === 'message_delta') yield { type: 'usage', input: 0, output: ev.usage?.output_tokens ?? 0 };
  }
}

// ── OpenAI-compatible streaming ──
function toO(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.id, content: r.output });
      continue;
    }
    const msg = { role: m.role, content: m.text ?? '' };
    if (m.toolCalls?.length) msg.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments) } }));
    out.push(msg);
  }
  return out;
}

async function* streamOpenAI({ provider, model, system, messages, tools, maxTokens, signal, temperature }) {
  const body = {
    model, messages: [{ role: 'system', content: system }, ...toO(messages)],
    tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    stream: true,
  };
  if (maxTokens) body.max_tokens = maxTokens;
  if (temperature != null) body.temperature = temperature;

  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey || 'ollama'}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${provider.id} ${res.status}: ${(await res.text()).slice(0, 400)}`);

  const calls = new Map();
  for await (const ev of sse(res)) {
    if (ev.usage) yield { type: 'usage', input: ev.usage.prompt_tokens ?? 0, output: ev.usage.completion_tokens ?? 0 };
    const d = ev.choices?.[0]?.delta;
    if (!d) continue;
    if (typeof d.content === 'string' && d.content) yield { type: 'text', delta: d.content };
    if (d.reasoning_content) yield { type: 'thinking', delta: d.reasoning_content };
    for (const tc of d.tool_calls ?? []) {
      const slot = calls.get(tc.index) ?? { id: '', name: '', args: '' };
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.name = tc.function.name;
      if (tc.function?.arguments) slot.args += tc.function.arguments;
      calls.set(tc.index, slot);
    }
  }
  for (const c of calls.values()) {
    let args = {};
    try { args = JSON.parse(c.args || '{}'); } catch {}
    yield { type: 'tool_use', id: c.id, name: c.name, arguments: args };
  }
}

export async function* streamChat(opts) {
  const { provider } = opts;
  if (!provider.apiKey && provider.id !== 'ollama') throw new Error(`No API key for "${provider.id}". Set ${provider.envKey ?? 'the env var'} or add to lunar.json.`);
  if (provider.kind === 'anthropic') yield* streamAnthropic(opts);
  else yield* streamOpenAI(opts);
}
