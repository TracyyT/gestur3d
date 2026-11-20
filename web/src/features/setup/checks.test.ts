import { describe, expect, it } from 'vitest';
import { buildChecks, thumbsUpCheck } from './checks';

const hand = (palm: number) => ({ handedness: 'Right' as const, score: 0.9, palm });

describe('buildChecks', () => {
  it('is pending while the model loads', () => {
    const checks = buildChecks('loading', { hands: [], detectionFps: 0, detectionMs: 0 }, null);
    expect(checks.map((c) => c.state)).toEqual(['pending', 'pending', 'pending']);
  });

  it('asks for the second hand when one is visible', () => {
    const [hands] = buildChecks(
      'ready',
      { hands: [hand(0.2)], detectionFps: 30, detectionMs: 8 },
      0.5,
    );
    expect(hands!.state).toBe('fail');
    expect(hands!.detail).toMatch(/other one/);
  });

  it('passes with two hands at a good distance in good light', () => {
    const checks = buildChecks(
      'ready',
      { hands: [hand(0.2), hand(0.18)], detectionFps: 30, detectionMs: 8 },
      0.45,
    );
    expect(checks.every((c) => c.state === 'pass')).toBe(true);
  });

  it('flags distance and lighting problems', () => {
    const [, distance, light] = buildChecks(
      'ready',
      { hands: [hand(0.05)], detectionFps: 30, detectionMs: 8 },
      0.05,
    );
    expect(distance!.detail).toMatch(/closer/);
    expect(light!.detail).toMatch(/dark/i);
  });
});

describe('thumbsUpCheck', () => {
  it('is locked until the other checks pass', () => {
    expect(thumbsUpCheck(false, 0.5).state).toBe('locked');
  });

  it('is active with progress once unlocked', () => {
    const c = thumbsUpCheck(true, 0.4);
    expect(c.state).toBe('active');
    expect(c.progress).toBe(0.4);
    expect(c.detail).toMatch(/keep holding/i);
  });
});
