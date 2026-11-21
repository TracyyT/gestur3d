import type { HandPointer, TwoHandInfo } from '@/core/interaction/handInteraction';
import { RateMeter } from '@/core/vision/rateMeter';

/**
 * Per-frame hand interaction state shared between the render loop, 3D objects
 * and the cursor overlay. Plain mutable data (not React state): it changes
 * every frame and is read inside render loops.
 */
export const handRuntime = {
  pointers: [] as HandPointer[],
  /** objectId → pointer id holding it. */
  held: new Map<string, number>(),
  /** Timestamp of the last detection frame the interaction engine processed. */
  lastFrameTs: 0,
  /** Active two-hand grabs. */
  twoHand: [] as TwoHandInfo[],
  /**
   * Recent two-hand modes, one entry per change ('two', 'one', 'frozen',
   * 'none'), capped. Brief states (a hand lost for 200 ms) stay visible here
   * even when rendering is too slow to sample them.
   */
  twoHandModes: [] as string[],
  /** Objects currently hovered by a hand. */
  hovered: new Set<string>(),
  /** Object the mouse is dragging, so hands can't grab it. */
  mouseDragId: null as string | null,
  /** Detection frames consumed by the render loop. */
  frames: new RateMeter(1000),
  /** Camera capture → consumed by the render loop, ms. */
  latency: new RateMeter(2000),
  /** Project a world position to canvas pixels (set by the scene). */
  project: null as ((p: [number, number, number]) => { x: number; y: number }) | null,

  reset() {
    this.pointers = [];
    this.held.clear();
    this.twoHand = [];
    this.twoHandModes = [];
    this.hovered.clear();
    this.frames.reset();
    this.latency.reset();
  },
};
