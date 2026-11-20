import { useState } from 'react';
import {
  Button,
  GlassPanel,
  IconButton,
  Kbd,
  Panel,
  Select,
  Slider,
  StatusPill,
  Toggle,
} from '@/ui';
import { CalibrationChecklist } from '@/features/setup/CalibrationChecklist';
import { thumbsUpCheck } from '@/features/setup/checks';
import { ThumbsUpPreviewBadge } from '@/features/setup/ThumbsUpBadge';

/** Dev-only gallery of design-system components (route: /dev/ui). */
export function UiGallery() {
  const [smoothing, setSmoothing] = useState(0.5);
  const [reduced, setReduced] = useState(false);
  const [quality, setQuality] = useState<'auto' | 'high'>('auto');

  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-10 md:grid-cols-2">
      <h1 className="text-holo col-span-full text-3xl font-semibold tracking-tight">
        Design system
      </h1>

      <GlassPanel className="space-y-4 p-5">
        <p className="text-[12px] tracking-[0.18em] text-ink-3 uppercase">Buttons</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Launch Workspace</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <IconButton label="Settings">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
              <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" />
            </svg>
          </IconButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="good" pulse>
            2 hands detected
          </StatusPill>
          <StatusPill tone="active">Grab</StatusPill>
          <StatusPill tone="warn">Low light</StatusPill>
          <StatusPill tone="bad">Camera blocked</StatusPill>
          <StatusPill tone="idle">Idle</StatusPill>
        </div>
        <p className="text-[13px] text-ink-2">
          Press <Kbd>?</Kbd> for shortcuts, <Kbd>Esc</Kbd> to deselect.
        </p>
      </GlassPanel>

      <Panel title="Settings">
        <div className="space-y-4">
          <Slider
            label="Tracking smoothing"
            value={smoothing}
            onChange={setSmoothing}
            hint="Higher is steadier but adds a little lag."
          />
          <Toggle label="Reduced motion" checked={reduced} onChange={setReduced} />
          <Select
            label="Visual quality"
            value={quality}
            onChange={setQuality}
            options={[
              { value: 'auto', label: 'Auto (adaptive)' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
      </Panel>

      <GlassPanel className="space-y-4 p-5">
        <p className="text-[12px] tracking-[0.18em] text-ink-3 uppercase">Thumbs-up hold</p>
        <CalibrationChecklist
          items={[thumbsUpCheck(false, 0), thumbsUpCheck(true, 0), thumbsUpCheck(true, 0.6)].map(
            (c, i) => ({ ...c, id: `${c.id}-${i}` }),
          )}
        />
      </GlassPanel>
      <GlassPanel className="relative h-40 overflow-hidden">
        <ThumbsUpPreviewBadge progress={0.6} />
      </GlassPanel>
    </main>
  );
}
