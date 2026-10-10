import chalk from 'chalk';

const LIT = [247, 243, 215];
const DARK = [35, 33, 72];
const NIGHT = [11, 16, 32];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function renderMoon(phase = 0.5, { radius = 6 } = {}) {
  const cols = radius * 2;
  const rows = radius;
  const cosA = Math.cos(2 * Math.PI * phase);
  const cx = radius;
  const cy = radius;
  const lines = [];

  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      let lit = 0, inside = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x = col + (sx + 0.5) / 2;
          const y = row * 2 + (sy + 0.5) / 2;
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius) {
            inside++;
            const hw = Math.sqrt(Math.max(0, 1 - (dy / radius) ** 2)) * radius;
            if (x > cx + hw * cosA) lit++;
          }
        }
      }
      if (inside === 0) { line += ' '; continue; }
      const surface = mix(DARK, LIT, lit / inside);
      const [r, g, b] = mix(NIGHT, surface, inside / 4);
      line += chalk.rgb(r, g, b)('█');
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

export function renderAllMoons(radius = 3) {
  return [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((p) => renderMoon(p, { radius }));
}
