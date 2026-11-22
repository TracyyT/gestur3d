import { useSampled } from '@/hooks/useSampled';
import { renderStats } from '@/lib/telemetry/renderStats';
import { useScene, type InteractionMode } from '@/stores/scene';
import { cn } from '@/ui';

const MODE_LABEL: Record<InteractionMode, string> = {
  idle: 'Idle',
  selecting: 'Selected',
  moving: 'Moving',
  rotating: 'Rotating',
  scaling: 'Scaling',
  twoHand: 'Two-hand',
  depth: 'Depth',
};

const read = () => renderStats.snapshot();

function fpsTone(fps: number) {
  if (fps === 0) return 'text-ink-3';
  if (fps >= 50) return 'text-signal-good';
  if (fps >= 30) return 'text-ink-1';
  return 'text-signal-warn';
}

/** Compact live readouts: render FPS, frame time, interaction mode and input source. */
export function StatusCluster() {
  const { fps, frameMs } = useSampled(read, 250);
  const mode = useScene((s) => (s.mode === 'idle' && s.selectedId ? 'selecting' : s.mode));
  const source = useScene((s) => s.lastSource);

  return (
    <div
      className="glass flex items-center gap-4 rounded-full px-4 py-2 text-[12px]"
      role="group"
      aria-label="Status"
    >
      <div className="flex items-baseline gap-1.5" title="Measured rendering frames per second">
        <span className={cn('tabular font-mono text-[13px]', fpsTone(fps))}>
          {fps ? fps.toFixed(0) : '—'}
        </span>
        <span className="text-ink-3">fps</span>
      </div>
      <div className="flex items-baseline gap-1.5" title="Average time between frames">
        <span className="tabular font-mono text-[13px] text-ink-1">
          {frameMs ? frameMs.toFixed(1) : '—'}
        </span>
        <span className="text-ink-3">ms</span>
      </div>
      <span aria-hidden className="h-3.5 w-px bg-line-strong" />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            mode === 'idle' ? 'bg-ink-3' : 'bg-holo-cyan shadow-[0_0_8px_var(--color-holo-cyan)]',
          )}
        />
        <span className="text-ink-1" data-testid="interaction-mode">
          {MODE_LABEL[mode]}
        </span>
        {source && mode !== 'idle' && <span className="text-ink-3 capitalize">· {source}</span>}
      </div>
    </div>
  );
}
