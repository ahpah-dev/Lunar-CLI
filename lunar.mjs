#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
//   LUNAR 🌙 — Moonlit Terminal AI Coding Assistant
//   Version 2.3.0 · Single File · Zero Dependencies · Node 18+
//   Autonomous orbits, surgical code editing, rich interactiveness & cosmic UI.
// ═══════════════════════════════════════════════════════════════════════════════
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { execFile } from "node:child_process";
import crypto from "node:crypto";

export const VERSION = "2.3.0";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CELESTIAL PALETTE, TRUECOLOR & ASTRONOMICAL ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const isTTY = Boolean(process.stdout.isTTY);
const colorEnabled = () => isTTY && !process.env.NO_COLOR;
const isTrueColor = () =>
  colorEnabled() &&
  Boolean(
    process.env.COLORTERM === "truecolor" ||
    process.env.COLORTERM === "24bit" ||
    process.env.WT_SESSION ||
    process.env.TERM_PROGRAM === "vscode"
  );

// TrueColor RGB or 256-color fallback
export function rgb(r, g, b, str) {
  if (!colorEnabled()) return String(str);
  if (isTrueColor()) return `\x1b[38;2;${r};${g};${b}m${str}\x1b[0m`;
  // Approximate to nearest 256-color
  const code = 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
  return `\x1b[38;5;${code}m${str}\x1b[0m`;
}

export function bgRgb(r, g, b, str) {
  if (!colorEnabled()) return String(str);
  if (isTrueColor()) return `\x1b[48;2;${r};${g};${b}m${str}\x1b[0m`;
  const code = 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
  return `\x1b[48;5;${code}m${str}\x1b[0m`;
}

const paint = (v, code) =>
  colorEnabled() ? `\x1b[${String(code).replace(/m$/, "")}m${v}\x1b[0m` : String(v);

// Celestial Color Primitives
export const moon      = (t) => rgb(248, 250, 252, t); // Bright Platinum
export const text      = (t) => rgb(226, 232, 240, t); // Moonlight Silver
export const dim       = (t) => rgb(148, 163, 184, t); // Space Slate
export const faint     = (t) => rgb(71, 85, 105, t);   // Deep Cosmic Slate
export const accent    = (t) => rgb(192, 132, 252, t); // Celestial Lavender Glow
export const starlight = (t) => rgb(56, 189, 248, t);  // Electric Starlight Cyan
export const aurora    = (t) => rgb(52, 211, 153, t);  // Aurora Jade Emerald
export const amber     = (t) => rgb(251, 191, 36, t);  // Crescent Moon Gold
export const eclipse   = (t) => rgb(248, 113, 113, t); // Blood Moon Crimson
export const bold      = (t) => paint(t, "1");
export const italic    = (t) => paint(t, "3");
export const underline = (t) => paint(t, "4");
export const inverse   = (t) => paint(t, "7");

export const ok   = aurora;
export const info = starlight;
export const warn = amber;
export const err  = eclipse;

// Code pill styling: slate background with cyan text
export const pill = (t) =>
  colorEnabled() ? `${bgRgb(30, 41, 59, starlight(` ${t} `))}` : `\`${t}\``;

const BADGE_COLORS = {
  ok: [52, 211, 153],
  warn: [251, 191, 36],
  err: [248, 113, 113],
  info: [56, 189, 248],
  accent: [192, 132, 252],
  dim: [148, 163, 184],
};

export const badge = (lbl, kind = "info") => {
  const [r, g, b] = BADGE_COLORS[kind] || BADGE_COLORS.info;
  return colorEnabled() ? `${bgRgb(24, 24, 37, rgb(r, g, b, ` ${lbl} `))}` : `[${lbl}]`;
};

export const columns = () => Math.max(48, process.stdout.columns || 80);

const UNICODE = process.platform !== "win32"
  || Boolean(process.env.WT_SESSION)
  || process.env.TERM_PROGRAM === "vscode"
  || process.env.ConEmuTask === "ON";

export const SYMBOL = {
  moon: "☾", fullMoon: "●", star: "✦", sparkle: "⋆", bullet: "·",
  check: "✓", cross: "✕", arrow: "❯", prompt: "›", tool: "⚙",
  branch: "⎇", dot: "●", ring: "○", halfDot: "◐", right: "→", ell: "…",
  vbar: "│", hbar: "─", tee: "├", corner: "└", up: "↑", down: "↓",
  alert: "▲", note: "ℹ", block: "█", shade: "░",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  moonSpinner: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"],
};

export const BOX = UNICODE
  ? { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" }
  : { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" };

const ANSI_REGEX = /\x1b\[[0-9;?]*[a-zA-Z]/g;
export const strip = (str = "") => String(str).replace(ANSI_REGEX, "");
export const width = (str = "") => [...strip(str)].length;

export function padEnd(str = "", len = 0, fill = " ") {
  const s = String(str);
  return s + fill.repeat(Math.max(0, len - width(s)));
}

export function padStart(str = "", len = 0, fill = " ") {
  const s = String(str);
  return fill.repeat(Math.max(0, len - width(s))) + s;
}

export function truncate(str = "", max = 80) {
  const plain = strip(str);
  if (max <= 0) return "";
  if ([...plain].length <= max) return String(str);
  return [...plain].slice(0, Math.max(0, max - 1)).join("") + SYMBOL.ell;
}

export function wrap(str = "", max = columns()) {
  const limit = Math.max(8, max);
  return String(str).split("\n").flatMap((line) => {
    if (width(line) <= limit) return [line];
    const out = [];
    let current = "";
    for (const word of line.split(/(\s+)/)) {
      if (width(current + word) > limit && current.trim()) {
        out.push(current.trimEnd());
        current = word.replace(/^\s+/, "");
      }
      current += word;
    }
    if (current.trim()) out.push(current.trimEnd());
    return out.length ? out : [""];
  });
}

// TrueColor Celestial Gradient Interpolation
export function gradient(value, colors = [
  [168, 85, 247],  // Violet
  [192, 132, 252], // Lavender
  [56, 189, 248],  // Starlight Cyan
  [147, 197, 253], // Ice Blue
  [248, 250, 252], // Moonlight White
]) {
  const chars = [...String(value)];
  if (!colorEnabled()) return chars.join("");
  const total = Math.max(1, chars.length - 1);
  return chars.map((ch, i) => {
    if (ch === " ") return ch;
    const pos = (i / total) * (colors.length - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const c1 = colors[idx] || colors[0];
    const c2 = colors[idx + 1] || c1;
    const r = Math.round(c1[0] + frac * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + frac * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + frac * (c2[2] - c1[2]));
    return rgb(r, g, b, ch);
  }).join("");
}

export const PHASES = [
  { name: "New Moon", icon: "🌑", desc: "Perigee Alignment" },
  { name: "Waxing Crescent", icon: "🌒", desc: "Early Crescent" },
  { name: "First Quarter", icon: "🌓", desc: "Half Orbit" },
  { name: "Waxing Gibbous", icon: "🌔", desc: "Approaching Zenith" },
  { name: "Full Moon", icon: "🌕", desc: "Max Illumination" },
  { name: "Waning Gibbous", icon: "🌖", desc: "Post-Zenith Orbit" },
  { name: "Third Quarter", icon: "🌗", desc: "Waning Quarter" },
  { name: "Waning Crescent", icon: "🌘", desc: "Final Crescent" },
];

export function getAstronomicalMoon(date = new Date()) {
  const synodic = 29.53058867;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const age = ((date.getTime() / 86400000 - ref) % synodic + synodic) % synodic;
  const phaseIdx = Math.floor((age / synodic) * 8) % 8;
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / synodic)) / 2) * 100);
  const daysToFull = (synodic / 2 - age + synodic) % synodic;
  return {
    ...PHASES[phaseIdx],
    ageDays: age.toFixed(1),
    illumination,
    daysToFull: daysToFull.toFixed(1),
  };
}

export function fmtTokens(n = 0) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export function fmtCost(usd = 0) {
  if (!usd) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return "$" + usd.toFixed(2);
}

