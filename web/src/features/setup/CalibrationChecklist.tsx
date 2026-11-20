import { cn } from '@/ui';

export type CheckState = 'pass' | 'fail' | 'pending';

export interface CheckItem {
  id: string;
  label: string;
  detail: string;
  state: CheckState;
}

function Mark({ state }: { state: CheckState }) {
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
  return <span className="block size-5 rounded-full border border-dashed border-ink-4" />;
}

const srState: Record<CheckState, string> = {
  pass: 'done',
  fail: 'needs attention',
  pending: 'waiting',
};

export function CalibrationChecklist({ items }: { items: CheckItem[] }) {
  return (
    <ul className="space-y-3" aria-label="Calibration checks">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="mt-0.5">
            <Mark state={item.state} />
          </span>
          <div className="min-w-0">
            <p
              className={cn('text-[14px]', item.state === 'pending' ? 'text-ink-2' : 'text-ink-1')}
            >
              {item.label}
              <span className="sr-only">: {srState[item.state]}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-3" aria-live="polite">
              {item.detail}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
