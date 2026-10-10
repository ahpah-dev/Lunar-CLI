import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { getMoonPhase } from './moon.mjs';
import { renderMoon } from './moonArt.mjs';

// ── Moon palette ──
export const P = {
  moonlight: '#f7f3d7',
  deepSpace: '#232148',
  night: '#0b1020',
  starlight: '#a5b4fc',
  nebula: '#8b5cf6',
  cosmic: '#4c1d95',
  dusk: '#c4b5fd',
  silver: '#94a3b8',
  crater: '#64748b',
  earthshine: '#1e293b',
  highlight: '#e0e7ff',
  dim: '#475569',
  success: '#4ade80',
  warning: '#facc15',
  error: '#f87171',
  info: '#38bdf8',
};

export const c = {
  moonlight: chalk.hex(P.moonlight),
  starlight: chalk.hex(P.starlight),
  nebula: chalk.hex(P.nebula),
  dusk: chalk.hex(P.dusk),
  silver: chalk.hex(P.silver),
  crater: chalk.hex(P.crater),
  highlight: chalk.hex(P.highlight),
  dim: chalk.hex(P.dim),
  success: chalk.hex(P.success),
  warning: chalk.hex(P.warning),
  error: chalk.hex(P.error),
  info: chalk.hex(P.info),
  bold: chalk.bold,
  italic: chalk.italic,
  underline: chalk.underline,
};

export const moonGradient = gradient([P.cosmic, P.nebula, P.dusk, P.moonlight]);
export const glow = (text) => moonGradient(text);
export const star = (text) => c.starlight(text);

export const divider = (width = 50) => c.dim('─'.repeat(width));

export const pad = (text, width) => String(text).padEnd(width);

// ── 3D LUNAR banner ──
export function banner3D() {
  const text = figlet.textSync('LUNAR', { font: 'ANSI Shadow' });
  const lines = text.split('\n');
  // Add a 3D shadow layer offset by 1 space + darkened
  return lines
    .map((line) => {
      if (!line.trim()) return line;
      const shadow = ' ' + line.replace(/\S/g, ' ');
      return glow(line) + c.dim(shadow.slice(1));
    })
    .join('\n');
}

// Plain figlet (for --help etc)
export function bannerPlain() {
  return figlet.textSync('LUNAR', { font: 'ANSI Shadow' });
}

// ── Status line ──
export function statusLine({ model, agent, session, cost, mode }) {
  const modeStr = mode === 'plan' ? c.warning('plan') : c.success('build');
  return [
    c.dim('🌙'),
    c.starlight(model ?? ''),
    c.dim('·'),
    modeStr,
    c.dim('·'),
    agent,
    c.dim('·'),
    c.dim(`$${(cost ?? 0).toFixed(4)}`),
    session ? c.dim(`· ${session}`) : '',
  ].filter(Boolean).join(' ');
}

// ── Tool call display ──
export function toolCallLine(name, args) {
  const a = args ?? {};
  const short = a.command ?? a.path ?? a.pattern ?? a.url ?? a.description ?? JSON.stringify(a).slice(0, 100);
  return `${c.nebula('◈')} ${c.starlight(pad(name, 14))} ${c.dim(String(short).slice(0, 120))}`;
}

export function toolResultLine(result) {
  const first = String(result.output ?? result).split('\n')[0].slice(0, 120);
  return `  ${c.dim('└')} ${c.dim(first || '(done)')}`;
}

// ── Permission prompt ──
export function permissionPrompt(name, args) {
  const a = args ?? {};
  const detail = a.command ?? a.path ?? a.pattern ?? JSON.stringify(a).slice(0, 140);
  return [
    '',
    c.warning('  ◈ permission required') + c.dim(` — ${name}`),
    c.dim(`    ${detail}`),
    `    ${c.starlight('[y]')} once  ${c.starlight('[a]')} always  ${c.starlight('[n]')} reject`,
    '',
  ].join('\n');
}

// ── Help dialog ──
export function helpDialog(commands, keybinds) {
  const lines = [];
  lines.push('');
  lines.push(glow('  LUNAR commands'));
  lines.push(c.dim('  ' + '─'.repeat(50)));
  for (const [cmd, desc, kb] of commands) {
    const cmdPad = c.starlight(pad(cmd, 24));
    const kbStr = kb ? c.nebula(pad(`[${kb}]`, 12)) : pad('', 12);
    lines.push(`  ${cmdPad} ${kbStr} ${c.dim(desc)}`);
  }
  lines.push(c.dim('  ' + '─'.repeat(50)));
  lines.push(`  ${c.dim('Type')} ${c.starlight('!cmd')} ${c.dim('to run shell')}  ${c.starlight('@file')} ${c.dim('to attach file')}  ${c.starlight('/')} ${c.dim('for commands')}`);
  lines.push('');
  return lines.join('\n');
}

// ── Moon header ──
export function moonHeader() {
  const moon = getMoonPhase();
  const art = renderMoon(moon.position, { radius: 3 });
  const lines = art.split('\n');
  const info = [
    c.starlight.bold(moon.phase.name),
    '',
    `${c.dim('illumination')}  ${c.moonlight(Math.round(moon.illumination * 100) + '%')}`,
    `${c.dim('moon age')}     ${c.moonlight(moon.ageDays.toFixed(1) + ' days')}`,
    '',
    c.dusk(`"${moon.phase.vibe}"`),
  ];
  const maxW = Math.max(...lines.map((l) => l.length));
  const rows = Math.max(lines.length, info.length);
  const out = [];
  for (let i = 0; i < rows; i++) {
    out.push('  ' + (lines[i] ?? '').padEnd(maxW) + '   ' + (info[i] ?? ''));
  }
  return out.join('\n');
}

// ── Session info ──
export function sessionLine(session) {
  const m = session.meta;
  return [
    c.dim('  session:'),
    c.starlight(session.id),
    c.dim('· model:'),
    m.model,
    c.dim('· agent:'),
    m.agent,
    c.dim('· msgs:'),
    session.messages.length,
    c.dim('· cost:'),
    `$${m.cost.toFixed(4)}`,
  ].join(' ');
}
