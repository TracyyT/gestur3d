import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  Curve,
  EdgesGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HoloColor, ObjectKind } from '@/core/interaction/commands';
import { palette } from '@/ui/theme';

/** How one kind of holographic object looks. */
export interface KindDefinition {
  color: string;
  rim: string;
  /** Shell opacity; denser shapes look better a little more transparent. */
  opacity: number;
  /** Builds the body (pickable, holo shell) and optional edge lines. */
  build: () => { body: BufferGeometry; edges: BufferGeometry | null };
  /** Idle spin about the object's own up axis, radians per second (paused while held). */
  spin?: number;
}

/** A spiral around the Y axis, for the helix strands. */
class HelixCurve extends Curve<Vector3> {
  private readonly radius: number;
  private readonly height: number;
  private readonly turns: number;
  private readonly phase: number;

  constructor(radius: number, height: number, turns: number, phase: number) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
    this.phase = phase;
  }

  override getPoint(t: number, target = new Vector3()) {
    const a = this.phase + t * this.turns * Math.PI * 2;
    return target.set(
      Math.cos(a) * this.radius,
      (t - 0.5) * this.height,
      Math.sin(a) * this.radius,
    );
  }
}

/** Two strands half a turn apart, like DNA. */
function helixGeometry() {
  const strand = (phase: number) =>
    new TubeGeometry(new HelixCurve(0.3, 1.1, 1.75, phase), 160, 0.055, 10, false);
  return mergeGeometries([strand(0), strand(Math.PI)])!;
}

/** Three nested rings on different axes. */
function gyroscopeGeometry() {
  const outer = new TorusGeometry(0.56, 0.035, 12, 96);
  const middle = new TorusGeometry(0.45, 0.035, 12, 96).rotateY(Math.PI / 2);
  const inner = new TorusGeometry(0.34, 0.035, 12, 96).rotateX(Math.PI / 2);
  return mergeGeometries([outer, middle, inner])!;
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
  ring: {
    color: palette.cyan,
    rim: palette.violet,
    opacity: 0.85,
    spin: 0.35,
    build: () => ({ body: new TorusGeometry(0.5, 0.09, 24, 128), edges: null }),
  },
  pyramid: {
    color: palette.violet,
    rim: palette.cyan,
    opacity: 0.7,
    build: () => {
      // Square-based pyramid, centered on its middle so it turns in place.
      const shape = () =>
        new ConeGeometry(0.62, 1.0, 4, 1).rotateY(Math.PI / 4).translate(0, 0.05, 0);
      return { body: shape(), edges: new EdgesGeometry(shape()) };
    },
  },
  crystal: {
    color: palette.cyan,
    rim: palette.violetDeep,
    opacity: 0.75,
    spin: 0.25,
    build: () => {
      const shape = () => new OctahedronGeometry(0.55).scale(1, 1.4, 1);
      return { body: shape(), edges: new EdgesGeometry(shape()) };
    },
  },
  capsule: {
    color: palette.violet,
    rim: palette.cyan,
    opacity: 0.85,
    build: () => ({ body: new CapsuleGeometry(0.3, 0.55, 12, 32), edges: null }),
  },
  helix: {
    color: palette.cyanDeep,
    rim: palette.violet,
    opacity: 0.9,
    spin: 0.3,
    build: () => ({ body: helixGeometry(), edges: null }),
  },
  gyroscope: {
    color: palette.violet,
    rim: palette.cyan,
    opacity: 0.9,
    spin: 0.45,
    build: () => ({ body: gyroscopeGeometry(), edges: null }),
  },
};

/** Body and rim colors for each color choice. */
export const COLOR_STYLE: Record<HoloColor, { color: string; rim: string }> = {
  cyan: { color: palette.cyan, rim: palette.violet },
  violet: { color: palette.violet, rim: palette.cyan },
  white: { color: palette.ink1, rim: palette.cyan },
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
