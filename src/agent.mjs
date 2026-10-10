import { streamChat, resolveModel, getProvider, estimateCost } from './providers.mjs';
import { buildTools } from './tools.mjs';
import { checkPermission, alwaysPatterns } from './permissions.mjs';
import { loadMemory } from './memory.mjs';
import { resolveAgent, BUILTIN_AGENTS } from './agents.mjs';
import { mcpTools } from './mcp.mjs';

function estTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

function msgTokens(messages) {
  return messages.reduce((n, m) => n + estTokens(m.text) + estTokens(JSON.stringify(m.toolCalls)) + estTokens(JSON.stringify(m.results)), 0);
}

function buildSystem({ agentDef, cwd, config, extensions, mode, depth }) {
  const mem = loadMemory(cwd, config);
  const skills = extensions?.skillCatalog() ?? [];
  const subs = extensions?.subagents?.() ?? [];

  const parts = [
    agentDef.prompt,
    `Workspace: ${cwd}. Today: ${new Date().toDateString()}.`,
    mode === 'plan'
      ? 'MODE: plan. Explore and propose. Never modify files or run mutating commands.'
      : 'MODE: build. Make minimal, verified changes.',
    'Rules: read files before editing; prefer edit over write for existing files; run build/tests after changes; keep responses concise; use todowrite for 3+ step tasks.',
    skills.length ? `Skills (use skill tool):\n${skills.join('\n')}` : '',
    subs.length ? `Subagents (use task tool): ${subs.map((s) => `${s.name} — ${s.description}`).join('; ')}` : '',
    mem ? `Project memory:\n${mem}` : '',
    depth > 0 ? 'You are a subagent. Complete your task and return a concise summary.' : '',
  ].filter(Boolean);

  return parts.join('\n\n');
}

async function summarize({ modelStr, config, system, userText }) {
  const { provider: pid, model } = resolveModel(modelStr);
  const p = getProvider(pid, config);
  let text = '';
  for await (const ev of streamChat({ provider: p, model, system, messages: [{ role: 'user', text: userText }], tools: [], maxTokens: 2048 })) {
    if (ev.type === 'text') text += ev.delta;
  }
  return text;
}

