import type { ReactNode } from 'react';
import { cn } from '@/ui';

/** `locked`: not available yet (grayed). `active`: waiting on the user, with progress. */
export type CheckState = 'pass' | 'fail' | 'pending' | 'locked' | 'active';

export interface CheckItem {
  id: string;
  label: string;
  detail: string;
  state: CheckState;
  /** 0..1, shown as a filling ring when state is `active`. */
  progress?: number;
  /** Extra content under the detail (e.g. a demo). */
  extra?: ReactNode;
}

function Mark({ state, progress = 0 }: { state: CheckState; progress?: number }) {
  if (state === 'pass') {
    return (
      <span className="grid size-5 place-items-center rounded-full bg-signal-good/15 text-signal-good">
        <svg aria-hidden viewBox="0 0 16 16" className="size-3">
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  if (state === 'fail') {
    return (
      <span className="grid size-5 place-items-center rounded-full bg-signal-warn/15 text-signal-warn">
        <svg aria-hidden viewBox="0 0 16 16" className="size-3">
          <path
            d="M8 4.5v4.5m0 2.5v.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    const r = 8.5;
    const c = 2 * Math.PI * r;
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="size-5 -rotate-90">
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="var(--color-holo-cyan)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="var(--color-holo-cyan)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
    );
  }
  return <span className="block size-5 rounded-full border border-dashed border-ink-4" />;
}

const srState: Record<CheckState, string> = {
  pass: 'done',
  fail: 'needs attention',
  pending: 'waiting',
  locked: 'not available yet',
  active: 'ready',
};

export function CalibrationChecklist({
  items,
  label = 'Calibration checks',
}: {
  items: CheckItem[];
  /** Screen-reader name of the list. */
  label?: string;
}) {
  return (
    <ul className="space-y-3" aria-label={label}>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn('flex items-start gap-3', item.state === 'locked' && 'opacity-40')}
        >
          <span className="mt-0.5">
            <Mark state={item.state} progress={item.progress} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn('text-[14px]', item.state === 'pending' ? 'text-ink-2' : 'text-ink-1')}
            >
              {item.label}
              <span className="sr-only">: {srState[item.state]}</span>
            </p>
            {item.detail && (
              <p className="mt-0.5 text-[12.5px] text-ink-3" aria-live="polite">
                {item.detail}
              </p>
            )}
            {item.extra}
          </div>
        </li>
      ))}
    </ul>
  );
}
