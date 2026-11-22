import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/core/interaction/commands';
import { DrawController, type PenInput } from './drawController';

const project = ({ x, y }: { x: number; y: number }): Vec3 => [x / 100, -y / 100, 0];

function pen(
  x: number,
  y: number,
  pinch: Partial<PenInput['pinch']>,
  extra: Partial<PenInput> = {},
) {
  return {
    id: 1,
    lost: false,
    screen: { x, y },
    pinch: { started: false, active: true, ended: false, ...pinch },
    grabbing: false,
    ...extra,
  };
}

/** A pinch at (x0, y) dragged right in 20 steps of 33 ms, then released. */
function stroke(c: DrawController, active = true, extra: Partial<PenInput> = {}) {
  const out: Vec3[][] = [];
  let t = 0;
  out.push(...c.update(t, active, [pen(100, 200, { started: true }, extra)], project).finished);
  for (let i = 1; i <= 20; i++) {
    t += 33;
    out.push(...c.update(t, active, [pen(100 + i * 10, 200, {}, extra)], project).finished);
  }
  t += 33;
  out.push(
    ...c.update(t, active, [pen(300, 200, { active: false, ended: true }, extra)], project)
      .finished,
  );
  return out;
}

describe('DrawController', () => {
  it('a pinch dragged through empty space makes one stroke', () => {
    const c = new DrawController();
    const done = stroke(c);
    expect(done).toHaveLength(1);
    const pts = done[0]!;
    expect(pts[0]![0]).toBeCloseTo(1, 5);
    expect(pts.at(-1)![0]).toBeCloseTo(3, 5);
    expect(c.live.size).toBe(0);
  });

  it('does nothing while the tool is off', () => {
    const c = new DrawController();
    expect(stroke(c, false)).toHaveLength(0);
    expect(c.live.size).toBe(0);
  });

  it('a pinch that grabs an object is not a stroke', () => {
    const c = new DrawController();
    expect(stroke(c, true, { grabbing: true })).toHaveLength(0);
  });

  it('a quick tap is not a stroke', () => {
    const c = new DrawController();
    c.update(0, true, [pen(100, 200, { started: true })], project);
    const r = c.update(40, true, [pen(101, 200, { active: false, ended: true })], project);
    expect(r.finished).toHaveLength(0);
    expect(c.live.size).toBe(0);
  });

  it('a lost hand ends its stroke where it was', () => {
    const c = new DrawController();
    c.update(0, true, [pen(100, 200, { started: true })], project);
    for (let i = 1; i <= 10; i++) c.update(i * 33, true, [pen(100 + i * 10, 200, {})], project);
    const r = c.update(400, true, [], project);
    expect(r.finished).toHaveLength(1);
    expect(r.finished[0]!.at(-1)![0]).toBeCloseTo(2, 5);
  });

  it('a briefly lost hand pauses the stroke, and it carries on when the hand returns', () => {
    const c = new DrawController();
    c.update(0, true, [pen(100, 200, { started: true })], project);
    for (let i = 1; i <= 5; i++) c.update(i * 33, true, [pen(100 + i * 10, 200, {})], project);
    c.update(200, true, [pen(150, 200, {}, { lost: true })], project);
    expect(c.live.size).toBe(1);
    for (let i = 6; i <= 10; i++)
      c.update(i * 33 + 100, true, [pen(100 + i * 10, 200, {})], project);
    const r = c.update(500, true, [pen(200, 200, { active: false, ended: true })], project);
    expect(r.finished).toHaveLength(1);
    expect(r.finished[0]!.at(-1)![0]).toBeCloseTo(2, 5);
  });

  it('turning the tool off mid-stroke keeps what was drawn', () => {
    const c = new DrawController();
    c.update(0, true, [pen(100, 200, { started: true })], project);
    for (let i = 1; i <= 10; i++) c.update(i * 33, true, [pen(100 + i * 10, 200, {})], project);
    expect(c.update(400, false, [pen(200, 200, {})], project).finished).toHaveLength(1);
  });

  it('two hands draw two strokes at once', () => {
    const c = new DrawController();
    const both = (x: number, p: Partial<PenInput['pinch']>) => [
      pen(x, 100, p),
      pen(x, 300, p, { id: 2 }),
    ];
    c.update(0, true, both(100, { started: true }), project);
    for (let i = 1; i <= 10; i++) c.update(i * 33, true, both(100 + i * 10, {}), project);
    const r = c.update(400, true, both(200, { active: false, ended: true }), project);
    expect(r.finished).toHaveLength(2);
  });

  it('a pinch already closed when the tool turns on does not start drawing', () => {
    const c = new DrawController();
    for (let i = 0; i < 10; i++) c.update(i * 33, true, [pen(100 + i * 10, 200, {})], project);
    expect(c.live.size).toBe(0);
  });
});
