import { describe, expect, it } from 'vitest';
import { TASKS } from '@/core/practice/tasks';
import { demoFor } from './demos';

describe('task demos', () => {
  it('every task has a demo, with two hands for the two-hand gestures', () => {
    for (const t of TASKS) {
      const r = demoFor(t.id);
      expect(r.frames.length).toBeGreaterThan(10);
      const hands = Math.max(...r.frames.map((f) => f.hands.length));
      expect(hands).toBe(['resize', 'rotate', 'depth'].includes(t.id) ? 2 : 1);
    }
  });

  it('two-hand demos have one right and one left hand', () => {
    const f = demoFor('resize').frames[0]!;
    expect(f.hands.map((h) => h.handedness).sort()).toEqual(['Left', 'Right']);
  });
});
