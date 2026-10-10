const SYNODIC = 29.530588853;
const REF = Date.UTC(2000, 0, 6, 18, 14);

export const PHASES = [
  { key: 'new', name: 'New Moon', vibe: 'A blank canvas. Plant intentions, open a fresh branch.' },
  { key: 'waxing-crescent', name: 'Waxing Crescent', vibe: 'First light. Momentum is building, keep showing up.' },
  { key: 'first-quarter', name: 'First Quarter', vibe: 'Half lit, half decided. Commit and push through.' },
  { key: 'waxing-gibbous', name: 'Waxing Gibbous', vibe: 'Almost there. Refine, polish, tighten the edges.' },
  { key: 'full', name: 'Full Moon', vibe: 'Peak brightness. Ship the big thing tonight.' },
  { key: 'waning-gibbous', name: 'Waning Gibbous', vibe: 'Share what you built. Teach it, document it, release it.' },
  { key: 'last-quarter', name: 'Last Quarter', vibe: 'Let go of whatever no longer serves the codebase.' },
  { key: 'waning-crescent', name: 'Waning Crescent', vibe: 'Rest. Even the moon dims before it rises again.' },
];

const phaseAt = (pos) => PHASES[Math.floor(pos * 8 + 0.5) % 8];

export function getMoonPhase(date = new Date()) {
  const elapsed = (date.getTime() - REF) / 86400000;
  const position = ((elapsed / SYNODIC) % 1 + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * position)) / 2;
  const phase = phaseAt(position);
  return {
    date, position, illumination,
    ageDays: position * SYNODIC,
    phase, index: PHASES.indexOf(phase),
    daysUntilNextNew: ((1 - position) % 1) * SYNODIC,
    daysUntilNextFull: ((0.5 - position + 1) % 1) * SYNODIC,
  };
}

export const formatAge = (d) => `${d.toFixed(1)} days`;
export const formatIllumination = (f) => `${Math.round(f * 100)}%`;
