import { describe, expect, it } from 'vitest';
import {
  distanceStatus,
  handFullyInFrame,
  lightingStatus,
  meanLuminance,
  palmSize,
} from './calibration';
import { CameraError, classifyCameraError } from './camera';
import { toHandFrame } from './mediapipeHands';
import { RateMeter } from './rateMeter';

function handWith(points: Array<[number, number]>) {
  const image = new Float32Array(63).fill(0.5);
  points.forEach(([x, y], i) => {
    image[i * 3] = x;
    image[i * 3 + 1] = y;
  });
  return { image };
}

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['WeirdError', 'unknown'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyCameraError({ name, message: 'x' }).kind).toBe(kind);
  });

  it('passes CameraError through', () => {
    const e = new CameraError('insecure', 'x');
    expect(classifyCameraError(e)).toBe(e);
  });
});

describe('RateMeter', () => {
  it('measures rate and mean duration over the window', () => {
    const m = new RateMeter(1000);
    for (let i = 0; i <= 30; i++) m.tick(i * (1000 / 30), 8);
    expect(m.rate(1000)).toBeCloseTo(30, 0);
    expect(m.meanDuration()).toBe(8);
  });

  it('drops samples older than the window', () => {
    const m = new RateMeter(1000);
    m.tick(0, 100);
    m.tick(10, 100);
    m.tick(2000, 4);
    m.tick(2010, 6);
    expect(m.meanDuration()).toBe(5);
  });
});

describe('calibration', () => {
  it('palmSize scales x by aspect ratio', () => {
    // wrist (index 0) and middle MCP (index 9) 0.1 apart horizontally
    const pts: Array<[number, number]> = Array.from({ length: 21 }, () => [0.5, 0.5]);
    pts[0] = [0.4, 0.5];
    pts[9] = [0.5, 0.5];
    expect(palmSize(handWith(pts), 2)).toBeCloseTo(0.2);
  });

  it('classifies distance', () => {
    expect(distanceStatus(0.05)).toBe('too-far');
    expect(distanceStatus(0.2)).toBe('good');
    expect(distanceStatus(0.5)).toBe('too-close');
  });

  it('computes luminance and lighting status', () => {
    const black = new Uint8ClampedArray(4 * 100);
    const white = new Uint8ClampedArray(4 * 100).fill(255);
    expect(meanLuminance(black)).toBe(0);
    expect(meanLuminance(white)).toBeCloseTo(1);
    expect(lightingStatus(0.05)).toBe('dark');
    expect(lightingStatus(0.5)).toBe('good');
    expect(lightingStatus(0.95)).toBe('bright');
  });

  it('detects hands touching the frame edge', () => {
    const inside = handWith([]);
    const pts: Array<[number, number]> = [[0.995, 0.5]];
    expect(handFullyInFrame(inside)).toBe(true);
    expect(handFullyInFrame(handWith(pts))).toBe(false);
  });
});

describe('toHandFrame', () => {
  it('flattens landmarks and keeps handedness as reported', () => {
    const lm = Array.from({ length: 21 }, (_, i) => ({
      x: i / 100,
      y: 0.5,
      z: -0.01,
      visibility: 1,
    }));
    const frame = toHandFrame(
      {
        landmarks: [lm],
        worldLandmarks: [lm],
        handedness: [[{ categoryName: 'Left', score: 0.97, index: 0, displayName: '' }]],
        handednesses: [],
      },
      123,
      7.5,
    );
    expect(frame.timestamp).toBe(123);
    expect(frame.detectionMs).toBe(7.5);
    expect(frame.hands).toHaveLength(1);
    expect(frame.hands[0]!.handedness).toBe('Left');
    expect(frame.hands[0]!.image).toHaveLength(63);
    expect(frame.hands[0]!.image[3]).toBeCloseTo(0.01);
  });
});
