import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { createInitialScene } from '@/core/interaction/sceneModel';
import { LESSONS, type Lesson } from '@/core/practice/lessons';
import { ModeShell } from '@/features/modes/ModeShell';
import { sessionLog } from '@/features/session/session';
import { useScene } from '@/stores/scene';
import { Button, GlassPanel, buttonClasses } from '@/ui';
import { LessonCard } from './LessonCard';
import { practiceDone, usePractice } from './practiceStore';
import { useLessonRunner } from './useLessonRunner';

/** Keeps the workspace's scene aside while Practice uses its own, and puts it back after. */
function useBorrowedScene() {
  useEffect(() => {
    const { objects, selectedId, nextId, undoStack } = useScene.getState();
    return () => useScene.setState({ objects, selectedId, nextId, undoStack, mode: 'idle' });
  }, []);
}

function FreePractice({ onRestart }: { onRestart: () => void }) {
  const done = practiceDone(usePractice((s) => s.completed));
  useEffect(() => {
    useScene.setState({ ...createInitialScene(), undoStack: [] });
    sessionLog.add({ type: 'mark', name: 'free-practice' });
  }, []);
  return (
    <GlassPanel
      role="region"
      aria-label="Free practice"
      className="pointer-events-auto absolute top-[68px] left-4 z-20 w-[320px] space-y-3 p-5"
    >
      <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">Free practice</p>
      <h2 className="text-[17px] font-semibold">
        {done ? 'You’ve got the basics' : 'Try anything'}
      </h2>
      <p className="text-[13px] leading-relaxed text-ink-2">
        Everything is unlocked here: grab, resize, rotate, draw and use the menu. Nothing you do
        here changes your workspace.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onRestart}>
          Back to lessons
        </Button>
        <span className="flex-1" />
        <Link to="/workspace" className={buttonClasses('primary', 'sm')}>
          Go to Workspace
        </Link>
      </div>
    </GlassPanel>
  );
}

/** Practice mode: short lessons with live feedback, then free practice. */
export function PracticePage() {
  useBorrowedScene();
  const { current, completed, goTo, complete, skip } = usePractice();
  const [attempt, setAttempt] = useState(0);
  const free = current >= LESSONS.length;
  const lesson: Lesson | null = free ? null : LESSONS[current]!;

  const onDone = useCallback((l: Lesson) => complete(l.id), [complete]);
  const state = useLessonRunner(lesson, attempt, onDone);

  const go = (i: number) => {
    goTo(i);
    setAttempt((n) => n + 1);
  };

  return (
    <ModeShell
      mode="practice"
      sceneLabel="Practice. The lesson panel is on the left; question mark for controls."
      hud={{ objects: free, drawButton: free }}
    >
      {lesson ? (
        <LessonCard
          lesson={lesson}
          index={current}
          state={state}
          completed={completed}
          onPrevious={() => go(current - 1)}
          onNext={() => go(current + 1)}
          onRetry={() => setAttempt((n) => n + 1)}
          onSkip={() => {
            skip(lesson.id);
            sessionLog.add({ type: 'mark', name: 'lesson-skip', detail: lesson.id });
            go(current + 1);
          }}
          onJump={go}
        />
      ) : (
        <FreePractice onRestart={() => go(0)} />
      )}
    </ModeShell>
  );
}
