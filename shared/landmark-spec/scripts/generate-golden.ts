/**
 * Regenerates golden/v0.json from the reference implementation.
 * Run only when SPEC.md changes (as a new version), never to "fix" a failing test.
 */
import { writeFileSync } from 'node:fs';
import { goldenCases } from '../src/fixtures.ts';
import { normalizeHand, SPEC_VERSION } from '../src/normalize.ts';

const round = (v: number) => Math.round(v * 1e6) / 1e6;

const cases = goldenCases().map((c) => {
  // Round inputs first and compute expected from exactly what gets stored.
  const input = c.input.map(round);
  const out = normalizeHand(input, c.handedness, c.aspect, c.options);
  if (!out) throw new Error(`case ${c.name} is degenerate`);
  return { ...c, input, expected: Array.from(out, round) };
});

const file = new URL('../golden/v0.json', import.meta.url);
writeFileSync(file, JSON.stringify({ spec: SPEC_VERSION, tolerance: 1e-5, cases }, null, 2) + '\n');
console.log(`wrote ${cases.length} golden cases to golden/v0.json`);
