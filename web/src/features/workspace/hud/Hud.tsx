import { AnimatePresence, motion } from 'motion/react';
import { useHudLayout } from '@/stores/hudLayout';
import { IconButton } from '@/ui';
import { CameraPreview } from './CameraPreview';
import { ObjectsPanel } from './ObjectsPanel';
import { SettingsPanel } from './SettingsPanel';
import { StatusCluster } from './StatusCluster';

/** Workspace overlay: status readouts, side panels and the camera preview. */
export function Hud() {
  const { panelsVisible, setPanelsVisible } = useHudLayout();

  return (
    <>
      <div className="pointer-events-none absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="pointer-events-auto">
          <StatusCluster />
        </div>
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
            <ObjectsPanel />
            <SettingsPanel />
          </motion.aside>
        )}
      </AnimatePresence>

      <CameraPreview />
    </>
  );
}
