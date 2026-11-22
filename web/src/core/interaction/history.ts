import type { Command, SceneModel } from './commands';

/** How many steps Undo can go back. */
export const UNDO_LIMIT = 50;

/**
 * The command that undoes `cmd`, given the scene before it ran, or null if
 * `cmd` isn't an undoable step. Undo covers structural changes (adding,
 * removing, recoloring, clearing drawings), not continuous moves, which are easy to redo by hand
 * and would flood the history.
 */
export function inverseOf(before: SceneModel, cmd: Command): Command | null {
  switch (cmd.type) {
    case 'add':
    case 'addStroke':
      return { type: 'remove', id: `obj-${before.nextId}` };
    case 'remove': {
      const index = before.objects.findIndex((o) => o.id === cmd.id);
      if (index === -1) return null;
      return {
        type: 'restore',
        object: before.objects[index]!,
        index,
        selected: before.selectedId === cmd.id,
      };
    }
    case 'setColor': {
      const o = before.objects.find((x) => x.id === cmd.id);
      return o ? { type: 'setColor', id: cmd.id, color: o.color ?? null } : null;
    }
    case 'clearStrokes': {
      const items = before.objects.flatMap((object, index) =>
        object.kind === 'stroke' ? [{ object, index }] : [],
      );
      return items.length ? { type: 'restoreMany', items, selectedId: before.selectedId } : null;
    }
    default:
      return null;
  }
}
