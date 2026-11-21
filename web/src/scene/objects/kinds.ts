import {
  BoxGeometry,
  EdgesGeometry,
  IcosahedronGeometry,
  TorusKnotGeometry,
  type BufferGeometry,
} from 'three';
import type { ObjectKind } from '@/core/interaction/commands';
import { palette } from '@/ui/theme';

/** How one kind of holographic object looks. */
export interface KindDefinition {
  color: string;
  rim: string;
  /** Shell opacity; denser shapes look better a little more transparent. */
  opacity: number;
  /** Builds the body (pickable, holo shell) and optional edge lines. */
  build: () => { body: BufferGeometry; edges: BufferGeometry | null };
}

export const KINDS: Record<ObjectKind, KindDefinition> = {
  sphere: {
    color: palette.cyan,
    rim: palette.violet,
    opacity: 0.9,
    build: () => ({
      body: new IcosahedronGeometry(0.62, 4),
      edges: new EdgesGeometry(new IcosahedronGeometry(0.63, 1)),
    }),
  },
  cube: {
    color: palette.violet,
    rim: palette.cyan,
    opacity: 0.65,
    build: () => ({
      body: new BoxGeometry(0.95, 0.95, 0.95),
      edges: new EdgesGeometry(new BoxGeometry(0.96, 0.96, 0.96)),
    }),
  },
  sculpture: {
    color: palette.cyanDeep,
    rim: palette.cyan,
    opacity: 0.9,
    // Too dense for edge lines; the holo shell carries it alone.
    build: () => ({ body: new TorusKnotGeometry(0.42, 0.13, 200, 24), edges: null }),
  },
};

const cache = new Map<ObjectKind, { body: BufferGeometry; edges: BufferGeometry | null }>();

/**
 * Geometry for a kind, built once and shared by every object of that kind.
 * Kept for the page's lifetime (one small set per kind), so it's never
 * disposed by individual objects.
 */
export function kindGeometry(kind: ObjectKind) {
  let g = cache.get(kind);
  if (!g) {
    g = KINDS[kind].build();
    cache.set(kind, g);
  }
  return g;
}
