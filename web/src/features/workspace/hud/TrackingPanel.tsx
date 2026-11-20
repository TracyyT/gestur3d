import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { RateMeter } from '@/core/vision/rateMeter';
import { LandmarkRecorder } from '@/core/vision/replaySource';
import { handRuntime } from '@/features/hands/handRuntime';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { useSampled } from '@/hooks/useSampled';
import { useSettings, type TrackingBackendPreference } from '@/stores/settings';
import { Button, Panel, Select, buttonClasses } from '@/ui';

const BACKENDS: Array<{ value: TrackingBackendPreference; label: string }> = [
  { value: 'auto', label: 'Auto (worker, fall back to main)' },
  { value: 'worker', label: 'Web Worker' },
  { value: 'main-thread', label: 'Main thread' },
];

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="glass-inset rounded-lg px-2.5 py-2">
      <p className="text-[10.5px] tracking-[0.12em] text-ink-3 uppercase">{label}</p>
      <p className="tabular mt-0.5 font-mono text-[14px] text-ink-1">
        {value}
        {unit && <span className="ml-1 text-[11px] text-ink-3">{unit}</span>}
      </p>
    </div>
  );
}

/** Live tracking metrics, backend choice and the landmark recorder. */
export function TrackingPanel() {
  const { status, backend, delegate, error, source, cameraAspect } = useHandTracking();
  const preference = useSettings((s) => s.trackingBackend);
  const set = useSettings((s) => s.set);
  const recorder = useRef(new LandmarkRecorder());
  const [recording, setRecording] = useState(false);

  const read = useCallback(() => {
    const now = performance.now();
    const stats = (source as { stats?: RateMeter } | null)?.stats;
    return {
      // Replays have no detector; count frames reaching the render loop instead.
      fps: stats?.rate(now) ?? handRuntime.frames.rate(now),
      inferMs: stats?.meanDuration() ?? 0,
      latencyMs: handRuntime.latency.meanDuration(),
      hands: handRuntime.pointers.filter((p) => p.phase !== 'lost').length,
      frames: recorder.current.frameCount,
    };
  }, [source]);
  const m = useSampled(read, 250);

  const toggleRecording = () => {
    const r = recorder.current;
    if (!recording) {
      if (!source) return;
      r.start(source);
      setRecording(true);
      return;
    }
    const rec = r.export(cameraAspect, 'workspace');
    setRecording(false);
    const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gestur3d-landmarks-${rec.createdAt.replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const running = status === 'running';
  const summary = running
    ? `${backend === 'worker' ? 'Web Worker' : backend === 'replay' ? 'Replay' : 'Main thread'}${delegate ? ` · ${delegate}` : ''}`
    : status === 'starting'
      ? 'Starting…'
      : status === 'error'
        ? 'Unavailable'
        : 'Camera off';

  return (
    <Panel title="Hand tracking" defaultOpen={false} className="shrink-0">
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink-2">
          <span className={running ? 'text-signal-good' : 'text-ink-3'}>●</span> {summary}
        </p>
        {status === 'error' && error && (
          <p className="text-[12px] break-words text-signal-warn">{error}</p>
        )}
        {status === 'off' && (
          <Link to="/setup" className={buttonClasses('secondary', 'sm', 'w-full')}>
            Turn on camera
          </Link>
        )}

        {running && (
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Detection" value={m.fps ? m.fps.toFixed(0) : '—'} unit="fps" />
            <Metric label="Inference" value={m.inferMs ? m.inferMs.toFixed(1) : '—'} unit="ms" />
            <Metric label="Latency" value={m.latencyMs ? m.latencyMs.toFixed(0) : '—'} unit="ms" />
            <Metric label="Hands" value={String(m.hands)} />
          </div>
        )}

        <Select
          label="Runs in"
          value={preference}
          options={BACKENDS}
          onChange={(v) => set('trackingBackend', v)}
        />

        <div className="space-y-2 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-2">Landmark recorder</p>
            <Button
              size="sm"
              variant={recording ? 'primary' : 'secondary'}
              disabled={!running}
              onClick={toggleRecording}
            >
              {recording ? `Stop · ${m.frames}` : 'Record'}
            </Button>
          </div>
          <p className="text-[11.5px] text-ink-3">
            Hand landmarks only, never video. Saved to your computer.
          </p>
        </div>
      </div>
    </Panel>
  );
}
