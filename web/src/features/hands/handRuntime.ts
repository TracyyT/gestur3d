import type { HandPointer } from '@/core/interaction/handInteraction';
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
    this.hovered.clear();
    this.frames.reset();
    this.latency.reset();
  },
};
