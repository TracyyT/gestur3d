import { describe, expect, it } from 'vitest';
import { resultToFrame } from './workerHandSource';

describe('resultToFrame', () => {
  it('splits flat worker buffers into per-hand landmarks', () => {
    const image = new Float32Array(126).map((_, i) => i / 1000);
    const world = new Float32Array(126).map((_, i) => -i / 1000);
    const frame = resultToFrame({
      type: 'result',
      timestamp: 100,
      captureTime: 90,
      detectionMs: 6.5,
      handedness: [
        { label: 'Left', score: 0.9 },
        { label: 'Right', score: 0.8 },
      ],
      image,
      world,
    });
    expect(frame.timestamp).toBe(100);
    expect(frame.captureTime).toBe(90);
    expect(frame.hands.map((h) => h.handedness)).toEqual(['Left', 'Right']);
    expect(frame.hands[1]!.image[0]).toBeCloseTo(0.063);
    expect(frame.hands[1]!.world).toHaveLength(63);
  });
});
