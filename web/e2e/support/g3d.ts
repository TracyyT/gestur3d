/** Types for the test-only `window.__G3D__` API (src/features/hands/testHooks.ts). */
export type UV = { u: number; v: number };
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Handedness = 'Left' | 'Right';

export interface HandKey extends UV {
  at: number;
  pinch: number;
  visible?: boolean;
  size?: number;
  point?: boolean;
}

export interface G3D {
  objects(): Array<{ id: string; kind: string; position: Vec3; rotation: Quat; scale: number }>;
  selectedId(): string | null;
  pointers(): Array<{
    id: number;
    phase: string;
    grabbedId: string | null;
    tip?: { x: number; y: number };
  }>;
  twoHand(): Array<{
    mode: string;
    pointerIds: [number, number];
    spread: number;
    turn: number;
  }>;
  objectUV(id: string): UV | null;
  twoHandModes(): string[];
  scriptTime(): number | null;
  sceneRect(): { left: number; top: number; width: number; height: number };
  playGrab(s: {
    from: UV;
    to: UV;
    handedness?: Handedness;
    dropoutMs?: number;
    grip?: number;
    loosenTo?: number;
  }): Promise<void>;
  playSweep(from: UV, to: UV, handedness?: Handedness): Promise<void>;
  playHold(uv: UV, ms: number, jitter?: number): Promise<void>;
  playTwoHand(s: { right: HandKey[]; left: HandKey[] }): Promise<void>;
  playHand(keys: HandKey[], handedness?: Handedness): Promise<void>;
  addStroke(points: Vec3[]): void;
  session(): Array<Record<string, unknown> & { t: number; type: string }>;
}

declare global {
  interface Window {
    __G3D__: G3D;
    __G3D_TEST_HOOKS__?: boolean;
  }
}