export function fmtDuration(ms = 0) {
  if (!ms || ms < 1) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VISUAL BANNERS, CARDS & STATUS BARS
// ─────────────────────────────────────────────────────────────────────────────
export const CRESCENT_LOGO = [
  "        .---.       ██╗     ██╗   ██╗ ███╗   ██╗ █████╗ ██████╗ ",
  "       /     \\      ██║     ██║   ██║ ████╗  ██║██╔══██╗██╔══██╗",
  "      |   ☾   |     ██║     ██║   ██║ ██╔██╗ ██║███████║██████╔╝",
  "       \\     /      ██║     ██║   ██║ ██║╚██╗██║██╔══██║██╔══██╗",
  "        `---'       ███████╗╚██████╔╝ ██║ ╚████║██║  ██║██║  ██║",
  "                    ╚══════╝ ╚═════╝  ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝",
];

export function printBanner({ model = "", provider = "", mode = "" } = {}) {
  const moonInfo = getAstronomicalMoon();
  const maxW = Math.min(columns() - 4, 76);
  const rule = faint(BOX.h.repeat(maxW));

  console.log("");
  console.log(gradient(CRESCENT_LOGO.join("\n")));
  console.log("");
  console.log(`  ${rule}`);
  console.log(`  ${accent(SYMBOL.star)} ${bold(moon("MOONLIT CODING AGENT"))}  ${dim("·")}  ${starlight(`${moonInfo.icon} ${moonInfo.name}`)} ${dim(`(${moonInfo.illumination}% lit)`)}  ${dim("·")}  ${faint(`v${VERSION}`)}`);
  console.log(`  ${rule}`);

  if (provider || model) {
    const route = [
      provider ? badge(provider, "info") : "",
      model ? ` ${starlight(model)}` : "",
      mode ? ` ${dim("persona:")}${accent(mode)}` : "",
    ].join("");
    console.log(`  ${amber(SYMBOL.moon)} ${route}`);
    console.log(`  ${rule}`);
  }

  console.log(`  ${faint("Type anything  ·  /help for orbits & commands  ·  @file attach  ·  !cmd shell")}`);
  console.log("");
}

export function printMiniBanner() {
  const moonInfo = getAstronomicalMoon();
  console.log("");
  console.log(`  ${gradient(`${SYMBOL.moon} LUNAR`)}  ${starlight(moonInfo.icon)}  ${dim("moonlit terminal agent")}  ${faint(`v${VERSION}`)}`);
  console.log("");
}

export function printAmbientBar({ provider = "", model = "", mode = "vibe", perm = "ask" } = {}) {
  const moonInfo = getAstronomicalMoon();
  const pStr = provider ? `${provider}:${truncate(model, 24)}` : "offline";
  const content = ` ☾ LUNAR v${VERSION}  ${dim("│")}  ${moonInfo.icon} ${moonInfo.illumination}%  ${dim("│")}  ✦ ${pStr}  ${dim("│")}  ${accent(mode)}  ${dim("│")}  ${amber(perm)} `;
  const border = faint(BOX.h.repeat(Math.max(12, width(content) + 2)));
  console.log(`  ${faint(BOX.tl)}${border}${faint(BOX.tr)}`);
  console.log(`  ${faint(BOX.v)} ${content} ${faint(BOX.v)}`);
  console.log(`  ${faint(BOX.bl)}${border}${faint(BOX.br)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SYNTAX HIGHLIGHTER & STREAMING MARKDOWN RENDERER
// ─────────────────────────────────────────────────────────────────────────────
const SYNTAX_KEYWORDS = new Set([
  "const", "let", "var", "function", "class", "return", "if", "else", "for", "while",
  "async", "await", "import", "export", "from", "def", "try", "catch", "throw", "switch",
  "case", "break", "default", "new", "this", "typeof", "interface", "type", "public", "private",
]);

export function highlightCodeLine(line = "") {
  if (!colorEnabled()) return line;
  return line
    .replace(/\b([a-zA-Z_]\w*)\b(?=\s*\()/g, (_, fn) => starlight(fn))
    .replace(/\b([a-zA-Z_]\w*)\b/g, (m) => (SYNTAX_KEYWORDS.has(m) ? accent(m) : m))
    .replace(/(".*?"|'.*?'|`.*?`)/g, (str) => aurora(str))
    .replace(/\b(\d+|true|false|null|undefined)\b/g, (lit) => amber(lit))
    .replace(/(\/\/[^\n]*|#[^\n]*|\/\*.*?\*\/)/g, (comm) => faint(comm));
}

export function markdownLineRenderer() {
  let insideCode = false;
  return (line) => {
    const raw = String(line);

    // Code block boundary
    if (/^\s*(```|~~~)/.test(raw)) {
      insideCode = !insideCode;
      return faint(raw);
    }
    if (insideCode) {
      return `  ${highlightCodeLine(raw)}`;
    }

    let out = raw;

    // Headings
    const h = out.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const [, marks, lbl] = h;
      const icon = marks.length >= 3 ? SYMBOL.bullet : marks.length === 2 ? SYMBOL.star : SYMBOL.moon;
      return `\n  ${accent(`${icon} ${lbl}`)}`;
    }

    // Blockquote
    if (/^\s*>\s?/.test(out)) {
      return `  ${faint(BOX.v)} ${dim(italic(out.replace(/^\s*>\s?/, "")))}`;
    }

    // Horizontal Rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(out)) {
      return `  ${faint(BOX.h.repeat(Math.min(48, columns() - 4)))}`;
    }

    // Inline formatting: code pills, bold, italic, links
    out = out
      .replace(/`([^`]+)`/g, (_, code) => pill(code))
      .replace(/\*\*([^*]+)\*\*/g, (_, b) => bold(b))
      .replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, (_, it) => italic(it))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, lbl, url) => `${underline(starlight(lbl))} ${faint(`(${url})`)}`);

    // Lists
    const bullet = out.match(/^(\s*)[-*+]\s+/);
    const num = out.match(/^(\s*)(\d+)\.\s+/);
    if (bullet) out = `${bullet[1]}${dim(SYMBOL.bullet)} ${out.slice(bullet[0].length)}`;
    else if (num) out = `${num[1]}${accent(num[2] + ".")} ${out.slice(num[0].length)}`;

    return out;
  };
}

export function createStream(out = process.stdout) {
  const render = markdownLineRenderer();
  let buffer = "";
  let wrote = false;
  return {
    push(chunk) {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        out.write((isTTY ? render(line) : line) + "\n");
        wrote = true;
      }
    },
    flush() {
      if (buffer) {
        out.write(isTTY ? render(buffer) : buffer);
        buffer = "";
        wrote = true;
      }
      if (wrote) out.write("\n");
      const was = wrote;
      wrote = false;
      return was;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PANELS, TABLES, DIFFS & TODO PROGRESS BARS
// ─────────────────────────────────────────────────────────────────────────────
export function panel(title = "", rows = [], { footer = "" } = {}) {
  const inner = Math.min(Math.max(columns() - 6, 36), 96);
  const labelWidth = Math.min(24, Math.max(...rows.map(([lbl]) => width(String(lbl))), 8));
  const titleText = title ? ` ${badge(title, "accent")} ` : "";
  const topFill = Math.max(1, inner - width(titleText) - 1);
  const out = [`${faint(BOX.tl + BOX.h)}${titleText}${faint(BOX.h.repeat(topFill))}${faint(BOX.tr)}`];

  const valIndent = labelWidth + 2;
  for (const [lbl, val] of rows) {
    const body = String(val ?? "");
    const lead = `${accent(padEnd(String(lbl ?? ""), labelWidth))}  `;
    const chunks = body.startsWith("\n")
      ? ["", ...wrap(body.slice(1), Math.max(8, inner - valIndent))]
      : wrap(body, Math.max(8, inner - valIndent));
    for (const [i, line] of chunks.entries()) {
      out.push(`${faint(BOX.v)}  ${i === 0 ? lead : " ".repeat(valIndent)}${line}`);
    }
  }
  if (!rows.length) out.push(`${faint(BOX.v)}  ${dim("(empty)")}`);

  if (footer) {
    const fText = ` ${dim(footer)} `;
    const bFill = Math.max(0, inner - width(fText) - 1);
    out.push(`${faint(BOX.v)}`);
    out.push(`${faint(BOX.bl)}${fText}${faint(BOX.h.repeat(bFill))}${faint(BOX.br)}`);
  } else {
    out.push(`${faint(BOX.bl + BOX.h.repeat(inner + 2) + BOX.br)}`);
  }
  return out.map((l) => "  " + l).join("\n");
}

export function table(headers, rows, { align = [] } = {}) {
  const widths = headers.map((h, i) =>
    Math.max(width(h), ...rows.map((r) => width(String(r[i] ?? ""))), 3)
  );
  const makeLine = (cells, fn = (x) => x) =>
    "  " + cells.map((c, i) =>
      align[i] === "r" ? padStart(fn(String(c ?? "")), widths[i]) : padEnd(fn(String(c ?? "")), widths[i])
    ).join("  ");
  const rule = "  " + widths.map((w) => faint(BOX.h.repeat(w))).join("  ");
  return [
    makeLine(headers, accent),
    rule,
    ...rows.map((r) => makeLine(r)),
  ].join("\n");
}

// Unified Surgical Diff with Line Numbers
export function renderDiff(oldStr = "", newStr = "", maxLines = 20) {
  const b = String(oldStr).split("\n");
  const a = String(newStr).split("\n");
  const diffs = [];
  const len = Math.max(b.length, a.length);

  for (let i = 0; i < len && diffs.length < maxLines; i++) {
    const num = padStart(String(i + 1), 4);
    if (b[i] !== a[i]) {
      if (b[i] !== undefined) {
        diffs.push(`  ${faint(num)} │ ${eclipse(`- ${truncate(b[i], 110)}`)}`);
      }
      if (a[i] !== undefined) {
        diffs.push(`  ${faint(num)} │ ${aurora(`+ ${truncate(a[i], 110)}`)}`);
      }
    } else if (i < 3 || i >= len - 2) {
      diffs.push(`  ${faint(num)} │ ${faint(`  ${truncate(b[i] || "", 110)}`)}`);
    }
  }
  if (!diffs.length) return dim("    (no visible difference)");
  if (len > maxLines) diffs.push(faint(`       │ ${SYMBOL.ell} ${len} lines total`));
  return diffs.join("\n");
}

export function renderProgressBar(completed, total, barWidth = 20) {
  if (total <= 0) return "";
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const filled = Math.round((pct / 100) * barWidth);
  const empty = Math.max(0, barWidth - filled);
  const bar = `${aurora(SYMBOL.block.repeat(filled))}${faint(SYMBOL.shade.repeat(empty))}`;
  return `[${bar}] ${starlight(`${pct}%`)} (${completed}/${total})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTERACTIVE RAW-MODE PICKER & TOOL MODALS
