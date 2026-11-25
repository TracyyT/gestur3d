import { Link } from 'react-router';
import { demoFor } from '@/core/demo/demos';
import { TASKS, type TaskId } from '@/core/practice/tasks';
import { GhostHand } from '@/features/hands/GhostHand';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { CalibrationChecklist, type CheckItem } from '@/features/setup/CalibrationChecklist';
import { Button, GlassPanel, buttonClasses } from '@/ui';
import { practiceDone } from './practiceStore';

interface Props {
  done: readonly TaskId[];
  onReset: () => void;
}

/** The Practice checklist: each gesture to try, ticked off as it works, with a demo of the next one. */
export function PracticePanel({ done, onReset }: Props) {
  const tracking = useHandTracking((s) => s.status);
  const cameraOff = tracking === 'off' || tracking === 'error';
  const next = TASKS.find((t) => !done.includes(t.id));
  const finished = practiceDone(done);

  const items: CheckItem[] = TASKS.map((t) => ({
    id: t.id,
    label: t.optional ? `${t.label} (optional)` : t.label,
    // How-to only for the next one, so the list stays short.
    detail: t === next ? t.how : '',
    extra:
      t === next ? (
        <div className="mt-2.5 rounded-lg border border-line bg-black/30">
          <GhostHand
            key={t.id}
            recording={demoFor(t.id)}
            label={`Demo: ${t.label}`}
            className="h-24 w-full"
          />
        </div>
      ) : undefined,
    state: done.includes(t.id) ? 'pass' : t === next ? 'active' : 'pending',
    progress: 0,
  }));

  return (
    <GlassPanel
      role="region"
      aria-label="Practice"
      // Leaves room for the camera preview below it.
      className="pointer-events-auto absolute top-[68px] left-4 z-20 flex max-h-[calc(100%-290px)] w-[340px] flex-col overflow-y-auto p-6"
    >
      <h1 className="text-[18px] font-semibold tracking-tight">Practice</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
        Try each one with your hands. They tick off as you go.
      </p>

      {cameraOff && (
        <p className="mt-3 text-[12.5px] text-signal-warn">
          Hand tracking is off.{' '}
          <Link to="/setup?next=/practice" className="text-holo-cyan hover:underline">
            Turn on camera
          </Link>
        </p>
      )}

      <div className="mt-5">
        <CalibrationChecklist items={items} label="Practice tasks" />
      </div>

      {finished && (
        <p
          className="mt-6 border-t border-line pt-5 text-[13.5px] text-signal-good"
          aria-live="polite"
        >
          All done. You’re ready for the workspace.
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onReset} disabled={!done.length}>
          Start over
        </Button>
        <span className="flex-1" />
        <Link to="/workspace" className={buttonClasses(finished ? 'primary' : 'secondary', 'sm')}>
          Go to Workspace
        </Link>
      </div>
    </GlassPanel>
  );
}
