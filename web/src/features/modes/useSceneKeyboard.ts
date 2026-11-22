import { useCallback, type KeyboardEvent } from 'react';
import { keyToCommand } from '@/core/interaction/keyboard';
import { useDraw } from '@/features/drawing/drawStore';
import { useMenu } from '@/features/menu/menuStore';
import { visibleSceneRect } from '@/scene/framing';
import { useHudLayout } from '@/stores/hudLayout';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';

/**
 * Keyboard control for the focused scene region.
 * Tab / Shift+Tab cycle objects, but stepping past either end lets focus
 * leave the scene normally, so there's no keyboard trap.
 */
export function useSceneKeyboard(onToggleHelp: () => void) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return; // only when the scene itself has focus
      if (e.key === '?') {
        e.preventDefault();
        onToggleHelp();
        return;
      }
      if (!useSettings.getState().mouseKeyboardEnabled) return;

      // Radial menu: M opens it in the middle of the scene; while open it
      // takes the arrow keys, Enter and Esc.
      const menu = useMenu.getState();
      if (menu.open) {
        const keys: Record<string, () => void> = {
          ArrowRight: () => menu.step(1),
          ArrowDown: () => menu.step(1),
          ArrowLeft: () => menu.step(-1),
          ArrowUp: () => menu.step(-1),
          Enter: () => menu.choose(),
          ' ': () => menu.choose(),
          Escape: () => menu.back(),
          m: () => menu.close(),
          M: () => menu.close(),
        };
        const fn = keys[e.key];
        if (fn) {
          e.preventDefault();
          fn();
        }
        if (e.key !== 'Tab') return;
      }
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const hud = useHudLayout.getState();
        const r = visibleSceneRect(
          hud.panelsVisible,
          window.innerWidth,
          window.innerHeight,
          hud.leftInset,
        );
        menu.openAt(r.left + r.width / 2, r.top + r.height / 2, 'keyboard');
        return;
      }

      if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useDraw.getState().toggle();
        return;
      }

      const { objects, selectedId, dispatch, undo } = useScene.getState();

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo('keyboard');
        return;
      }

      if (e.key === 'Tab') {
        const i = objects.findIndex((o) => o.id === selectedId);
        const atEnd = e.shiftKey ? i === 0 : i === objects.length - 1;
        if (!objects.length || (i !== -1 && atEnd)) {
          dispatch({ type: 'select', id: null }, 'keyboard');
          return; // let the browser move focus on
        }
        e.preventDefault();
        dispatch({ type: 'cycleSelection', direction: e.shiftKey ? -1 : 1 }, 'keyboard');
        return;
      }

      const cmd = keyToCommand(e, selectedId);
      if (cmd) {
        e.preventDefault();
        dispatch(cmd, 'keyboard');
      }
    },
    [onToggleHelp],
  );
}