// ─────────────────────────────────────────────────────────────────────────────
export async function pickInteractive({
  question = "Select Option",
  items = [],
  defaultIdx = 0,
  footer = "↑/↓ move · Enter select · Esc cancel · Type to filter",
} = {}) {
  if (!items.length) return null;
  if (!isTTY || typeof process.stdin.setRawMode !== "function") {
    // Non-interactive fallback
    console.log(`\n  ${accent(SYMBOL.star)} ${accent(question)}`);
    items.forEach((it, i) => console.log(`  ${i + 1}. ${it.label} ${dim(it.hint || "")}`));
    return items[defaultIdx]?.value;
  }

  const stdin = process.stdin;
  readline.emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  let query = "";
  let cursor = defaultIdx;
  let drawnLines = 0;
  const maxRows = 10;

  const getFiltered = () => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.label} ${it.value} ${it.hint || ""}`.toLowerCase().includes(q)
    );
  };

  const clearDrawn = () => {
    if (drawnLines > 0) {
      process.stdout.write(`\x1b[${drawnLines}A\x1b[0J`);
      drawnLines = 0;
    }
  };

  const render = () => {
    clearDrawn();
    const filtered = getFiltered();
    if (cursor >= filtered.length) cursor = Math.max(0, filtered.length - 1);

    const out = [];
    out.push(`  ${accent(SYMBOL.moon)} ${bold(moon(question))} ${dim(`(${filtered.length}/${items.length})`)}`);
    out.push(`  ${amber(SYMBOL.prompt)} ${starlight(query)}${dim(SYMBOL.block)}`);
    out.push("");

    if (!filtered.length) {
      out.push(`    ${warn("No matches found.")}`);
    } else {
      const start = Math.max(0, Math.min(cursor - Math.floor(maxRows / 2), filtered.length - maxRows));
      const slice = filtered.slice(start, start + maxRows);

      if (start > 0) out.push(`    ${faint("↑ more above")}`);
      for (const [idx, item] of slice.entries()) {
        const actualIdx = start + idx;
        const isSelected = actualIdx === cursor;
        const marker = isSelected ? accent(SYMBOL.arrow) : " ";
        const lbl = isSelected ? bold(starlight(item.label)) : text(item.label);
        const hnt = item.hint ? ` ${dim(item.hint)}` : "";
        const curBadge = item.isCurrent ? ` ${badge("active", "accent")}` : "";
        out.push(`  ${marker} ${lbl}${hnt}${curBadge}`);
      }
      if (start + maxRows < filtered.length) out.push(`    ${faint("↓ more below")}`);
    }

    out.push("");
    out.push(`  ${faint(footer)}`);

    drawnLines = out.length;
    process.stdout.write(out.join("\n") + "\n");
  };

  return new Promise((resolve) => {
    render();

    const onKeypress = (str, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup(null);
      } else if (key.name === "escape") {
        cleanup(null);
      } else if (key.name === "return" || key.name === "enter") {
        const filtered = getFiltered();
        cleanup(filtered[cursor]?.value ?? null);
      } else if (key.name === "up" || (key.ctrl && key.name === "p")) {
        const filtered = getFiltered();
        cursor = (cursor - 1 + filtered.length) % Math.max(1, filtered.length);
        render();
      } else if (key.name === "down" || (key.ctrl && key.name === "n")) {
        const filtered = getFiltered();
        cursor = (cursor + 1) % Math.max(1, filtered.length);
        render();
      } else if (key.name === "backspace") {
        query = query.slice(0, -1);
        cursor = 0;
        render();
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        query += str;
        cursor = 0;
        render();
      }
    };

    const cleanup = (val) => {
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(wasRaw);
      clearDrawn();
      resolve(val);
    };

    stdin.on("keypress", onKeypress);
  });
}

// Multi-Action Interactive Tool Modal
export async function confirmActionModal({ toolName, target, diff = "", command = "", details = [] }) {
  if (!isTTY || typeof process.stdin.setRawMode !== "function") {
    // Non-interactive fallback
    console.log(`\n  ${warn(SYMBOL.alert)} Permission requested for ${accent(toolName)} on ${text(target)}`);
    return "y";
  }

  const stdin = process.stdin;
  readline.emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  const options = [
    { key: "y", label: "[y] Approve & Execute", hint: "Allow this operation" },
    { key: "n", label: "[n] Deny Action", hint: "Skip and inform agent" },
    { key: "a", label: "[a] Always Approve (YOLO)", hint: "Auto-approve all future actions in orbit" },
    { key: "e", label: "[e] Explain Action", hint: "Request agent to elaborate why" },
  ];
  let cursor = 0;
  let drawnLines = 0;

  const clearDrawn = () => {
    if (drawnLines > 0) {
      process.stdout.write(`\x1b[${drawnLines}A\x1b[0J`);
      drawnLines = 0;
    }
  };

  const render = () => {
    clearDrawn();
    const rows = [
      ["Tool", accent(toolName)],
      ["Target", starlight(target || command)],
      ...details,
      ...(diff ? [["Diff", "\n" + diff]] : []),
    ];

    const out = [];
    out.push("");
    out.push(panel(`☾ ACTION PERMISSION REQUEST`, rows));
    out.push("");
    out.push(`  ${bold(moon("Select response (use keys y/n/a/e or ↑/↓ + Enter):"))}`);

    for (const [idx, opt] of options.entries()) {
      const isSel = idx === cursor;
      const mark = isSel ? accent(SYMBOL.arrow) : " ";
      const lbl = isSel ? bold(starlight(opt.label)) : text(opt.label);
      out.push(`  ${mark} ${lbl}  ${dim(opt.hint)}`);
    }

    drawnLines = out.length;
    process.stdout.write(out.join("\n") + "\n");
  };

  return new Promise((resolve) => {
    render();

    const onKeypress = (str, key) => {
      const char = (str || "").toLowerCase();
      if (key.ctrl && key.name === "c") {
        cleanup("n");
      } else if (char === "y" || char === "n" || char === "a" || char === "e") {
        cleanup(char);
      } else if (key.name === "return" || key.name === "enter") {
        cleanup(options[cursor].key);
      } else if (key.name === "up") {
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      } else if (key.name === "down") {
        cursor = (cursor + 1) % options.length;
        render();
      }
    };

    const cleanup = (choice) => {
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(wasRaw);
      clearDrawn();
      resolve(choice);
    };

    stdin.on("keypress", onKeypress);
  });
}

// Live Animated Orbit Spinner with Stopwatch
export function createOrbitSpinner(initialLabel = "Orbiting neural network") {
  if (!isTTY) {
    return {
      setLabel: () => {},
      stop: () => {},
    };
  }

  let frame = 0;
  let label = initialLabel;
  const start = Date.now();
  let timer = null;

  const render = () => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const moonIcon = SYMBOL.moonSpinner[frame % SYMBOL.moonSpinner.length];
    const spinGlyph = SYMBOL.spinner[frame % SYMBOL.spinner.length];
    const line = `  ${accent(moonIcon)} ${starlight(spinGlyph)} ${dim(`[${elapsed}s]`)} ${dim(label)}…`;
    process.stdout.write(`\r\x1b[2K${line}`);
    frame++;
  };

  timer = setInterval(render, 80);
  if (typeof timer.unref === "function") timer.unref();

  return {
    setLabel(newLabel) {
      label = newLabel;
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        process.stdout.write("\r\x1b[2K");
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CONFIGURATION, PATHS & PRESETS
// ─────────────────────────────────────────────────────────────────────────────
export const LUNAR_DIR = path.join(os.homedir(), ".lunar");
export const CONFIG_FILE = path.join(LUNAR_DIR, "config.json");
export const SESSIONS_DIR = path.join(LUNAR_DIR, "sessions");
export const STATS_FILE = path.join(LUNAR_DIR, "stats.json");
export const LAST_FILE = path.join(LUNAR_DIR, "last_session");

export const PRESETS = {
  openrouter: {
    label: "OpenRouter (Cloud Hub)",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "nvidia/nemotron-3.5-lightning:free",
    protocol: "openai",
    hint: "500+ models, verified free tiers & frontier reasoning",
  },
  "9router": {
    label: "9Router (Local Gateway)",
    baseUrl: "http://127.0.0.1:20128/v1",
    envKey: "NINE_ROUTER_API_KEY",
    defaultModel: "oc/space-bunny-free",
    protocol: "openai",
    local: true,
    hint: "local multi-provider gateway on port 20128",
  },
  ollama: {
    label: "Ollama (Local Models)",
    baseUrl: "http://127.0.0.1:11434/v1",
    envKey: "",
    defaultModel: "gemma4:gpu",
    protocol: "openai",
    local: true,
    keyless: true,
    hint: "zero-key local GPU inference on port 11434",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    protocol: "openai",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-7-sonnet-20250219",
    protocol: "anthropic",
  },
  groq: {
    label: "Groq (Ultra-Fast)",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    protocol: "openai",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    protocol: "openai",
  },
  lmstudio: {
    label: "LM Studio (Local)",
    baseUrl: "http://127.0.0.1:1234/v1",
    envKey: "",
    defaultModel: "local-model",
    protocol: "openai",
    local: true,
    keyless: true,
  },
  custom: {
    label: "Custom Endpoint",
    baseUrl: "http://127.0.0.1:8000/v1",
    envKey: "CUSTOM_API_KEY",
    defaultModel: "default",
    protocol: "openai",
  },
};

export const DEFAULT_CONFIG = {
  provider: "openrouter",
  model: "nvidia/nemotron-3.5-lightning:free",
  baseUrl: "https://openrouter.ai/api/v1",
  mode: "vibe",
  permissionMode: "ask",
  autoApprove: false,
  maxToolRounds: 16,
  maxHistoryChars: 160000,
  requestTimeout: 300000,
  apiFormat: "openai",
  theme: "moon",
};

export const MODES = {
  vibe: {
    label: "vibe",
    blurb: "intuitive, rapid pair-programmer with momentum",
    prompt: "You are LUNAR, an elite moonlit coding agent. Think deeply, act decisively, and make surgical, verified changes.",
  },
  architect: {
    label: "architect",
    blurb: "system boundaries, robust architecture, and data flow",
    prompt: "You are LUNAR in Software Architect mode. Design clean abstractions, state models, and scalable systems before code.",
  },
  debug: {
    label: "debug",
    blurb: "scientific root-cause analysis and defect isolation",
    prompt: "You are LUNAR in Debugger mode. Formulate hypotheses, inspect state with tools, pinpoint the root defect, and verify the fix.",
  },
  teach: {
    label: "teach",
    blurb: "concise architectural walkthroughs and concepts",
    prompt: "You are LUNAR in Teacher mode. Explain mechanisms clearly with succinct examples, tradeoffs, and key insights.",
  },
  plan: {
    label: "plan",
    blurb: "read-only exploration and sequenced work blueprints",
    prompt: "You are LUNAR in Planning mode (read-only). Survey the codebase with read tools, then generate an actionable, ordered checklist with acceptance tests. Do not modify files.",
  },
  review: {
    label: "review",
    blurb: "findings-first audit: bugs, perf, security, readability",
    prompt: "You are LUNAR in Code Review mode. Prioritize critical bugs and security findings first with file:line citations, followed by concrete improvements.",
  },
};

export async function ensureDirs() {
  await fs.mkdir(LUNAR_DIR, { recursive: true });
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

export async function loadConfig() {
  await ensureDirs();
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(cfg) {
  await ensureDirs();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

export function maskKey(k = "") {
  const s = String(k || "");
  if (!s) return "(none)";
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-4)} (${s.length} chars)`;
}

export async function findLocalNineRouterKey() {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const dbPath = process.platform === "win32"
      ? path.join(base, "9router", "db", "data.sqlite")
      : path.join(os.homedir(), ".9router", "db", "data.sqlite");
    if (!fsSync.existsSync(dbPath)) return null;
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const row = db.prepare("SELECT key, name FROM apiKeys WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1").get()
        || db.prepare("SELECT key, name FROM apiKeys ORDER BY createdAt DESC LIMIT 1").get();
      if (row?.key && typeof row.key === "string") {
        return { key: row.key, name: row.name || "Default Key" };
      }
      return null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function findLocalProviderKey(provider = "") {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const dbPath = process.platform === "win32"
      ? path.join(base, "9router", "db", "data.sqlite")
      : path.join(os.homedir(), ".9router", "db", "data.sqlite");
    if (!fsSync.existsSync(dbPath)) return null;
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare("SELECT provider, data FROM providerConnections").all();
      for (const r of rows) {
        if (r.provider?.toLowerCase() === provider.toLowerCase()) {
          try {
            const parsed = JSON.parse(r.data || "{}");
            if (parsed.apiKey) return parsed.apiKey;
            if (parsed.accessToken) return parsed.accessToken;
          } catch {}
        }
      }
      return null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function resolveApiKey(cfg) {
  if (cfg._apiKey) return cfg._apiKey;
  if (process.env.LUNAR_API_KEY) return process.env.LUNAR_API_KEY;
  const envVar = PRESETS[cfg.provider]?.envKey;
  if (envVar && process.env[envVar]) return process.env[envVar];

  if (cfg.provider === "9router") {
    const discovered = await findLocalNineRouterKey();
    if (discovered?.key) return discovered.key;
  }

  const connectedKey = await findLocalProviderKey(cfg.provider);
  if (connectedKey) return connectedKey;

  return cfg.apiKey || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. STATS & COST ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────
const PRICING_PER_M = {
  "gpt-4o": { in: 2.50, out: 10.00 },
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "claude-3-7-sonnet-20250219": { in: 3.00, out: 15.00 },
  "claude-3-5-sonnet": { in: 3.00, out: 15.00 },
  "deepseek-chat": { in: 0.27, out: 1.10 },
  "deepseek/deepseek-v4.1-flash": { in: 0.30, out: 1.20 },
};

export function estimateCost(model = "", inputTokens = 0, outputTokens = 0) {
  const p = PRICING_PER_M[model] || { in: 0.50, out: 2.00 };
  return ((inputTokens * p.in) + (outputTokens * p.out)) / 1_000_000;
}

export async function recordStats({ model, inputTokens = 0, outputTokens = 0, durationMs = 0 }) {
  await ensureDirs();
  let stats = { totalTurns: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0, estCostUsd: 0 };
  try {
    const raw = JSON.parse(await fs.readFile(STATS_FILE, "utf8"));
    stats = {
      totalTurns: raw.totalTurns ?? raw.totals?.calls ?? 0,
      inputTokens: raw.inputTokens ?? raw.totals?.input ?? 0,
      outputTokens: raw.outputTokens ?? raw.totals?.output ?? 0,
      totalDurationMs: raw.totalDurationMs ?? 0,
      estCostUsd: raw.estCostUsd ?? raw.totals?.cost ?? 0,
    };
  } catch {}
  stats.totalTurns += 1;
  stats.inputTokens += inputTokens;
  stats.outputTokens += outputTokens;
  stats.totalDurationMs += durationMs;
  stats.estCostUsd += estimateCost(model, inputTokens, outputTokens);
  await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), "utf8").catch(() => {});
}

export async function readStats() {
  try {
    const raw = JSON.parse(await fs.readFile(STATS_FILE, "utf8"));
    return {
      totalTurns: raw.totalTurns ?? raw.totals?.calls ?? 0,
      inputTokens: raw.inputTokens ?? raw.totals?.input ?? 0,
      outputTokens: raw.outputTokens ?? raw.totals?.output ?? 0,
      totalDurationMs: raw.totalDurationMs ?? 0,
      estCostUsd: raw.estCostUsd ?? raw.totals?.cost ?? 0,
    };
  } catch {
    return { totalTurns: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0, estCostUsd: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROJECT CONTEXT & FILE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_IGNORES = [
  ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
  ".next", ".nuxt", "coverage", ".turbo", ".DS_Store", "Thumbs.db",
];

export function safeJoin(root, relPath) {
  if (!relPath || typeof relPath !== "string") return null;
  const clean = path.normalize(relPath).replace(/^[a-zA-Z]:[\\/]/, "");
  const target = path.resolve(root, clean);
  const resolvedRoot = path.resolve(root);
  if (!target.startsWith(resolvedRoot)) return null;
  return target;
}

export function matchGlob(str, pattern) {
  const rx = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i");
  return rx.test(str);
}

export async function loadIgnores(root) {
  const list = [...DEFAULT_IGNORES];
  for (const f of [".lunarignore", ".gitignore"]) {
    try {
      const raw = await fs.readFile(path.join(root, f), "utf8");
      for (const line of raw.split("\n")) {
        const tr = line.trim();
        if (tr && !tr.startsWith("#")) list.push(tr);
      }
    } catch {}
  }
  return [...new Set(list)];
}

export function isIgnored(relPath, ignores = []) {
  const norm = relPath.replace(/\\/g, "/");
  const parts = norm.split("/");
  for (const ign of ignores) {
    const clean = ign.replace(/\\/g, "/").replace(/\/$/, "");
    if (parts.includes(clean)) return true;
    if (norm === clean || norm.startsWith(clean + "/")) return true;
    if (matchGlob(path.basename(norm), clean)) return true;
  }
  return false;
}

export async function loadProjectGuide(root) {
  for (const dir of [root, path.dirname(root)]) {
    const p = path.join(dir, "LUNAR.md");
    try {
      return (await fs.readFile(p, "utf8")).trim();
    } catch {}
  }
  return "";
}

export async function expandPromptMacros(promptText, root, ignores) {
  let expanded = promptText;
  const matches = promptText.matchAll(/@([^\s"']+)/g);
  for (const m of matches) {
    const rel = m[1];
    const full = safeJoin(root, rel);
    if (!full || isIgnored(rel, ignores)) continue;
    try {
      const stat = await fs.stat(full);
      if (stat.isFile() && stat.size <= 200_000) {
        const content = await fs.readFile(full, "utf8");
        expanded = expanded.replace(m[0], `\n[File: ${rel}]\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\`\n`);
      }
    } catch {}
  }
  return expanded;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TOOLS ENGINE (Zero External Dependencies)
// ─────────────────────────────────────────────────────────────────────────────
const DANGEROUS_CMD = /(rm\s+-rf\s+[\/~]|mkfs|:\(\)\s*\{|shutdown|reboot|format\s+[a-z]:|del\s+\/[fs]q?\s+[a-z]:\\)/i;

export const TOOLS = [
  {
    name: "read",
    description: "Read a UTF-8 text file with line numbers. Use offset and limit for large files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to the project root." },
        offset: { type: "integer", description: "1-based line to start reading from (default 1)." },
        limit: { type: "integer", description: "Max lines to return (default 250)." },
      },
      required: ["path"],
    },
  },
  {
    name: "write",
    description: "Create or overwrite a file. Always creates parent directories automatically.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to project root." },
        content: { type: "string", description: "Full UTF-8 content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit",
    description: "Surgically replace one exact occurrence of oldText with newText. Read file first so oldText matches byte-for-byte.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to project root." },
        oldText: { type: "string", description: "Exact unique block of code to replace." },
        newText: { type: "string", description: "New replacement block of code." },
      },
      required: ["path", "oldText", "newText"],
    },
  },
  {
    name: "list",
    description: "List project files and directories, respecting ignores and glob filter.",
    parameters: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Subdirectory to scan (default '.')." },
        pattern: { type: "string", description: "Optional glob like '*.js' or 'src/**/*.ts'." },
      },
    },
  },
  {
    name: "grep",
    description: "Search project files with a regular expression or keyword.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex or keyword to search for." },
        dir: { type: "string", description: "Directory to search (default '.')." },
        include: { type: "string", description: "Glob to filter files by (e.g. '*.json')." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "bash",
    description: "Run a shell command in the project root (PowerShell on Windows, sh on Unix).",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command line to run." },
        timeout: { type: "integer", description: "Max execution seconds (default 30)." },
      },
      required: ["command"],
    },
  },
  {
    name: "fetch",
    description: "Fetch web content from an HTTP/HTTPS URL and return stripped text.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Web URL to fetch." },
      },
      required: ["url"],
    },
  },
  {
    name: "todos",
    description: "Update the current plan's todo checklist.",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
    },
  },
];

