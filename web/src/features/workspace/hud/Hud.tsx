import { AnimatePresence, motion } from 'motion/react';
import { useDraw } from '@/features/drawing/drawStore';
import { useHudLayout } from '@/stores/hudLayout';
import { IconButton } from '@/ui';
import { CameraPreview } from './CameraPreview';
import { ObjectsPanel } from './ObjectsPanel';
import { SettingsPanel } from './SettingsPanel';
import { HandStatus } from './HandStatus';
import { StatusCluster } from './StatusCluster';
import { TrackingPanel } from './TrackingPanel';

export interface HudOptions {
  /** The Objects panel (add, remove, undo). Default on. */
  objects?: boolean;
  /** The Draw button in the top bar. Default on. */
  drawButton?: boolean;
}

/** Mode overlay: status readouts, side panels and the camera preview. */
export function Hud({ objects = true, drawButton = true }: HudOptions = {}) {
  const { panelsVisible, setPanelsVisible } = useHudLayout();
  const drawing = useDraw((s) => s.active);
  const toggleDraw = useDraw((s) => s.toggle);

  return (
    <>
      <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="pointer-events-auto hidden lg:block">
          <HandStatus />
        </div>
        <div className="pointer-events-auto">
          <StatusCluster />
        </div>
        {drawButton && (
          <IconButton
            label="Draw"
            title="Draw (D)"
            active={drawing}
            onClick={toggleDraw}
            className="glass pointer-events-auto size-9 rounded-full"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4">
              <path
                d="M3 13c2-1 3-4 5-6s4-3 5-2-1 3-3 5-5 3-7 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        )}
        <IconButton
          label={panelsVisible ? 'Hide panels' : 'Show panels'}
          active={panelsVisible}
          onClick={() => setPanelsVisible(!panelsVisible)}
          className="glass pointer-events-auto size-9 rounded-full"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4">
            <rect
              x="2"
              y="3"
              width="12"
              height="10"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path d="M10 3v10" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </IconButton>
      </div>

      <AnimatePresence>
        {panelsVisible && (
          <motion.aside
            aria-label="Workspace panels"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[68px] right-4 bottom-20 z-20 flex w-[296px] flex-col gap-3 overflow-y-auto pb-2"
          >
            {objects && <ObjectsPanel />}
            <TrackingPanel />
            <SettingsPanel />
          </motion.aside>
        )}
      </AnimatePresence>

      <CameraPreview />
    </>
  );
}
