import type {
  Command,
  InputSource,
  SceneModel,
  SceneObject,
  Vec3,
} from '@/core/interaction/commands';
import { quatAngleBetween } from '@/core/math/quat';

/**
 * Practice tasks: things to try, in any order, each ticked off the first
 * time it's done by hand. Thresholds are forgiving: the point is to find the
 * gesture, not to be precise.
 */
export type TaskId = 'move' | 'resize' | 'rotate' | 'depth' | 'menu' | 'add' | 'draw';

export interface PracticeTask {
  id: TaskId;
  label: string;
  /** How to do it, one short sentence. */
  how: string;
  /** Not needed to finish Practice. */
  optional?: boolean;
}

export const TASKS: readonly PracticeTask[] = [
  { id: 'move', label: 'Grab and move', how: 'Pinch an object, move your hand, then let go.' },
  {
    id: 'resize',
    label: 'Resize with two hands',
    how: 'Hold it with one hand, pinch with the other, then spread them apart or together.',
  },
  {
    id: 'rotate',
    label: 'Rotate with two hands',
    how: 'Holding it with both hands, turn them like a steering wheel.',
  },
  {
    id: 'depth',
    label: 'Push and pull',
    how: 'Hold it with one hand, open the other over it, and move that hand toward or away from the camera.',
    optional: true,
  },
  { id: 'menu', label: 'Open the menu', how: 'Point your index finger up and hold still.' },
  {
    id: 'add',
    label: 'Add a shape from the menu',
    how: 'With the menu open, point at Add, then at a shape, and pinch.',
  },
  {
    id: 'draw',
    label: 'Draw in the air',
    how: 'Choose Draw in the menu, then pinch empty space and move.',
  },
];

export const REQUIRED_TASKS: readonly TaskId[] = TASKS.filter((t) => !t.optional).map((t) => t.id);

/** How far counts, from where the object was when practice started (or was last moved another way). */
export const TASK_THRESHOLDS = {
  /** Sideways travel, world units (the scene is about 6 wide). */
  move: 0.5,
  /** Scale change factor, either way. */
  resize: 1.3,
  /** Degrees. */
  rotate: 30,
  /** Change in distance to the camera, world units. */
  depth: 0.6,
};

interface Pose {
  position: Vec3;
  rotation: SceneObject['rotation'];
  scale: number;
}

const pose = (o: SceneObject): Pose => ({
  position: o.position,
  rotation: o.rotation,
  scale: o.scale,
});
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Watches scene changes and menu use, and reports which tasks are done.
 * Only hand input counts. Changes made another way (mouse, keyboard, undo)
 * move the baseline, so mixing inputs can't tick a task.
 */
export class PracticeTracker {
  readonly done = new Set<TaskId>();
  private base = new Map<string, Pose>();
  private readonly camera: Vec3;

  constructor(scene: SceneModel, camera: Vec3) {
    this.camera = camera;
    this.rebase(scene);
  }

  /** Take baselines from this scene (e.g. after a reset). */
  rebase(scene: SceneModel) {
    this.base = new Map(scene.objects.map((o) => [o.id, pose(o)]));
  }

  /** After a command changed the scene. Returns tasks newly done. */
  command(cmd: Command, source: InputSource, after: SceneModel): TaskId[] {
    const fresh: TaskId[] = [];
    const tick = (id: TaskId) => fresh.push(...this.mark(id));
    if (source === 'gesture' && cmd.type === 'addStroke') tick('draw');

    for (const o of after.objects) {
      const b = this.base.get(o.id);
      if (!b || source !== 'gesture') {
        this.base.set(o.id, pose(o));
        continue;
      }
      const lateral = Math.hypot(o.position[0] - b.position[0], o.position[1] - b.position[1]);
      if (lateral >= TASK_THRESHOLDS.move) tick('move');
      if (Math.abs(Math.log(o.scale / b.scale)) >= Math.log(TASK_THRESHOLDS.resize)) tick('resize');
      if ((quatAngleBetween(o.rotation, b.rotation) * 180) / Math.PI >= TASK_THRESHOLDS.rotate)
        tick('rotate');
      const depth = dist(o.position, this.camera) - dist(b.position, this.camera);
      if (Math.abs(depth) >= TASK_THRESHOLDS.depth) tick('depth');
    }
    for (const id of [...this.base.keys()])
      if (!after.objects.some((o) => o.id === id)) this.base.delete(id);
    return fresh;
  }

  /** The menu opened (`by`: how). */
  menuOpened(by: string): TaskId[] {
    return by === 'hand' ? this.mark('menu') : [];
  }

  /** A menu action ran; `openedBy` is how the menu was opened. */
  menuAction(action: string, openedBy: string | null): TaskId[] {
    return action === 'add' && openedBy === 'hand' ? this.mark('add') : [];
  }

  private mark(id: TaskId): TaskId[] {
    if (this.done.has(id)) return [];
    this.done.add(id);
    return [id];
  }
}
