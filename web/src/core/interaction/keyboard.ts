import type { Command } from './commands';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export const MOVE_STEP = 0.15;
export const ROTATE_STEP = Math.PI / 16;
export const SCALE_STEP = 1.1;

/** Shortcut reference shown in the workspace help overlay. */
export const SHORTCUTS: ReadonlyArray<{ keys: string[]; action: string }> = [
  { keys: ['Tab', '⇧ Tab'], action: 'Select next / previous object' },
  { keys: ['←', '→', '↑', '↓'], action: 'Move left, right, up, down' },
  { keys: ['⇧ ↑', '⇧ ↓'], action: 'Move away / toward you' },
  { keys: ['Q', 'E'], action: 'Rotate left / right' },
  { keys: ['W', 'S'], action: 'Tilt forward / back' },
  { keys: ['+', '−'], action: 'Scale up / down' },
  { keys: ['Del'], action: 'Remove selected object' },
  { keys: ['Ctrl Z', '⌘ Z'], action: 'Undo add, remove or color' },
  { keys: ['Esc'], action: 'Deselect' },
  { keys: ['M'], action: 'Open the radial menu (arrows, Enter, Esc)' },
  { keys: ['?'], action: 'Show or hide shortcuts' },
];

/**
 * Map a key press to a scene command for the selected object.
 * Returns null for keys this layer doesn't handle (so the browser keeps them).
 * Tab is handled separately because it must be able to leave the scene.
 */
export function keyToCommand(e: KeyInput, selectedId: string | null): Command | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const k = e.key;
  if (k === 'Escape') return selectedId ? { type: 'select', id: null } : null;
  if (!selectedId) return null;

  const id = selectedId;
  const s = MOVE_STEP;
  switch (k) {
    case 'ArrowLeft':
      return { type: 'translate', id, delta: [-s, 0, 0] };
    case 'ArrowRight':
      return { type: 'translate', id, delta: [s, 0, 0] };
    case 'ArrowUp':
      return { type: 'translate', id, delta: e.shiftKey ? [0, 0, -s] : [0, s, 0] };
    case 'ArrowDown':
      return { type: 'translate', id, delta: e.shiftKey ? [0, 0, s] : [0, -s, 0] };
    case 'q':
    case 'Q':
      return { type: 'rotate', id, delta: [0, ROTATE_STEP, 0] };
    case 'e':
    case 'E':
      return { type: 'rotate', id, delta: [0, -ROTATE_STEP, 0] };
    case 'w':
    case 'W':
      return { type: 'rotate', id, delta: [-ROTATE_STEP, 0, 0] };
    case 's':
    case 'S':
      return { type: 'rotate', id, delta: [ROTATE_STEP, 0, 0] };
    case '+':
    case '=':
      return { type: 'scaleBy', id, factor: SCALE_STEP };
    case '-':
    case '_':
      return { type: 'scaleBy', id, factor: 1 / SCALE_STEP };
    case 'Delete':
    case 'Backspace':
      return { type: 'remove', id };
    default:
      return null;
  }
}
