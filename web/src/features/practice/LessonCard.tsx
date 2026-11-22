import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ObjectiveState } from '@/core/objectives/objectives';
import type { Lesson } from '@/core/practice/lessons';
import { scriptedRecording } from '@/core/tracking/scripts';
import { GhostHand } from '@/features/hands/GhostHand';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { Button, GlassPanel, cn } from '@/ui';
import { LESSONS } from '@/core/practice/lessons';

interface Props {
  lesson: Lesson;
  index: number;
  state: ObjectiveState;
  completed: readonly string[];
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onJump: (index: number) => void;
}

/** The lesson panel: steps, instruction, demo hand, live progress and controls. */
export function LessonCard({
  lesson,
  index,
  state,
  completed,
  onPrevious,
  onNext,
  onRetry,
  onSkip,
  onJump,
}: Props) {
  const [demoRun, setDemoRun] = useState(0);
  const recording = useMemo(
    () =>
      scriptedRecording(lesson.demo.keys, {
        handedness: lesson.demo.handedness,
        aspect: 16 / 9,
        label: `demo: ${lesson.id}`,
      }),
    [lesson],
  );
  const cameraOff = useHandTracking((s) => s.status === 'off' || s.status === 'error');

  return (
    <GlassPanel
      role="region"
      aria-label="Lesson"
      className="pointer-events-auto absolute top-[68px] left-4 z-20 flex max-h-[calc(100%-260px)] w-[320px] flex-col gap-4 overflow-y-auto p-5"
    >
      <ol aria-label="Lessons" className="flex gap-1.5">
        {LESSONS.map((l, i) => (
          <li key={l.id} className="flex-1">
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Lesson ${i + 1}: ${l.title}${completed.includes(l.id) ? ', done' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'block h-1.5 w-full rounded-full transition-colors',
                i === index
                  ? 'bg-holo-cyan'
                  : completed.includes(l.id)
                    ? 'bg-holo-cyan/45'
                    : 'bg-white/10 hover:bg-white/20',
              )}
            />
          </li>
        ))}
      </ol>

      <div>
        <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">
          Lesson {index + 1} of {LESSONS.length}
          {lesson.optional ? ' · optional' : ''}
        </p>
        <h2 className="mt-1 text-[17px] font-semibold">{lesson.title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{lesson.instruction}</p>
      </div>

      <div className="relative rounded-xl border border-line bg-black/30">
        <GhostHand
          key={demoRun}
          recording={recording}
          label={`Demo: ${lesson.title}`}
          className="h-32 w-full"
        />
        <button
          type="button"
          onClick={() => setDemoRun((n) => n + 1)}
          className="absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink-1"
        >
          Replay demo
        </button>
      </div>

      {cameraOff && !state.done ? (
        <p className="text-[12.5px] text-ink-2">
          This lesson needs the camera.{' '}
          <Link to="/setup?next=/practice" className="text-holo-cyan hover:underline">
            Turn on camera
          </Link>
        </p>
      ) : (
        <div aria-live="polite">
          <div
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-150',
                state.done ? 'bg-signal-good' : 'bg-holo-cyan',
              )}
              style={{ width: `${state.progress * 100}%` }}
            />
          </div>
          <p className={cn('mt-2 text-[12.5px]', state.done ? 'text-signal-good' : 'text-ink-2')}>
            {state.done ? 'Nice, that’s it.' : (state.hint ?? 'Follow the demo.')}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onPrevious} disabled={index === 0}>
          Previous
        </Button>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
        <span className="flex-1" />
        {state.done ? (
          <Button size="sm" variant="primary" onClick={onNext}>
            Next
          </Button>
        ) : (
          <Button size="sm" onClick={onSkip}>
            Skip
          </Button>
        )}
      </div>
    </GlassPanel>
  );
}
