import { describe, expect, it } from 'vitest';
import { OBJECT_KINDS } from '@/core/interaction/sceneModel';
import { KINDS, kindGeometry } from './kinds';

describe('object kinds', () => {
  it('defines every kind the scene model knows', () => {
    expect(Object.keys(KINDS).sort()).toEqual([...OBJECT_KINDS].sort());
  });

  it.each(OBJECT_KINDS)('%s builds a centered body of similar size', (kind) => {
    const { body } = kindGeometry(kind);
    body.computeBoundingSphere();
    const s = body.boundingSphere!;
    expect(s.radius).toBeGreaterThan(0.5);
    expect(s.radius).toBeLessThan(0.85);
    expect(s.center.length()).toBeLessThan(0.15);
    expect(body.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('shares geometry between objects of the same kind', () => {
    expect(kindGeometry('helix')).toBe(kindGeometry('helix'));
  });
});