export async function walkDirectory(root, subDir, ignores, out = [], depth = 0) {
  if (depth > 8 || out.length > 2000) return out;
  let entries = [];
  try {
    entries = await fs.readdir(path.join(root, subDir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const rel = path.join(subDir, ent.name).replace(/\\/g, "/");
    if (isIgnored(rel, ignores)) continue;
    if (ent.isDirectory()) {
      await walkDirectory(root, rel, ignores, out, depth + 1);
    } else {
      out.push(rel);
    }
  }
  return out;
}

export async function executeTool(name, args = {}, ctx) {
  const { root, ignores = [], session, work = {} } = ctx;
  try {
    switch (name) {
      case "read": {
        const full = safeJoin(root, args.path);
        if (!full) return { error: `Access denied: path escapes project root.` };
        const rel = path.relative(root, full).replace(/\\/g, "/");
        if (isIgnored(rel, ignores)) return { error: `Access denied by ignore rule for ${rel}.` };
        const stat = await fs.stat(full).catch(() => null);
        if (!stat) return { error: `File not found: ${args.path}` };
        if (stat.isDirectory()) return { error: `${args.path} is a directory; use list instead.` };
        if (stat.size > 500_000) return { error: `File is large (${stat.size} bytes); please specify offset/limit.` };

        const lines = (await fs.readFile(full, "utf8")).split("\n");
        const offset = Math.max(1, args.offset || 1);
        const limit = Math.max(1, args.limit || 250);
        const slice = lines.slice(offset - 1, offset - 1 + limit);
        const formatted = slice.map((l, idx) => `${padStart(String(offset + idx), 4)} │ ${l}`).join("\n");
        const remaining = lines.length - (offset - 1 + limit);
        return {
          path: rel,
          totalLines: lines.length,
          content: formatted + (remaining > 0 ? `\n... (${remaining} more lines)` : ""),
        };
      }
      case "write": {
        if (!args.path || typeof args.content !== "string") {
          return { error: "write requires 'path' and 'content'." };
        }
        const full = safeJoin(root, args.path);
        if (!full) return { error: "Access denied: path escapes project root." };
        work.path = full;
        work.previous = await fs.readFile(full).catch(() => null);
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, args.content, "utf8");
        return { ok: true, path: args.path, bytes: Buffer.byteLength(args.content) };
      }
      case "edit": {
        if (!args.path || typeof args.oldText !== "string" || typeof args.newText !== "string") {
          return { error: "edit requires 'path', 'oldText', and 'newText'." };
        }
        const full = safeJoin(root, args.path);
        if (!full) return { error: "Access denied: path escapes project root." };
        let raw;
        try {
          raw = await fs.readFile(full, "utf8");
        } catch (e) {
          return { error: `Cannot read ${args.path}: ${e.message}` };
        }
        const count = raw.split(args.oldText).length - 1;
        if (count === 0) return { error: "oldText was not found. Read the file again and match it verbatim." };
        if (count > 1) return { error: `oldText occurs ${count} times. Provide more surrounding context to be unique.` };
        work.path = full;
        work.previous = Buffer.from(raw, "utf8");
        const updated = raw.replace(args.oldText, args.newText);
        await fs.writeFile(full, updated, "utf8");
        return { ok: true, path: args.path };
      }
      case "list": {
        const targetDir = args.dir || ".";
        let files = await walkDirectory(root, targetDir, ignores, [], 0);
        if (args.pattern) {
          files = files.filter((f) => matchGlob(f, args.pattern) || matchGlob(path.basename(f), args.pattern));
        }
        return { dir: targetDir, totalCount: files.length, files: files.slice(0, 150) };
      }
      case "grep": {
        if (!args.pattern) return { error: "grep requires a 'pattern'." };
        const files = await walkDirectory(root, args.dir || ".", ignores, [], 0);
        const rx = new RegExp(args.pattern, "i");
        const hits = [];
        for (const f of files.slice(0, 200)) {
          if (hits.length >= 60) break;
          try {
            const full = path.join(root, f);
            const content = await fs.readFile(full, "utf8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length && hits.length < 60; i++) {
              if (rx.test(lines[i])) hits.push(`${f}:${i + 1}: ${lines[i].slice(0, 200)}`);
            }
          } catch {}
        }
        return { pattern: args.pattern, matches: hits.length, hits };
      }
      case "bash": {
        const cmd = args.command?.trim();
        if (!cmd) return { error: "Command cannot be empty." };
        if (DANGEROUS_CMD.test(cmd)) return { error: "Refused: command matches safety filter." };
        return new Promise((resolve) => {
          const win = process.platform === "win32";
          const shell = win ? "powershell.exe" : "/bin/sh";
          const shellArgs = win ? ["-NoProfile", "-Command", cmd] : ["-c", cmd];
          execFile(
            shell,
            shellArgs,
            { cwd: root, timeout: Math.min(args.timeout || 30, 90) * 1000, maxBuffer: 3 * 1024 * 1024 },
            (error, stdout, stderr) => {
              const out = (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).slice(0, 10000);
              resolve({ command: cmd, exitCode: error?.code ?? 0, output: out.trim() || "(no output)" });
            }
          );
        });
      }
      case "fetch": {
        if (!/^https?:\/\//i.test(args.url || "")) return { error: "URL must start with http:// or https://" };
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
          const res = await fetch(args.url, { signal: ctrl.signal, headers: { "User-Agent": "Lunar/2.3" } });
          const raw = await res.text();
          const clean = raw
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 10000);
          return { status: res.status, content: clean };
        } finally {
          clearTimeout(t);
        }
      }
      case "todos": {
        if (Array.isArray(args.todos)) {
          session.todos = args.todos;
          return { ok: true, count: session.todos.length };
        }
        return { todos: session.todos || [] };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: `${name} execution failed: ${e.message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SESSIONS, ORBITS & UNDO CHECKPOINTS
// ─────────────────────────────────────────────────────────────────────────────
export function newOrbitSession({ model, provider, mode = "vibe", name = "" } = {}) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(3).toString("hex");
  const id = `orbit-${ts}-${rand}`;
  return {
    id,
    name: name || `Orbit ${ts.slice(0, 10)}`,
    provider,
    model,
    mode,
    permissionMode: "ask",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    checkpoints: [],
    todos: [],
    tokens: { input: 0, output: 0 },
  };
}

export async function saveSession(session) {
  await ensureDirs();
  session.updatedAt = new Date().toISOString();
  const file = path.join(SESSIONS_DIR, `${session.id}.json`);
  await fs.writeFile(file, JSON.stringify(session, null, 2), "utf8");
  await fs.writeFile(LAST_FILE, session.id, "utf8").catch(() => {});
}

export async function loadSession(id) {
  try {
    const file = path.join(SESSIONS_DIR, `${id.replace(/\.json$/, "")}.json`);
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export async function getLastSessionId() {
  try {
    return (await fs.readFile(LAST_FILE, "utf8")).trim();
  } catch {
    return null;
  }
}

export async function listSessions() {
  await ensureDirs();
  const files = await fs.readdir(SESSIONS_DIR);
  const sessions = [];
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, f), "utf8"));
      sessions.push({
        id: data.id,
        name: data.name,
        model: data.model,
        turns: (data.messages || []).filter((m) => m.role === "user").length,
        updatedAt: data.updatedAt,
      });
    } catch {}
  }
  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function recordCheckpoint(session, root, fullPath, previousBuffer) {
  session.checkpoints ||= [];
  session.checkpoints.push({
    path: path.relative(root, fullPath),
    existed: previousBuffer !== null,
    previous: previousBuffer ? Buffer.from(previousBuffer).toString("base64") : "",
    timestamp: new Date().toISOString(),
  });
  if (session.checkpoints.length > 30) session.checkpoints.shift();
}

export async function rollbackLastCheckpoint(session, root) {
  if (!session.checkpoints?.length) return { ok: false, error: "No checkpoints available to undo." };
  const cp = session.checkpoints.pop();
  const full = path.join(root, cp.path);
  try {
    if (cp.existed) {
      await fs.writeFile(full, Buffer.from(cp.previous, "base64"));
    } else {
      await fs.unlink(full).catch(() => {});
    }
    await saveSession(session);
    return { ok: true, path: cp.path, existed: cp.existed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. LLM STREAMING CLIENT (OpenAI & Anthropic Protocols)
// ─────────────────────────────────────────────────────────────────────────────
async function* parseSSE(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (line.startsWith("data:")) {
        yield line.slice(5).trim();
      }
    }
  }
}

export function buildSystemPrompt(mode = "vibe", projectGuide = "") {
  const persona = MODES[mode]?.prompt || MODES.vibe.prompt;
  const rules = `
LUNAR OPERATIONAL DIRECTIVES:
1. Always inspect the codebase using tools before modifying code or guessing.
2. Follow the Loop: Read Context -> Make Precise Edit -> Verify Execution.
3. Keep changes minimal, clean, and idiomatic. Never inject comments that claim you changed something unless the tool executed it.
4. Protect secrets: never print tokens or API keys.
5. If the user asks for a feature or bugfix, perform the edits directly using 'edit' or 'write'.
6. When editing, match exact verbatim lines from 'read'.
`;
  return `${persona}\n${rules}\n${projectGuide ? `\nPROJECT GUIDE (LUNAR.md):\n${projectGuide}\n` : ""}`;
}

export async function chatStream({
  protocol = "openai",
  baseUrl,
  apiKey = "",
  model,
  messages,
  tools = TOOLS,
  signal,
  onDelta,
}) {
  const isOpenAI = protocol === "openai";
  const url = `${baseUrl.replace(/\/$/, "")}${isOpenAI ? "/chat/completions" : "/messages"}`;
  const headers = {
    "Content-Type": "application/json",
    ...(isOpenAI
      ? (apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
  };
  if (/openrouter\.ai/i.test(baseUrl)) {
    headers["HTTP-Referer"] = "https://github.com/lunar-cli";
    headers["X-Title"] = "Lunar";
  }

  let body;
  if (isOpenAI) {
    body = {
      model,
      stream: true,
      messages: messages.map((m) => {
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) },
            })),
          };
        }
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.toolCallId, content: String(m.content ?? "") };
        }
        return { role: m.role, content: m.content || "" };
      }),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto",
    };
  } else {
    // Anthropic format
    const sys = messages.find((m) => m.role === "system")?.content || "";
    const nonSys = messages.filter((m) => m.role !== "system");
    body = {
      model,
      max_tokens: 4096,
      stream: true,
      system: sys,
      messages: nonSys.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || "",
      })),
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    };
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      msg += `: ${parsed.error?.message || parsed.message || errText.slice(0, 160)}`;
    } catch {
      msg += `: ${errText.slice(0, 160)}`;
    }
    throw new Error(msg);
  }

  let fullText = "";
  const toolCallsAcc = new Map();

  for await (const data of parseSSE(res.body)) {
    if (!data || data === "[DONE]") continue;
    let json;
    try { json = JSON.parse(data); } catch { continue; }

    if (isOpenAI) {
      const choice = json.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) {
        fullText += delta.content;
        onDelta?.(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = toolCallsAcc.get(idx) || { id: tc.id || "", name: tc.function?.name || "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolCallsAcc.set(idx, cur);
        }
      }
    } else {
      // Anthropic SSE
      if (json.type === "content_block_delta" && json.delta?.text) {
        fullText += json.delta.text;
        onDelta?.(json.delta.text);
      }
    }
  }

  // Parse accumulated tool calls
  const toolCalls = [];
  for (const item of toolCallsAcc.values()) {
    if (item.name) {
      let argsObj = {};
      try { argsObj = JSON.parse(item.args || "{}"); } catch { argsObj = { _raw: item.args }; }
      toolCalls.push({
        id: item.id || `call_${crypto.randomBytes(4).toString("hex")}`,
        name: item.name,
        arguments: argsObj,
      });
    }
  }

  // Fallback XML parsing
  if (!toolCalls.length && fullText.includes("<lunar_tool>")) {
    const rx = /<lunar_tool>\s*([\s\S]*?)\s*<\/lunar_tool>/g;
    let match;
    while ((match = rx.exec(fullText))) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name) {
          toolCalls.push({
            id: `xml_${crypto.randomBytes(3).toString("hex")}`,
            name: parsed.name,
            arguments: parsed,
          });
        }
      } catch {}
    }
  }

  return { content: fullText, toolCalls };
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. POLISHED VISUAL ACTION CARDS & TURN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
export function renderToolVisualCard(name, args, result, work = {}) {
  if (result.error) {
    const rows = [
      ["Target", text(args.path || args.command || args.url || args.pattern || "")],
      ["Error", eclipse(result.error)],
    ];
    console.log("\n" + panel(`✕ ${name.toUpperCase()} FAILED`, rows));
    return;
  }

  switch (name) {
    case "write": {
      const bytes = result.bytes || Buffer.byteLength(args.content || "");
      const rows = [
        ["File", starlight(args.path)],
        ["Size", text(`${bytes.toLocaleString()} bytes written`)],
        ["Action", aurora("✓ Created & Saved")],
        ["Checkpoint", dim("Snapshotted for /undo")],
      ];
      console.log("\n" + panel(`✍️  WRITE FILE`, rows));
      break;
    }
    case "edit": {
      const diffStr = renderDiff(args.oldText, args.newText, 10);
      const rows = [
        ["File", starlight(args.path)],
        ["Status", aurora("✓ Surgical modification applied")],
        ["Checkpoint", dim("Snapshotted for /undo")],
        ["Diff Preview", "\n" + diffStr],
      ];
      console.log("\n" + panel(`⚡ SURGICAL EDIT`, rows));
      break;
    }
    case "bash": {
      const outPreview = String(result.output || "")
        .split("\n")
        .slice(0, 8)
        .map((l) => `  ${faint("│")} ${dim(truncate(l, 90))}`)
        .join("\n");
      const rows = [
        ["Command", starlight(`$ ${args.command}`)],
        ["Exit Code", result.exitCode === 0 ? aurora("0 (success)") : eclipse(`${result.exitCode} (error)`)],
        ...(outPreview ? [["Output", "\n" + outPreview]] : []),
      ];
      console.log("\n" + panel(`💻 EXECUTE COMMAND`, rows));
      break;
    }
    case "read": {
      const total = result.totalLines || 0;
      const offset = args.offset || 1;
      const limit = args.limit || 250;
      const endLine = Math.min(total, offset + limit - 1);
      const rows = [
        ["File", starlight(args.path)],
        ["Scope", text(`Read lines ${offset}-${endLine} (of ${total} total lines)`)],
        ["Status", aurora("✓ Ingested into neural orbit")],
      ];
      console.log("\n" + panel(`📖 READ FILE`, rows));
      break;
    }
    case "list": {
      const files = result.files || [];
      const filesPreview = files.slice(0, 6).map((f) => `  ${faint("·")} ${text(f)}`).join("\n");
      const rows = [
        ["Directory", starlight(args.dir || ".")],
        ["Filter", dim(args.pattern || "*")],
        ["Found", aurora(`${result.totalCount || files.length} project files discovered`)],
        ...(filesPreview ? [["Files", "\n" + filesPreview + (files.length > 6 ? `\n  ${faint(`… and ${files.length - 6} more`)}` : "")]] : []),
      ];
      console.log("\n" + panel(`📂 SCAN WORKSPACE`, rows));
      break;
    }
    case "grep": {
      const hits = result.hits || [];
      const hitPreview = hits.slice(0, 5).map((h) => `  ${faint("·")} ${starlight(truncate(h, 90))}`).join("\n");
      const rows = [
        ["Search Query", amber(`/${args.pattern}/i`)],
        ["Target Dir", dim(args.dir || ".")],
        ["Matches", aurora(`${result.matches || hits.length} occurrences found`)],
        ...(hitPreview ? [["Preview", "\n" + hitPreview]] : []),
      ];
      console.log("\n" + panel(`🔎 SEARCH CODEBASE`, rows));
      break;
    }
    case "fetch": {
      const chars = (result.content || "").length;
      const rows = [
        ["URL", starlight(args.url)],
        ["Status", aurora(`HTTP ${result.status || 200} OK`)],
        ["Extracted", text(`${chars.toLocaleString()} text characters parsed`)],
      ];
      console.log("\n" + panel(`🌐 WEB DISCOVERY`, rows));
      break;
    }
    case "todos": {
      const todos = result.todos || [];
      const completed = todos.filter((t) => t.status === "completed").length;
      const bar = renderProgressBar(completed, todos.length);
      const list = todos.map((t) => {
        const icon = t.status === "completed" ? aurora(SYMBOL.dot) : t.status === "in_progress" ? amber(SYMBOL.halfDot) : dim(SYMBOL.ring);
        return `  ${icon} ${t.status === "completed" ? dim(t.content) : text(t.content)}`;
      }).join("\n");
      const rows = [
        ["Progress", bar || aurora("Checklist active")],
        ...(list ? [["Tasks", "\n" + list]] : []),
      ];
      console.log("\n" + panel(`📋 ORBITAL FLIGHT PLAN`, rows));
      break;
    }
    default:
      console.log(`  ${aurora(SYMBOL.check)} ${starlight(name)} ${dim("completed")}`);
  }
}

export async function runAgentTurn({
  session,
  cfg,
  root = process.cwd(),
  streamOut = process.stdout,
  signal,
}) {
  const ignores = await loadIgnores(root);
  const guide = await loadProjectGuide(root);
  const apiKey = await resolveApiKey(cfg);
  const stream = createStream(streamOut);

  let currentRound = 0;
  const maxRounds = cfg.maxToolRounds || 16;
  const startTurnTime = Date.now();

  // Prepare system prompt
  const sysPrompt = buildSystemPrompt(session.mode, guide);
  if (!session.messages.length || session.messages[0].role !== "system") {
    session.messages.unshift({ role: "system", content: sysPrompt });
  } else {
    session.messages[0].content = sysPrompt;
  }

  while (currentRound++ < maxRounds) {
    if (signal?.aborted) throw new Error("Orbit turn aborted.");

    const spinner = createOrbitSpinner(currentRound === 1 ? "Thinking" : "Evaluating next step");
    let hasStreamed = false;

    let turn;
    try {
      turn = await chatStream({
        protocol: cfg.apiFormat || PRESETS[cfg.provider]?.protocol || "openai",
        baseUrl: cfg.baseUrl,
        apiKey,
        model: cfg.model,
        messages: session.messages,
        tools: TOOLS,
        signal,
        onDelta: (chunk) => {
          if (!hasStreamed) {
            spinner.stop();
            hasStreamed = true;
          }
          stream.push(chunk);
        },
      });
    } finally {
      spinner.stop();
    }

    stream.flush();

    session.messages.push({
      role: "assistant",
      content: turn.content,
      toolCalls: turn.toolCalls.length ? turn.toolCalls : undefined,
    });

    if (!turn.toolCalls.length) {
      break; // Turn complete
    }

    // Process tool calls
    for (const tc of turn.toolCalls) {
      const toolName = tc.name;
      const toolArgs = tc.arguments || {};
      const isWriteOrExec = ["write", "edit", "bash"].includes(toolName);

      let approved = true;
      if (cfg.permissionMode === "plan" && isWriteOrExec) {
        approved = false;
      } else if (cfg.permissionMode === "auto" && toolName === "bash") {
        approved = true;
      } else if (cfg.permissionMode === "ask" && isWriteOrExec && !cfg.autoApprove) {
        const choice = await confirmActionModal({
          toolName,
          target: toolArgs.path || toolArgs.command || "",
          diff: toolName === "edit" ? renderDiff(toolArgs.oldText, toolArgs.newText) : "",
          command: toolName === "bash" ? toolArgs.command : "",
        });

        if (choice === "y") {
          approved = true;
        } else if (choice === "a") {
          approved = true;
          cfg.autoApprove = true;
          session.permissionMode = "yolo";
          console.log(`  ${aurora(SYMBOL.check)} Switched to YOLO mode for remaining orbit.`);
        } else if (choice === "e") {
          session.messages.push({
            role: "tool",
            toolCallId: tc.id,
            name: toolName,
            content: JSON.stringify({ note: "User asked: Please explain why this change is necessary before applying." }),
          });
          continue;
        } else {
          approved = false;
        }
      }

      if (!approved) {
        console.log(`  ${eclipse(SYMBOL.cross)} ${dim(`Action ${toolName} declined`)}`);
        session.messages.push({
          role: "tool",
          toolCallId: tc.id,
          name: toolName,
          content: JSON.stringify({ error: `Permission denied: ${toolName} execution was declined by user.` }),
        });
        continue;
      }

      // Dynamic informative spinner label
      let spinMsg = `Executing ${toolName}`;
      if (toolName === "write") spinMsg = `Writing file: ${truncate(toolArgs.path, 35)}`;
      else if (toolName === "edit") spinMsg = `Surgically editing: ${truncate(toolArgs.path, 35)}`;
      else if (toolName === "bash") spinMsg = `Running command: $ ${truncate(toolArgs.command, 35)}`;
      else if (toolName === "read") spinMsg = `Reading file: ${truncate(toolArgs.path, 35)}`;
      else if (toolName === "list") spinMsg = `Scanning workspace: ${truncate(toolArgs.dir || ".", 25)}`;
      else if (toolName === "grep") spinMsg = `Searching codebase for "${truncate(toolArgs.pattern, 25)}"`;
      else if (toolName === "fetch") spinMsg = `Searching web: ${truncate(toolArgs.url, 35)}`;
      else if (toolName === "todos") spinMsg = `Updating orbital flight plan`;

      const toolSpinner = createOrbitSpinner(spinMsg);
      const work = {};
      let result;
      try {
        result = await executeTool(toolName, toolArgs, { root, ignores, session, work });
      } finally {
        toolSpinner.stop();
      }

      if (work.path && (toolName === "write" || toolName === "edit")) {
        recordCheckpoint(session, root, work.path, work.previous);
      }

      // Render polished visual action card
      renderToolVisualCard(toolName, toolArgs, result, work);

      session.messages.push({
        role: "tool",
        toolCallId: tc.id,
        name: toolName,
        content: JSON.stringify(result),
      });
    }
  }

  // Record metrics
  const duration = Date.now() - startTurnTime;
  const inEstimate = session.messages.reduce((acc, m) => acc + Math.round((m.content?.length || 0) / 4), 0);
  await recordStats({ model: cfg.model, inputTokens: inEstimate, outputTokens: 200, durationMs: duration });
  await saveSession(session);
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. INTERACTIVE SUBCOMMANDS: DOCTOR, SETUP, PROVIDERS, MODELS, STATS
// ─────────────────────────────────────────────────────────────────────────────
export async function cmdDoctor(cfg) {
  printMiniBanner();
  console.log(`  ${gradient("─── LUNAR ORBITAL CONNECTIVITY & HEALTH MATRIX ───")}\n`);

  const rows = [];
  rows.push(["Node Runtime", `${process.version} (${process.platform} ${process.arch})`]);
  rows.push(["Config File", fsSync.existsSync(CONFIG_FILE) ? ok(CONFIG_FILE) : warn("not created yet")]);
  rows.push(["Active Provider", starlight(cfg.provider)]);
  rows.push(["Active Model", text(cfg.model)]);
  rows.push(["Base URL", dim(cfg.baseUrl)]);

  // Check 9Router
  let nineStatus = dim("offline");
  try {
    const res = await fetch("http://127.0.0.1:20128/v1/models", { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      nineStatus = ok(`online (${data.data?.length || 0} models advertised)`);
    } else {
      nineStatus = warn(`online (HTTP ${res.status})`);
    }
  } catch {}
  rows.push(["9Router Gateway", nineStatus]);

  // Check Ollama
  let ollamaStatus = dim("offline");
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      const mods = (data.models || []).map((m) => m.name).join(", ");
      ollamaStatus = ok(`online [${mods || "no models loaded"}]`);
    }
  } catch {}
  rows.push(["Ollama Local", ollamaStatus]);

  // Check API Key
  const key = await resolveApiKey(cfg);
  rows.push(["API Key", key ? ok(maskKey(key)) : warn("(no key detected)")]);

  // Active Model Connectivity Ping
  let pingStatus = dim("probing...");
  try {
    const isOpenAI = (cfg.apiFormat || PRESETS[cfg.provider]?.protocol) !== "anthropic";
    const pingUrl = `${cfg.baseUrl.replace(/\/$/, "")}${isOpenAI ? "/chat/completions" : "/messages"}`;
    const pHeaders = {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    };
    const pingRes = await fetch(pingUrl, {
      method: "POST",
      headers: pHeaders,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 3,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (pingRes.ok) {
      pingStatus = ok("200 OK (ready to code!)");
    } else {
      pingStatus = err(`HTTP ${pingRes.status} (model refused test ping)`);
    }
  } catch (e) {
    pingStatus = err(`failed: ${e.message}`);
  }
  rows.push(["Model Test Ping", pingStatus]);

  const hasGuide = fsSync.existsSync(path.join(process.cwd(), "LUNAR.md"));
  rows.push(["Workspace Guide", hasGuide ? ok("LUNAR.md present") : dim("none (run 'lunar init')")]);

  console.log(panel("LUNAR HEALTH MATRIX", rows, {
    footer: pingStatus.includes("200 OK")
      ? "All systems nominal. Ready for orbit."
      : "Tip: Switch provider with 'lunar providers' or run 'lunar setup'.",
  }));
  console.log("");
}

export async function cmdSetup(cfg) {
  printMiniBanner();
  console.log(`  ${accent(bold("Interactive Lunar Setup Wizard"))}\n`);

  const providerList = Object.entries(PRESETS).map(([id, p]) => ({
    value: id,
    label: p.label,
    hint: p.hint || p.baseUrl,
    isCurrent: id === cfg.provider,
  }));

  const chosenProvider = await pickInteractive({
    question: "Select AI Provider",
    items: providerList,
    defaultIdx: Math.max(0, providerList.findIndex((p) => p.value === cfg.provider)),
  });

  if (!chosenProvider) return;

  cfg.provider = chosenProvider;
  cfg.baseUrl = PRESETS[chosenProvider]?.baseUrl || cfg.baseUrl;
  cfg.apiFormat = PRESETS[chosenProvider]?.protocol || "openai";

  // Query live models if available
  let modelsFound = [];
  try {
    const key = await resolveApiKey(cfg);
    const mRes = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (mRes.ok) {
      const d = await mRes.json();
      modelsFound = (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
    }
  } catch {}

  if (!modelsFound.length) {
    modelsFound = [PRESETS[chosenProvider]?.defaultModel || "default"];
  }

  const modelChoices = modelsFound.slice(0, 30).map((m) => ({
    value: m,
    label: m,
    hint: m.includes(":free") ? "[free tier]" : "",
    isCurrent: m === cfg.model,
  }));

  const chosenModel = await pickInteractive({
    question: `Select Model for ${chosenProvider}`,
    items: modelChoices,
    defaultIdx: Math.max(0, modelChoices.findIndex((m) => m.value === cfg.model)),
  });

  if (chosenModel) cfg.model = chosenModel;

  const modeChoices = Object.entries(MODES).map(([id, m]) => ({
    value: id,
    label: m.label,
    hint: m.blurb,
    isCurrent: id === cfg.mode,
  }));

  const chosenMode = await pickInteractive({
    question: "Select Default Coding Persona",
    items: modeChoices,
    defaultIdx: Math.max(0, modeChoices.findIndex((m) => m.value === cfg.mode)),
  });

  if (chosenMode) cfg.mode = chosenMode;

  await saveConfig(cfg);
  console.log(`\n  ${aurora(SYMBOL.check)} Configuration saved to ${starlight(CONFIG_FILE)}\n`);
}

export async function cmdProviders(cfg) {
  const list = Object.entries(PRESETS).map(([id, p]) => ({
    value: id,
    label: p.label,
    hint: p.baseUrl,
    isCurrent: id === cfg.provider,
  }));

  const chosen = await pickInteractive({
    question: "Switch Active AI Provider",
    items: list,
    defaultIdx: Math.max(0, list.findIndex((x) => x.value === cfg.provider)),
  });

  if (chosen) {
    cfg.provider = chosen;
    cfg.baseUrl = PRESETS[chosen].baseUrl;
    cfg.apiFormat = PRESETS[chosen].protocol;
    cfg.model = PRESETS[chosen].defaultModel;
    await saveConfig(cfg);
    console.log(`\n  ${aurora(SYMBOL.check)} Switched to ${starlight(chosen)} (model: ${text(cfg.model)})\n`);
  }
}

export async function cmdModels(cfg) {
  const spinner = createOrbitSpinner("Querying advertised models");
  let modelList = [];
  try {
    const key = await resolveApiKey(cfg);
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/models`;
    const res = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const d = await res.json();
      modelList = (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
    }
  } catch {} finally {
    spinner.stop();
  }

  if (!modelList.length) {
    modelList = [PRESETS[cfg.provider]?.defaultModel || cfg.model];
  }

  const items = modelList.slice(0, 50).map((m) => ({
    value: m,
    label: m,
    hint: m.includes(":free") ? "[free tier]" : "",
    isCurrent: m === cfg.model,
  }));

  const chosen = await pickInteractive({
    question: `Choose Model (${cfg.provider})`,
    items,
    defaultIdx: Math.max(0, items.findIndex((x) => x.value === cfg.model)),
  });

  if (chosen) {
    cfg.model = chosen;
    await saveConfig(cfg);
    console.log(`\n  ${aurora(SYMBOL.check)} Active model set to ${starlight(cfg.model)}\n`);
  }
}

export async function cmdSessions(cfg) {
  const sessions = await listSessions();
  if (!sessions.length) {
    console.log(dim("  No saved orbits found."));
    return;
  }
  const items = sessions.slice(0, 20).map((s) => ({
    value: s.id,
    label: s.name || s.id,
    hint: `${s.turns} turns · ${s.model || "default"} · ${s.updatedAt?.slice(0, 10)}`,
  }));

  const chosen = await pickInteractive({
    question: "Resume Orbit Session",
    items,
    defaultIdx: 0,
  });

  if (chosen) {
    const sess = await loadSession(chosen);
    if (sess) {
      console.log(`  ${aurora(SYMBOL.check)} Resuming ${starlight(sess.id)}...`);
      await startRepl(cfg, sess);
    }
  }
}

export async function cmdStats() {
  printMiniBanner();
  const stats = await readStats();
  console.log(panel("LUNAR LIFETIME ORBIT METRICS", [
    ["Total Turns", text(String(stats.totalTurns))],
    ["Input Tokens", text(fmtTokens(stats.inputTokens))],
    ["Output Tokens", text(fmtTokens(stats.outputTokens))],
    ["Total Tokens", starlight(fmtTokens(stats.inputTokens + stats.outputTokens))],
    ["Execution Time", dim(fmtDuration(stats.totalDurationMs))],
    ["Estimated Cost", amber(fmtCost(stats.estCostUsd))],
  ]));
  console.log("");
}

export async function cmdUndo(session, root) {
  const res = await rollbackLastCheckpoint(session, root);
  if (res.ok) {
    console.log(`  ${aurora(SYMBOL.check)} Rolled back checkpoint: ${starlight(res.path)}`);
  } else {
    console.log(`  ${eclipse(SYMBOL.cross)} Undo failed: ${res.error}`);
  }
}

export async function cmdInit(root = process.cwd()) {
  const guidePath = path.join(root, "LUNAR.md");
  if (fsSync.existsSync(guidePath)) {
    console.log(`  ${warn(SYMBOL.alert)} LUNAR.md already exists in current workspace.`);
    return;
  }
  const template = `# LUNAR.md — Project Guide for Lunar 🌙

## Overview
Describe the architecture, entrypoints, and core modules.

## Operational Rules
- Run tests after edits
- Prefer surgical, minimal code edits
`;
  await fs.writeFile(guidePath, template, "utf8");
  console.log(`  ${aurora(SYMBOL.check)} Created ${starlight("LUNAR.md")} guide template.`);
}

export function cmdHelp() {
  console.log(`
${accent(bold("LUNAR"))} 🌙 — Moonlit Terminal AI Coding Assistant   ${faint("v" + VERSION)}

${bold(starlight("CORE COMMANDS"))}
  lunar                      Start the interactive moonlit REPL
  lunar "<task>"             Run a single task, stream output, and exit
  lunar ask "<question>"     Ask a quick architectural or coding question
  lunar plan "<task>"        Explore codebase and produce an execution plan
  lunar implement "<task>"   Create plan and implement changes surgically
  lunar review [path]        Comprehensive code review with findings first
  lunar explain <file>       Explain file role, dependencies, and caveats
  lunar doctor               Run full diagnostics on connectivity and keys
  lunar setup                Interactive provider and model configuration
  lunar providers            Interactive provider switcher (arrow-key navigable)
  lunar models               Interactive model selector with live search filter
  lunar sessions             Interactive orbit session browser
  lunar stats                Show lifetime token consumption and costs
  lunar init                 Create LUNAR.md project guide

${bold(starlight("CLI FLAGS"))}
  -m, --model <id>           Override model for this invocation
  -p, --provider <id>        Override provider for this invocation
  --base-url <url>           Override API base endpoint
  --mode <persona>           Persona: vibe | architect | debug | teach | plan | review
  --permission-mode <mode>   ask | auto | plan | yolo
  -y, --yes                  Auto-approve file modifications
  -c, --continue             Continue the most recent orbit session
  -s, --session <id>         Resume a specific orbit session

${bold(starlight("INTERACTIVE REPL COMMANDS"))}
  /help, /?                  List available slash commands
  /mode                      Interactive persona switcher
  /permission                Interactive permission gate selector
  /provider, /model          Interactive provider or model selector
  /sessions                  Browse and resume saved orbits
  /undo                      Revert the most recent file change checkpoint
  /clear                     Clear screen and start a fresh turn
  /stats                     Display orbit token usage
  /doctor                    Check connection status
  /exit, /quit               Leave orbit

${bold(starlight("REPL SHORTCUTS"))}
  @<filepath>                Attach file contents into prompt
  !<command>                 Execute shell command immediately
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. INTERACTIVE REPL
// ─────────────────────────────────────────────────────────────────────────────
export async function startRepl(cfg, session, root = process.cwd()) {
  printBanner({ model: cfg.model, provider: cfg.provider, mode: session.mode });

  const slashCommands = [
    { cmd: "/help", desc: "Show command reference & keybindings" },
    { cmd: "/mode", desc: "Switch coding persona (vibe, architect, debug, teach, plan, review)" },
    { cmd: "/permission", desc: "Switch permission gate (ask, auto, plan, yolo)" },
    { cmd: "/provider", desc: "Interactive provider switcher" },
    { cmd: "/model", desc: "Interactive model picker" },
    { cmd: "/sessions", desc: "Browse and resume previous orbits" },
    { cmd: "/undo", desc: "Rollback last file modification checkpoint" },
    { cmd: "/stats", desc: "Show orbit token usage and estimated cost" },
    { cmd: "/doctor", desc: "Run orbital connectivity diagnostics" },
    { cmd: "/clear", desc: "Clear terminal screen" },
    { cmd: "/exit", desc: "Leave orbit" },
  ];

  const completer = (line) => {
    const list = slashCommands.map((c) => c.cmd);
    const hits = list.filter((c) => c.startsWith(line));
    return [hits.length ? hits : list, line];
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200,
    completer,
  });

  const questionAsync = (q) =>
    new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));

  try {
    while (true) {
      const moonInfo = getAstronomicalMoon();
      const promptGlyph = `${amber(moonInfo.icon)} ${accent("lunar")} ${dim(SYMBOL.prompt)} `;
      const rawInput = await questionAsync(promptGlyph);

      if (rawInput === null) break;
      const input = rawInput.trim();
      if (!input) continue;

      // Handle Slash Commands
      if (input.startsWith("/")) {
        const [cmd, ...args] = input.slice(1).split(/\s+/);
        const lowCmd = cmd.toLowerCase();

        if (["exit", "quit", "q"].includes(lowCmd)) {
          console.log(`\n  ${starlight("Orbit closed. Safe travels across the stars.")}\n`);
          break;
        } else if (["help", "?"].includes(lowCmd)) {
          cmdHelp();
        } else if (lowCmd === "clear") {
          console.clear();
          printBanner({ model: cfg.model, provider: cfg.provider, mode: session.mode });
        } else if (lowCmd === "doctor") {
          await cmdDoctor(cfg);
        } else if (lowCmd === "stats") {
          await cmdStats();
        } else if (lowCmd === "undo") {
          await cmdUndo(session, root);
        } else if (lowCmd === "provider" || lowCmd === "providers") {
          rl.pause();
          await cmdProviders(cfg);
          rl.resume();
        } else if (lowCmd === "model" || lowCmd === "models") {
          rl.pause();
          await cmdModels(cfg);
          rl.resume();
        } else if (lowCmd === "sessions") {
          rl.pause();
          await cmdSessions(cfg);
          rl.resume();
        } else if (lowCmd === "mode") {
          const target = args[0]?.toLowerCase();
          if (MODES[target]) {
            session.mode = target;
            console.log(`  ${aurora(SYMBOL.check)} Persona set to ${accent(target)}`);
          } else {
            rl.pause();
            const modeChoices = Object.entries(MODES).map(([id, m]) => ({
              value: id,
              label: m.label,
              hint: m.blurb,
              isCurrent: id === session.mode,
            }));
            const picked = await pickInteractive({
              question: "Switch Coding Persona",
              items: modeChoices,
              defaultIdx: Math.max(0, modeChoices.findIndex((m) => m.value === session.mode)),
            });
            rl.resume();
            if (picked) {
              session.mode = picked;
              console.log(`  ${aurora(SYMBOL.check)} Switched persona to ${accent(picked)}`);
            }
          }
        } else if (lowCmd === "permission") {
          rl.pause();
          const permChoices = [
            { value: "ask", label: "ask (default)", hint: "Prompt with diffs before file edits and bash" },
            { value: "auto", label: "auto", hint: "Auto-approve file edits, prompt for bash commands" },
            { value: "plan", label: "plan", hint: "Read-only mode; file edits and commands disabled" },
            { value: "yolo", label: "yolo", hint: "Execute all tools without asking confirmation" },
          ];
          const picked = await pickInteractive({
            question: "Set Permission Gate",
            items: permChoices,
            defaultIdx: Math.max(0, permChoices.findIndex((p) => p.value === cfg.permissionMode)),
          });
          rl.resume();
          if (picked) {
            cfg.permissionMode = picked;
            session.permissionMode = picked;
            console.log(`  ${aurora(SYMBOL.check)} Permission mode set to ${accent(picked)}`);
          }
        } else {
          console.log(`  ${eclipse(SYMBOL.cross)} Unknown command: /${cmd}. Type /help.`);
        }
        continue;
      }

      // Quick Shell Command Execution
      if (input.startsWith("!")) {
        const shellCmd = input.slice(1).trim();
        console.log(`  ${starlight("$")} ${dim(shellCmd)}`);
        const res = await executeTool("bash", { command: shellCmd }, { root, ignores: [], session });
        console.log(res.output || res.error || "(done)");
        continue;
      }

      // Expand @file macros
      const expanded = await expandPromptMacros(input, root, await loadIgnores(root));
      session.messages.push({ role: "user", content: expanded });

      const ctrl = new AbortController();
      const onSigInt = () => ctrl.abort();
      process.once("SIGINT", onSigInt);

      rl.pause();
      try {
        await runAgentTurn({
          session,
          cfg,
          root,
          signal: ctrl.signal,
        });
      } catch (e) {
        console.log(`\n  ${eclipse(SYMBOL.cross)} ${err(e.message)}`);
      } finally {
        process.removeListener("SIGINT", onSigInt);
        rl.resume();
      }
    }
  } finally {
    rl.close();
    await saveSession(session);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. CLI ARGUMENT PARSER & MAIN DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────
export function parseArgs(argv = []) {
  const flags = {
    model: null,
    provider: null,
    baseUrl: null,
    mode: null,
    permissionMode: null,
    yes: false,
    cont: false,
    session: null,
    verbose: false,
  };
  const pos = [];
  const queue = [...argv];
  while (queue.length) {
    const a = queue.shift();
    if (a === "-m" || a === "--model") flags.model = queue.shift();
    else if (a.startsWith("--model=")) flags.model = a.slice(8);
    else if (a === "-p" || a === "--provider") flags.provider = queue.shift();
    else if (a.startsWith("--provider=")) flags.provider = a.slice(11);
    else if (a === "--base-url") flags.baseUrl = queue.shift();
    else if (a.startsWith("--base-url=")) flags.baseUrl = a.slice(11);
    else if (a === "--mode") flags.mode = queue.shift();
    else if (a.startsWith("--mode=")) flags.mode = a.slice(7);
    else if (a === "--permission-mode") flags.permissionMode = queue.shift();
    else if (a.startsWith("--permission-mode=")) flags.permissionMode = a.slice(18);
    else if (["-y", "--yes", "--yolo"].includes(a)) flags.yes = true;
    else if (["-c", "--continue"].includes(a)) flags.cont = true;
    else if (["-s", "--session"].includes(a)) flags.session = queue.shift();
    else if (a.startsWith("--session=")) flags.session = a.slice(10);
    else if (["-v", "--verbose"].includes(a)) flags.verbose = true;
    else if (["-h", "--help"].includes(a)) pos.push("__help");
    else if (["-V", "--version"].includes(a)) pos.push("__version");
    else pos.push(a);
  }
  return { flags, pos };
}

export async function run(argv = process.argv.slice(2)) {
  const { flags, pos } = parseArgs(argv);
  const cfg = await loadConfig();

  if (flags.provider && PRESETS[flags.provider]) {
    cfg.provider = flags.provider;
    cfg.baseUrl = PRESETS[flags.provider].baseUrl;
    cfg.apiFormat = PRESETS[flags.provider].protocol;
    if (!flags.model) cfg.model = PRESETS[flags.provider].defaultModel;
  }
  if (flags.model) cfg.model = flags.model;
  if (flags.baseUrl) cfg.baseUrl = flags.baseUrl;
  if (flags.mode && MODES[flags.mode]) cfg.mode = flags.mode;
  if (flags.permissionMode) cfg.permissionMode = flags.permissionMode;
  if (flags.yes) cfg.autoApprove = true;

  const cmd = pos[0];
  const root = process.cwd();

  if (cmd === "__help" || cmd === "help") {
    cmdHelp();
    return;
  }
  if (cmd === "__version" || cmd === "version") {
    console.log(`lunar v${VERSION}`);
    return;
  }

  if (cmd === "doctor") return await cmdDoctor(cfg);
  if (cmd === "setup") return await cmdSetup(cfg);
  if (cmd === "providers") return await cmdProviders(cfg);
  if (cmd === "models") return await cmdModels(cfg);
  if (cmd === "sessions") return await cmdSessions(cfg);
  if (cmd === "stats") return await cmdStats();
  if (cmd === "init") return await cmdInit(root);

  let session = null;
  if (flags.cont) {
    const lastId = await getLastSessionId();
    if (lastId) session = await loadSession(lastId);
  } else if (flags.session) {
    session = await loadSession(flags.session);
  }
  if (!session) {
    session = newOrbitSession({ model: cfg.model, provider: cfg.provider, mode: cfg.mode });
  }

  // One-shot tasks
  if (["ask", "plan", "implement", "review", "explain"].includes(cmd) || (pos.length > 0 && !["chat", "start"].includes(cmd))) {
    let task = "";
    let modeOverride = cfg.mode;
    if (cmd === "ask") {
      modeOverride = "teach";
      task = pos.slice(1).join(" ");
    } else if (cmd === "plan") {
      modeOverride = "plan";
      cfg.permissionMode = "plan";
      task = `Create an ordered implementation plan for: ${pos.slice(1).join(" ")}. Inspect the repo with tools first. Do not edit files.`;
    } else if (cmd === "implement") {
      task = `Implement: ${pos.slice(1).join(" ")}. Inspect with tools, make minimal edits, then verify.`;
    } else if (cmd === "review") {
      modeOverride = "review";
      const target = pos.slice(1).join(" ") || "the project";
      task = `Review ${target}: findings first with severity and file:line references, then concrete fixes.`;
    } else if (cmd === "explain") {
      modeOverride = "teach";
      task = `Explain ${pos[1] || "this project"}: role, architecture, dependencies, and key caveats. Read relevant files first.`;
    } else {
      task = pos.join(" ");
    }

    if (!task.trim()) {
      console.log(dim("  Nothing to do — provide a task or run 'lunar' for interactive mode."));
      return;
    }

    printMiniBanner();
    session.mode = modeOverride;
    session.messages.push({ role: "user", content: task });
    const ctrl = new AbortController();
    process.once("SIGINT", () => ctrl.abort());
    await runAgentTurn({ session, cfg, root, signal: ctrl.signal });
    return;
  }

  // Interactive REPL
  await startRepl(cfg, session, root);
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. ENTRYPOINT EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1"))) {
  run().catch((e) => {
    process.stderr.write(`\n☾ lunar error: ${e?.message || e}\n`);
    process.exit(1);
  });
}
