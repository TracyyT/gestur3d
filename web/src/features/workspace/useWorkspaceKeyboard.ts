import { useCallback, type KeyboardEvent } from 'react';
import { keyToCommand } from '@/core/interaction/keyboard';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';

/**
 * Keyboard control for the focused scene region.
 * Tab / Shift+Tab cycle objects, but stepping past either end lets focus
 * leave the scene normally, so there's no keyboard trap.
 */
export function useWorkspaceKeyboard(onToggleHelp: () => void) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return; // only when the scene itself has focus
      if (e.key === '?') {
        e.preventDefault();
        onToggleHelp();
        return;
      }
      if (!useSettings.getState().mouseKeyboardEnabled) return;

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
