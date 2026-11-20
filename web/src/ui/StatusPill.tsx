import type { ReactNode } from 'react';
import { cn } from './cn';

export type StatusTone = 'idle' | 'active' | 'good' | 'warn' | 'bad';

const tones: Record<StatusTone, { dot: string; text: string }> = {
  idle: { dot: 'bg-ink-3', text: 'text-ink-2' },
  active: { dot: 'bg-holo-cyan shadow-[0_0_8px_var(--color-holo-cyan)]', text: 'text-ink-1' },
  good: { dot: 'bg-signal-good shadow-[0_0_8px_var(--color-signal-good)]', text: 'text-ink-1' },
  warn: { dot: 'bg-signal-warn', text: 'text-ink-1' },
  bad: { dot: 'bg-signal-bad', text: 'text-ink-1' },
};

export interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}

/** Small status readout. Color is never the only signal: the text says the state. */
export function StatusPill({ tone, children, pulse, className }: StatusPillProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        'glass-inset inline-flex h-7 items-center gap-2 rounded-full px-3 text-[12px]',
        t.text,
        className,
      )}
    >
      <span className="relative inline-flex size-1.5">
        {pulse && (
          <span
            aria-hidden
            className={cn('absolute inset-0 animate-ping rounded-full opacity-60', t.dot)}
          />
        )}
        <span aria-hidden className={cn('relative size-1.5 rounded-full', t.dot)} />
      </span>
      {children}
    </span>
  );
}
