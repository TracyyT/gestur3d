import { describe, expect, it } from 'vitest';
import { DrawController } from '@/core/drawing/drawController';
import { StrokeBuilder } from '@/core/drawing/strokeBuilder';
import type { PinchState } from '@/core/tracking/pinch';
import type { Vec3 } from './commands';
import { HandInteractionEngine, type PointerInput, type SceneQuery } from './handInteraction';
import { applyCommand, createInitialScene } from './sceneModel';

/**
 * Per-detection cost of the interaction layer, on the CPU running the tests.
 * Budgets are loose (a 30 Hz detection leaves 33 ms; rendering needs most of
 * it), so these catch regressions of 10× or more, not small drifts. Numbers
 * are printed so docs/benchmarks.md can quote them.
 */

const FRAMES = 3000;

function scene(objects: Record<string, Vec3>): SceneQuery {
  const pos = new Map(Object.entries(objects));
  return {
    pick: ({ x, y }) => {
      for (const [id, p] of pos)
        if (Math.abs(x / 100 - p[0]) <= 0.5 && Math.abs(y / 100 - p[1]) <= 0.5) return id;
      return null;
    },
    planePoint: ({ x, y }) => [x / 100, y / 100, 0],
    objectPosition: (id) => pos.get(id) ?? null,
  };
}

const pinch = (p: Partial<PinchState>): PinchState => ({
  strength: 1,
  ratio: 0.3,
  active: true,
  started: false,
  ended: false,
  ...p,
});

const hand = (id: number, x: number, y: number, p: PinchState): PointerInput => ({
  id,
  handedness: id === 1 ? 'Right' : 'Left',
  status: 'tracking',
  screen: { x, y },
  tip: { x, y },
  inBox: true,
  pinch: p,
});

/** Mean and 99th percentile of `fn` over FRAMES calls, µs. */
function time(fn: (i: number) => void) {
  for (let i = 0; i < 200; i++) fn(i); // warm up
  const d: number[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const t0 = performance.now();
    fn(i);
    d.push(performance.now() - t0);
  }
  d.sort((a, b) => a - b);
  const mean = (d.reduce((a, b) => a + b, 0) / d.length) * 1000;
  const p99 = d[Math.floor(d.length * 0.99)]! * 1000;
  return { mean, p99 };
}

const fmt = ({ mean, p99 }: { mean: number; p99: number }) =>
  `${mean.toFixed(1)} µs mean, ${p99.toFixed(1)} µs p99`;

describe('interaction cost per detection', () => {
  it('one hand dragging an object', () => {
    const e = new HandInteractionEngine();
    const q = scene({ a: [2, 2, 0], b: [5, 2, 0], c: [8, 2, 0] });
    e.update(
      0,
      [hand(1, 200, 200, pinch({ active: false, strength: 0, ratio: 1 }))],
      q,
      () => false,
    );
    e.update(33, [hand(1, 200, 200, pinch({ started: true }))], q, () => false);
    let last: ReturnType<HandInteractionEngine['update']> | null = null;
    const r = time((i) => {
      const x = 200 + 100 * Math.sin(i / 30);
      last = e.update(33 * (i + 2), [hand(1, x, 200, pinch({}))], q, () => false);
    });
    console.info(`[measure] one-hand drag: ${fmt(r)}`);
    expect(last!.pointers[0]!.grabbedId).toBe('a');
    expect(r.mean).toBeLessThan(500);
  });

  it('two hands scaling and turning an object', () => {
    const e = new HandInteractionEngine();
    const q = scene({ a: [4, 4, 0] });
    const open = pinch({ active: false, strength: 0, ratio: 1 });
    const seq: PointerInput[][] = [
      [hand(1, 400, 400, open), hand(2, 250, 400, open)],
      [hand(1, 400, 400, pinch({ started: true })), hand(2, 250, 400, open)],
      [hand(1, 400, 400, pinch({})), hand(2, 250, 400, open)],
      [hand(1, 400, 400, pinch({})), hand(2, 250, 400, pinch({ started: true }))],
    ];
    seq.forEach((inputs, i) => e.update(33 * i, inputs, q, () => false));
    let last: ReturnType<HandInteractionEngine['update']> | null = null;
    const r = time((i) => {
      const s = 150 + 60 * Math.sin(i / 40);
      const a = 0.4 * Math.sin(i / 55);
      last = e.update(
        33 * (i + 4),
        [
          hand(1, 400 + s * Math.cos(a), 400 + s * Math.sin(a), pinch({})),
          hand(2, 400 - s * Math.cos(a), 400 - s * Math.sin(a), pinch({})),
        ],
        q,
        () => false,
      );
    });
    console.info(`[measure] two-hand scale+turn: ${fmt(r)}`);
    expect(last!.twoHand[0]?.mode).toBe('two');
    expect(r.mean).toBeLessThan(500);
  });

  it('drawing a stroke (per detection, then finishing a 2000-point stroke)', () => {
    const d = new DrawController();
    const project = ({ x, y }: { x: number; y: number }): Vec3 => [x / 100, y / 100, 0];
    d.update(
      0,
      true,
      [
        {
          id: 1,
          lost: false,
          screen: { x: 0, y: 0 },
          pinch: { started: true, active: true, ended: false },
          grabbing: false,
        },
      ],
      project,
    );
    const r = time((i) => {
      d.update(
        33 * (i + 1),
        true,
        [
          {
            id: 1,
            lost: false,
            screen: { x: (i % 600) * 4, y: 300 + 80 * Math.sin(i / 9) },
            pinch: { started: false, active: true, ended: false },
            grabbing: false,
          },
        ],
        project,
      );
    });
    console.info(`[measure] drawing, per detection: ${fmt(r)}`);
    expect(r.mean).toBeLessThan(500);

    const long = () => {
      const b = new StrokeBuilder(0);
      for (let i = 0; i < 2000; i++)
        b.add({ screen: { x: i * 4, y: 0 }, world: [i / 100, Math.sin(i / 20), 0] });
      return b;
    };
    for (let i = 0; i < 3; i++) long().finish(5000); // warm up
    const b = long();
    const t0 = performance.now();
    const pts = b.finish(5000)!;
    const ms = performance.now() - t0;
    console.info(`[measure] finish 2000-point stroke: ${ms.toFixed(2)} ms → ${pts.length} points`);
    expect(ms).toBeLessThan(16);

    const t1 = performance.now();
    applyCommand(createInitialScene(), { type: 'addStroke', points: pts });
    const add = performance.now() - t1;
    console.info(`[measure] addStroke reducer: ${add.toFixed(2)} ms`);
    expect(add).toBeLessThan(20);
  });
});
