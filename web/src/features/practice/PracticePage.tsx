import { useEffect } from 'react';
import { createInitialScene } from '@/core/interaction/sceneModel';
import { PracticeTracker, type TaskId } from '@/core/practice/tasks';
import { onMenuAction, useMenu } from '@/features/menu/menuStore';
import { borrowScene } from '@/features/modes/borrowScene';
import { ModeShell } from '@/features/modes/ModeShell';
import { sessionLog } from '@/features/session/session';
import { CAMERA_POSITION } from '@/scene/camera';
import { useHudLayout } from '@/stores/hudLayout';
import { onSceneChange, useScene } from '@/stores/scene';
import { PracticePanel } from './PracticePanel';
import { usePractice } from './practiceStore';

/** Fresh practice objects, and a tracker that ticks tasks off as hands do them. */
function usePracticeTracking() {
  const complete = usePractice((s) => s.complete);
  useEffect(() => {
    const release = borrowScene();
    useScene.setState({ ...createInitialScene(), undoStack: [] });
    const tracker = new PracticeTracker(useScene.getState(), CAMERA_POSITION);
    const record = (ids: TaskId[]) => {
      if (!ids.length) return;
      complete(ids);
      for (const id of ids) sessionLog.add({ type: 'mark', name: 'task-done', detail: id });
    };
    const offScene = onSceneChange((c) => {
      if (c.kind === 'undo') tracker.rebase(useScene.getState());
      else record(tracker.command(c.cmd, c.source, useScene.getState()));
    });
    const offAction = onMenuAction((action) =>
      record(tracker.menuAction(action, useMenu.getState().openedBy)),
    );
    const offMenu = useMenu.subscribe((s, prev) => {
      if (s.open && !prev.open && s.openedBy) record(tracker.menuOpened(s.openedBy));
    });
    // Start over: fresh objects, and every task can tick again.
    const offReset = usePractice.subscribe((s, prev) => {
      if (s.done.length || !prev.done.length) return;
      useScene.setState({ ...createInitialScene(), undoStack: [] });
      tracker.done.clear();
      tracker.rebase(useScene.getState());
      sessionLog.add({ type: 'mark', name: 'practice-reset' });
    });
    return () => {
      offScene();
      offAction();
      offMenu();
      offReset();
      release();
    };
  }, [complete]);
}

/** The checklist's width plus its margin: the scene frames to its right. */
const PANEL_INSET_PX = 16 + 340;

/** Practice mode: try each gesture on a scratch scene; each one ticks off when it works. */
export function PracticePage() {
  usePracticeTracking();
  useEffect(() => {
    useHudLayout.getState().setLeftInset(PANEL_INSET_PX);
    return () => useHudLayout.getState().setLeftInset(0);
  }, []);
  const done = usePractice((s) => s.done);
  const reset = usePractice((s) => s.reset);

  return (
    <ModeShell
      mode="practice"
      sceneLabel="Practice. The checklist is on the left; question mark for controls."
      hud={{ objects: false }}
    >
      <PracticePanel done={done} onReset={reset} />
    </ModeShell>
  );
}
