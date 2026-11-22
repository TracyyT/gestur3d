import { HoldTracker } from '@/core/gestures/holdTracker';
import { PoseHoldDetector } from '@/core/gestures/poseHoldDetector';
import { isFist, isPointing } from '@/core/gestures/rules/handPoses';
import type { EngineResult } from '@/core/interaction/handInteraction';
import { MENU_GEOMETRY } from '@/core/interaction/radialMenu';
import type { TrackSnapshot } from '@/core/tracking/handTracker';
import { handRuntime } from '@/features/hands/handRuntime';
import { useMenu } from './menuStore';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Opens and drives the radial menu with a hand, one detection frame at a time:
 * - pointing (index finger up, other fingers curled) held still opens it at
 *   that hand's cursor (kept inside the visible scene);
 * - that hand's cursor then points, and a new pinch chooses;
 * - closing the hand (a fist) or losing it closes the menu.
 * Hands holding something, or a two-hand grab, never open it.
 */
export class GestureMenuController {
  private detectors = new Map<number, PoseHoldDetector>();
  private fist = new HoldTracker(150, 60);
  /** Track that opened the menu, while it's open. */
  menuHand: number | null = null;

  update(now: number, tracks: TrackSnapshot[], result: EngineResult, rect: Rect, enabled: boolean) {
    const menu = useMenu.getState();
    // The menu was closed some other way (keyboard, mouse, a choice).
    if (!menu.open || menu.openedBy !== 'hand') this.menuHand = null;

    const live = new Set(tracks.map((t) => t.id));
    for (const id of this.detectors.keys()) if (!live.has(id)) this.detectors.delete(id);
    handRuntime.menuProgress.clear();

    if (this.menuHand !== null) {
      this.drive(now, tracks, result, menu);
      return;
    }
    if (!enabled || menu.open) return;

    for (const t of tracks) {
      if (t.status !== 'tracking' || !t.world) continue;
      let d = this.detectors.get(t.id);
      if (!d) this.detectors.set(t.id, (d = new PoseHoldDetector(isPointing)));
      const p = result.pointers.find((x) => x.id === t.id);
      // Never while any hand holds something.
      const allowed = !!p && result.held.size === 0 && !t.pinch.active;
      const r = d.update(now, { world: t.world, center: t.anchor, allowed });
      if (r.progress > 0) handRuntime.menuProgress.set(t.id, r.progress);
      if (r.completed && p) {
        const m = MENU_GEOMETRY.outerOuter + 6;
        const clamp = (v: number, lo: number, hi: number) =>
          lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
        menu.openAt(
          clamp(p.screen.x, rect.left + m, rect.left + rect.width - m),
          clamp(p.screen.y, rect.top + m, rect.top + rect.height - m),
          'hand',
        );
        this.menuHand = t.id;
        this.fist.reset();
        handRuntime.menuProgress.clear();
        return;
      }
    }
  }

  private drive(
    now: number,
    tracks: TrackSnapshot[],
    result: EngineResult,
    menu: ReturnType<typeof useMenu.getState>,
  ) {
    const t = tracks.find((x) => x.id === this.menuHand);
    const p = result.pointers.find((x) => x.id === this.menuHand);
    if (!t || !p) {
      menu.close();
      this.menuHand = null;
      return;
    }
    if (t.status !== 'tracking') return; // briefly lost: hold
    menu.point(p.screen.x - menu.x, p.screen.y - menu.y);
    if (t.pinch.started) {
      menu.choose();
      if (!useMenu.getState().open) this.menuHand = null;
      return;
    }
    if (t.world && this.fist.update(now, isFist(t.world)).completed) {
      menu.close();
      this.menuHand = null;
    }
  }

  reset() {
    this.detectors.clear();
    this.menuHand = null;
    handRuntime.menuProgress.clear();
  }
}
