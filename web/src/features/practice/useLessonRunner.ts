import { useEffect, useState } from 'react';
import type { ObjectiveContext, ObjectiveState } from '@/core/objectives/objectives';
import type { Lesson } from '@/core/practice/lessons';
import { useDraw } from '@/features/drawing/drawStore';
import { handRuntime } from '@/features/hands/handRuntime';
import { useMenu } from '@/features/menu/menuStore';
import { sessionLog } from '@/features/session/session';
import { useScene } from '@/stores/scene';

const IDLE: ObjectiveState = { progress: 0, done: false };

/** What the objective needs this frame, from the live stores. */
function snapshot(t: number): ObjectiveContext {
  const { objects, selectedId, nextId } = useScene.getState();
  return {
    t,
    scene: { objects, selectedId, nextId },
    hands: handRuntime.pointers.map((p) => ({
      id: p.id,
      inView: p.phase !== 'lost' && p.inBox,
      hoverId: p.hoverId,
      grabbedId: p.grabbedId,
    })),
    menuOpen: useMenu.getState().open,
  };
}

/**
 * Runs a lesson: loads its scene, then checks its objective every frame.
 * Changing `attempt` restarts it (Retry). `onDone` fires once per attempt.
 */
export function useLessonRunner(
  lesson: Lesson | null,
  attempt: number,
  onDone: (lesson: Lesson) => void,
): ObjectiveState {
  // Tagged with the run it belongs to, so a new lesson or retry starts from idle.
  const run = lesson ? `${lesson.id}:${attempt}` : '';
  const [state, setState] = useState<{ run: string; s: ObjectiveState }>({ run: '', s: IDLE });

  useEffect(() => {
    if (!lesson) return;
    useScene.setState({ objects: lesson.scene(), selectedId: null, undoStack: [] });
    useDraw.getState().setActive(false);
    useMenu.getState().close();
    sessionLog.add({ type: 'mark', name: 'lesson-start', detail: lesson.id });

    const objective = lesson.objective();
    let last = IDLE;
    let finished = false;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = objective.update(snapshot(performance.now()));
      const progress = Math.round(s.progress * 50) / 50;
      if (progress !== last.progress || s.done !== last.done || s.hint !== last.hint) {
        last = { ...s, progress };
        setState({ run: `${lesson.id}:${attempt}`, s: last });
      }
      if (s.done && !finished) {
        finished = true;
        sessionLog.add({ type: 'mark', name: 'lesson-done', detail: lesson.id });
        onDone(lesson);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // onDone is read when the objective finishes; a new callback needn't restart the lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, attempt]);

  return state.run === run ? state.s : IDLE;
}
