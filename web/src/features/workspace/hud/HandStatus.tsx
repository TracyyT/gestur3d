import { useCallback } from 'react';
import type { HandPointer, PointerPhase } from '@/core/interaction/handInteraction';
import { handRuntime } from '@/features/hands/handRuntime';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { useSampled } from '@/hooks/useSampled';
import { cn } from '@/ui';

const PHASE: Record<PointerPhase, string> = {
  tracking: 'Tracking',
  hovering: 'Hover',
  pinching: 'Pinch',
  grabbing: 'Grab',
  lost: 'Lost',
};

function HandChip({ side, pointer }: { side: 'Right' | 'Left'; pointer: HandPointer | undefined }) {
  const color = side === 'Right' ? 'var(--color-holo-cyan)' : 'var(--color-holo-violet)';
  const present = pointer && pointer.phase !== 'lost';
  const label = `${side} hand: ${pointer ? PHASE[pointer.phase].toLowerCase() : 'not detected'}${
    present ? `, pinch ${Math.round(pointer.pinchStrength * 100)}%` : ''
  }`;
  return (
    <span className="flex items-center gap-2" title={label}>
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn(
          'grid size-5 place-items-center rounded-md font-mono text-[10.5px]',
          !present && 'opacity-35',
        )}
        style={{ color, boxShadow: `inset 0 0 0 1px ${color}` }}
      >
        {side[0]}
      </span>
      <span aria-hidden className="h-1 w-8 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full transition-[width] duration-75"
          style={{
            width: `${present ? Math.round(pointer.pinchStrength * 100) : 0}%`,
            background: color,
          }}
        />
      </span>
      <span aria-hidden className={cn('w-12 text-[11.5px]', present ? 'text-ink-1' : 'text-ink-4')}>
        {pointer ? PHASE[pointer.phase] : '—'}
      </span>
    </span>
  );
}

/** Per-hand presence, phase and pinch strength, sampled at 10 Hz. */
export function HandStatus() {
  const status = useHandTracking((s) => s.status);
  const read = useCallback(() => [...handRuntime.pointers], []);
  const pointers = useSampled(read, 100);

  if (status !== 'running') {
    const text =
      status === 'starting'
        ? 'Starting hand tracking…'
        : status === 'error'
          ? 'Hand tracking unavailable'
          : 'Hands off';
    return (
      <div
        className="glass flex h-9 items-center rounded-full px-4 text-[12px] text-ink-3"
        role="status"
      >
        {text}
      </div>
    );
  }

  const right = pointers.find((p) => p.handedness === 'Right');
  const left = pointers.find((p) => p.handedness === 'Left');
  return (
    <div
      className="glass flex h-9 items-center gap-4 rounded-full px-4"
      role="group"
      aria-label="Hands"
    >
      <HandChip side="Right" pointer={right} />
      <HandChip side="Left" pointer={left} />
    </div>
  );
}
