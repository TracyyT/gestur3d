import type { Vec3 } from '@/core/interaction/commands';
import type { ScreenPos } from '@/core/interaction/handInteraction';
import { StrokeBuilder } from './strokeBuilder';

/** One hand, after the interaction engine has seen it this detection. */
export interface PenInput {
  id: number;
  lost: boolean;
  screen: ScreenPos;
  pinch: { started: boolean; active: boolean; ended: boolean };
  /** The engine grabbed something with this hand. */
  grabbing: boolean;
}

export interface DrawUpdate {
  /** Strokes finished this update (already smoothed), ready to add. */
  finished: Vec3[][];
  /** True if a live stroke changed (for redrawing the trail). */
  changed: boolean;
}

/**
 * Turns pinches in empty space into strokes while the Draw tool is on.
 * A pinch that grabs an object stays a grab, so drawings can still be moved
 * with the tool on. A briefly lost hand pauses its stroke; once the tracker
 * drops it, the stroke ends where it was.
 */
export class DrawController {
  readonly live = new Map<number, StrokeBuilder>();

  update(
    t: number,
    active: boolean,
    pens: PenInput[],
    project: (screen: ScreenPos) => Vec3 | null,
  ): DrawUpdate {
    const finished: Vec3[][] = [];
    let changed = false;
    const end = (id: number) => {
      const s = this.live.get(id)!;
      this.live.delete(id);
      changed = true;
      const pts = s.finish(t);
      if (pts) finished.push(pts);
    };

    for (const id of [...this.live.keys()]) {
      const pen = pens.find((p) => p.id === id);
      if (
        !pen ||
        (!pen.lost && (!active || pen.grabbing || pen.pinch.ended || !pen.pinch.active))
      ) {
        end(id);
      }
    }
    if (!active) {
      for (const id of [...this.live.keys()]) end(id);
      return { finished, changed };
    }

    for (const pen of pens) {
      if (pen.lost || pen.grabbing) continue;
      let s = this.live.get(pen.id);
      if (!s && pen.pinch.started && pen.pinch.active) {
        s = new StrokeBuilder(t);
        this.live.set(pen.id, s);
        changed = true;
      }
      if (!s) continue;
      const world = project(pen.screen);
      if (world && s.add({ screen: pen.screen, world })) changed = true;
    }
    return { finished, changed };
  }

  reset() {
    this.live.clear();
  }
}