export async function runAgent(opts) {
  const {
    prompt, session, config, cwd, extensions, hooks, mcpServers = [],
    agentName, modelStr, events = {}, interactive = false, allowAll = false,
    depth = 0, signal,
  } = opts;

  const agentDef = resolveAgent(agentName, extensions);
  const mode = agentDef.mode === 'plan' ? 'plan' : (agentDef.permission?.edit === 'deny' && agentDef.permission?.write === 'deny' ? 'plan' : 'build');
  const modelOverride = agentDef.model ?? modelStr ?? config.model;
  const { provider: pid, model } = resolveModel(modelOverride);
  const provider = getProvider(pid, config);

  // Build tool map
  const ctx = {
    cwd, config, session, hooks, extensions,
    runSubagent: async ({ description, prompt: subPrompt, agentName: subAgent }) => {
      const maxDepth = config.subagent_depth ?? 1;
      if (depth >= maxDepth) throw new Error(`Subagent depth limit (${maxDepth}) reached. Increase subagent_depth in config.`);
      const child = await runAgent({
        ...opts,
        prompt: subPrompt,
        agentName: subAgent ?? 'general',
        interactive: false,
        depth: depth + 1,
        events: { onText: () => {}, onToolStart: () => {}, onToolResult: () => {}, onUsage: () => {} },
      });
      return `Subagent "${description}" result:\n${child.text}`;
    },
    askUser: async (questions) => {
      if (!events.onQuestion) throw new Error('question tool requires interactive session');
      return events.onQuestion(questions);
    },
  };

  const toolMap = new Map();
  for (const t of Object.values(buildTools(ctx))) toolMap.set(t.name, t);
  for (const t of mcpTools(mcpServers)) toolMap.set(t.name, t);

  // Apply tool enable/disable from config
  for (const [name, on] of Object.entries(config.tools ?? {})) {
    if (on === false) toolMap.delete(name);
  }

  // Apply agent tool restrictions
  if (agentDef.tools) {
    for (const name of [...toolMap.keys()]) {
      if (!agentDef.tools.includes(name)) toolMap.delete(name);
    }
  }

  if (!interactive) toolMap.delete('question');
  if (depth > 0) toolMap.delete('question');

  const tools = [...toolMap.values()];
  const system = buildSystem({ agentDef, cwd, config, extensions, mode, depth });
  const agentPerm = agentDef.permission;

  // Build conversation
  const messages = session.history();
  messages.push({ role: 'user', text: prompt });
  await session.append('user', prompt);
  if (!session.meta.title || session.meta.title === 'untitled') {
    session.meta.title = prompt.replace(/\s+/g, ' ').slice(0, 60);
  }
  await hooks.run('prompt_submit', { prompt });

  // Session-level "always" approvals
  const alwaysAllow = new Set();
  const maxSteps = agentDef.steps ?? config.max_steps ?? 80;
  let finalText = '';
  let lastCallKey = null;
  let repeatCount = 0;

  for (let step = 0; step < maxSteps; step++) {
    // Auto-compaction
    if (msgTokens(messages) > 100_000 && config.compaction?.auto !== false) {
      await compact(messages, config, events);
    }

    let text = '';
    const calls = [];
    let inTok = 0, outTok = 0;

    try {
      for await (const ev of streamChat({
        provider, model, system, messages, tools,
        maxTokens: 8192, signal,
        temperature: agentDef.temperature ?? undefined,
      })) {
        if (ev.type === 'text') { text += ev.delta; events.onText?.(ev.delta); }
        else if (ev.type === 'thinking') events.onThinking?.(ev.delta);
        else if (ev.type === 'tool_use') calls.push({ id: ev.id, name: ev.name, arguments: ev.arguments });
        else if (ev.type === 'usage') { inTok += ev.input; outTok += ev.output; events.onUsage?.(ev.input, ev.output); }
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      throw new Error(`Model request failed: ${err.message}`);
    }

    session.addUsage(inTok, outTok, estimateCost(model, inTok, outTok, config.model_prices));

    // No tool calls → final answer
    if (!calls.length) {
      finalText = text;
      await session.append('assistant', text);
      break;
    }

    await session.append('assistant', text, calls);
    finalText = text;

    // Doom-loop guard: same tool + identical args 3 steps in a row
    const stepKey = calls.length === 1 ? `${calls[0].name}:${JSON.stringify(calls[0].arguments)}` : null;
    if (stepKey && stepKey === lastCallKey) repeatCount++;
    else {
      lastCallKey = stepKey;
      repeatCount = stepKey ? 1 : 0;
    }
    if (repeatCount >= 3) {
      repeatCount = 0;
      const verdict = checkPermission('doom_loop', {}, config, agentPerm);
      if (verdict === 'deny') {
        finalText += '\n\nStopped: repeating the same tool call. Try a different approach.';
        await session.append('assistant', finalText);
        break;
      }
      const nudge = `System: you just called ${calls[0].name} with identical arguments 3 times in a row and the result is not changing. Stop repeating it. Re-read the error/output carefully, then try a fundamentally different approach — or explain what is blocking you.`;
      const skipped = calls.map((call) => ({ id: call.id, name: call.name, output: 'Skipped: identical call repeated 3 times.', isError: true }));
      messages.push({ role: 'assistant', text, toolCalls: calls });
      messages.push({ role: 'tool', results: skipped });
      messages.push({ role: 'user', text: nudge });
      await session.append('tool', '', null, skipped);
      await session.append('user', nudge);
      events.onText?.('\n…breaking a repeated tool call…\n');
      continue;
    }

    const results = [];

    for (const call of calls) {
      const tool = toolMap.get(call.name);
      if (!tool) {
        results.push({ id: call.id, name: call.name, output: `Unknown tool: ${call.name}`, isError: true });
        continue;
      }

      events.onToolStart?.(call);

      // Permission check
      let verdict = checkPermission(call.name, call.arguments, config, agentPerm);
      if (alwaysAllow.has(call.name)) verdict = 'allow';

      if (verdict === 'ask' && interactive && events.askApproval) {
        const choice = await events.askApproval(call, alwaysPatterns(call.name, call.arguments));
        if (choice === 'always') { alwaysAllow.add(call.name); verdict = 'allow'; }
        else if (choice === 'allow' || choice === 'once') verdict = 'allow';
        else verdict = 'deny';
      } else if (verdict === 'ask') {
        verdict = allowAll ? 'allow' : 'deny';
      }

      if (verdict === 'deny') {
        results.push({ id: call.id, name: call.name, output: 'Denied by permissions.', isError: true });
        events.onToolResult?.(call, 'denied', verdict);
        continue;
      }

      await hooks.run('pre_tool', { tool: call.name, args: call.arguments });
      try {
        const output = String(await tool.execute(call.arguments ?? {}));
        results.push({ id: call.id, name: call.name, output });
        events.onToolResult?.(call, output, verdict);
      } catch (err) {
        results.push({ id: call.id, name: call.name, output: `Error: ${err.message}`, isError: true });
        events.onToolResult?.(call, `Error: ${err.message}`, verdict);
      }
      await hooks.run('post_tool', { tool: call.name });
    }

    messages.push({ role: 'assistant', text, toolCalls: calls });
    messages.push({ role: 'tool', results });
    await session.append('tool', '', null, results);
  }

  await session.saveMeta();
  return { text: finalText, model: `${pid}/${model}`, agent: agentDef.name, mode };
}

function transcriptOf(messages) {
  return messages.map((m) => {
    if (m.role === 'tool') return `tools: ${JSON.stringify(m.results).slice(0, 3000)}`;
    return `${m.role}: ${(m.text ?? '').slice(0, 3000)}`;
  }).join('\n');
}

async function compact(messages, config, events) {
  events.onText?.('\n…compacting context…\n');
  const keep = messages.slice(-6);
  const older = messages.slice(0, -6);
  if (!older.length) return;
  try {
    const summary = await summarize({
      modelStr: config.small_model ?? config.model,
      config,
      system: 'Summarize this coding session. Preserve: goal, decisions, files changed, test results, open todos.',
      userText: transcriptOf(older).slice(0, 60000),
    });
    messages.splice(0, messages.length, { role: 'user', text: `[session summary]\n${summary}` }, ...keep);
  } catch {}
}

// Force-compact a live session (used by /compact). Mutates session.messages.
export async function compactNow(session, config, events = {}) {
  if (session.messages.length <= 8) return 'nothing to compact yet';
  events.onText?.('compacting…\n');
  const keep = session.messages.slice(-6);
  const older = session.messages.slice(0, -6);
  const summary = await summarize({
    modelStr: config.small_model ?? config.model,
    config,
    system: 'Summarize this coding session. Preserve: goal, decisions, files changed, test results, open todos.',
    userText: transcriptOf(older).join('\n').slice(0, 60000),
  });
  const fresh = [{ role: 'user', text: `[session summary]\n${summary}`, at: new Date().toISOString() }, ...keep];
  await session.replaceMessages(fresh);
  return `compacted to summary + ${keep.length} recent messages`;
}
