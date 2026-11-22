import { create } from 'zustand';
import type { HoloColor, ObjectKind } from '@/core/interaction/commands';
import {
  MENU_ACTIONS,
  hitTest,
  type MenuAction,
  type MenuHit,
} from '@/core/interaction/radialMenu';
import { OBJECT_KINDS } from '@/core/interaction/sceneModel';
import { useScene } from '@/stores/scene';

export type MenuOpener = 'keyboard' | 'hand';

export const COLOR_CHOICES: readonly HoloColor[] = ['cyan', 'violet', 'white'];

/** Which inner sectors open an outer ring, and what's on it. */
export function outerItems(action: MenuAction): readonly (ObjectKind | HoloColor)[] | null {
  if (action === 'add') return OBJECT_KINDS;
  if (action === 'color') return COLOR_CHOICES;
  return null;
}

/** Whether an action can run right now. Draw and Clear arrive with air drawing. */
export function actionEnabled(action: MenuAction): boolean {
  const scene = useScene.getState();
  switch (action) {
    case 'add':
      return true;
    case 'color':
    case 'delete':
      return scene.selectedId !== null;
    case 'undo':
      return scene.undoStack.length > 0;
    case 'draw':
    case 'clear':
      return false;
  }
}

interface MenuState {
  open: boolean;
  /** Center on screen, px. */
  x: number;
  y: number;
  openedBy: MenuOpener | null;
  /** Inner sector whose outer ring is showing. */
  expanded: number | null;
  highlight: MenuHit;
  openAt: (x: number, y: number, by: MenuOpener) => void;
  close: () => void;
  /** Pointer (hand cursor or mouse) at offset (dx, dy) from the center. */
  point: (dx: number, dy: number) => void;
  /** Keyboard: move the highlight one step around its ring. */
  step: (dir: 1 | -1) => void;
  /** Choose the highlighted item (an outer-ring sector opens its ring instead). */
  choose: () => void;
  /** Keyboard Esc: close the outer ring first, then the menu. */
  back: () => void;
}

const NONE: MenuHit = { ring: 'none' };

function run(action: MenuAction, outerIndex: number | null) {
  const scene = useScene.getState();
  const items = outerItems(action);
  if (items && outerIndex !== null) {
    const choice = items[outerIndex]!;
    if (action === 'add') scene.dispatch({ type: 'add', kind: choice as ObjectKind }, 'ui');
    if (action === 'color' && scene.selectedId)
      scene.dispatch({ type: 'setColor', id: scene.selectedId, color: choice as HoloColor }, 'ui');
    return;
  }
  if (action === 'undo') scene.undo('ui');
  if (action === 'delete' && scene.selectedId)
    scene.dispatch({ type: 'remove', id: scene.selectedId }, 'ui');
}

export const useMenu = create<MenuState>()((set, get) => ({
  open: false,
  x: 0,
  y: 0,
  openedBy: null,
  expanded: null,
  highlight: NONE,
  openAt: (x, y, by) => set({ open: true, x, y, openedBy: by, expanded: null, highlight: NONE }),
  close: () => set({ open: false, openedBy: null, expanded: null, highlight: NONE }),
  point: (dx, dy) => {
    const { expanded, highlight } = get();
    const outer =
      expanded !== null
        ? { parent: expanded, count: outerItems(MENU_ACTIONS[expanded]!)!.length }
        : null;
    const hit = hitTest(dx, dy, outer, highlight);
    let next = expanded;
    if (hit.ring === 'inner') {
      const action = MENU_ACTIONS[hit.index]!;
      // Hovering a sector with choices opens its outer ring; another closes it.
      next = outerItems(action) && actionEnabled(action) ? hit.index : null;
    }
    set({ highlight: hit, expanded: next });
  },
  step: (dir) => {
    const { highlight, expanded } = get();
    if (highlight.ring === 'outer' && expanded !== null) {
      const n = outerItems(MENU_ACTIONS[expanded]!)!.length;
      set({ highlight: { ring: 'outer', index: (highlight.index + dir + n) % n } });
      return;
    }
    const n = MENU_ACTIONS.length;
    const i = highlight.ring === 'inner' ? (highlight.index + dir + n) % n : dir === 1 ? 0 : n - 1;
    set({ highlight: { ring: 'inner', index: i }, expanded: null });
  },
  choose: () => {
    const { highlight, expanded } = get();
    if (highlight.ring === 'none') {
      get().close();
      return;
    }
    if (highlight.ring === 'outer' && expanded !== null) {
      run(MENU_ACTIONS[expanded]!, highlight.index);
      get().close();
      return;
    }
    const action = MENU_ACTIONS[highlight.index]!;
    if (!actionEnabled(action)) return;
    if (outerItems(action)) {
      // Keyboard path into the outer ring.
      set({ expanded: highlight.index, highlight: { ring: 'outer', index: 0 } });
      return;
    }
    run(action, null);
    get().close();
  },
  back: () => {
    const { expanded, highlight } = get();
    if (expanded !== null && highlight.ring === 'outer') {
      set({ highlight: { ring: 'inner', index: expanded }, expanded: null });
      return;
    }
    get().close();
  },
}));
