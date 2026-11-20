import { useSettings, type ReducedMotionPreference, type VisualQuality } from '@/stores/settings';
import { Button, Panel, Select, Slider, Toggle } from '@/ui';

const QUALITY: Array<{ value: VisualQuality; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low (no bloom)' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const MOTION: Array<{ value: ReducedMotionPreference; label: string }> = [
  { value: 'system', label: 'Match system' },
  { value: 'on', label: 'Reduce motion' },
  { value: 'off', label: 'Full motion' },
];

export function SettingsPanel() {
  const s = useSettings();

  return (
    <Panel title="Settings" defaultOpen={false} className="shrink-0">
      <div className="space-y-5">
        <section className="space-y-4" aria-label="Hand tracking">
          <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">Hand tracking</p>
          <Slider
            label="Gesture sensitivity"
            value={s.gestureSensitivity}
            onChange={(v) => s.set('gestureSensitivity', v)}
            hint="Higher grabs with your fingers further apart."
          />
          <Slider
            label="Tracking smoothing"
            value={s.trackingSmoothing}
            onChange={(v) => s.set('trackingSmoothing', v)}
            hint="Higher is steadier but adds a little lag."
          />
          <Slider
            label="Reach"
            value={s.handReach}
            min={0.4}
            max={1}
            onChange={(v) => s.set('handReach', v)}
            hint="How much of the camera view your hand moves across to cover the scene. Lower = less arm movement."
          />
        </section>

        <section className="space-y-4 border-t border-line pt-4" aria-label="Visuals">
          <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">Visuals</p>
          <Select
            label="Visual quality"
            value={s.visualQuality}
            options={QUALITY}
            onChange={(v) => s.set('visualQuality', v)}
          />
          <Slider
            label="Particle density"
            value={s.particleDensity}
            onChange={(v) => s.set('particleDensity', v)}
          />
          <Select
            label="Motion"
            value={s.reducedMotion}
            options={MOTION}
            onChange={(v) => s.set('reducedMotion', v)}
          />
        </section>

        <section className="space-y-4 border-t border-line pt-4" aria-label="Input">
          <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">Input</p>
          <Toggle
            label="Keyboard shortcuts"
            hint="Mouse always works. This turns the scene’s keyboard shortcuts on or off."
            checked={s.mouseKeyboardEnabled}
            onChange={(v) => s.set('mouseKeyboardEnabled', v)}
          />
          <Toggle
            label="Debug overlay"
            hint="Landmarks and the reach area on the camera preview."
            checked={s.showDebugOverlay}
            onChange={(v) => s.set('showDebugOverlay', v)}
          />
        </section>

        <div className="border-t border-line pt-3">
          <Button size="sm" variant="ghost" onClick={s.reset}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </Panel>
  );
}
