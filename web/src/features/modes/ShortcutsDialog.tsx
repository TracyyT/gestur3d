import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '@/core/interaction/keyboard';
import { GlassPanel, IconButton, Kbd } from '@/ui';

const MOUSE = [
  { input: 'Click', action: 'Select an object' },
  { input: 'Drag', action: 'Move it' },
  { input: '⇧ Drag', action: 'Rotate it' },
  { input: 'Scroll on it', action: 'Scale it' },
  { input: 'Drag empty space', action: 'Orbit the camera' },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-void/50 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === '?') {
              e.stopPropagation();
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <GlassPanel className="p-6">
              <div className="flex items-center justify-between">
                <h2 id="shortcuts-title" className="text-[16px] font-semibold tracking-tight">
                  Controls
                </h2>
                <IconButton ref={closeRef} label="Close" onClick={onClose}>
                  <svg aria-hidden viewBox="0 0 16 16" className="size-4">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </IconButton>
              </div>
              <div className="mt-4 grid gap-8 md:grid-cols-2">
                <section>
                  <h3 className="mb-3 text-[11px] tracking-[0.18em] text-ink-3 uppercase">
                    Keyboard
                  </h3>
                  <dl className="space-y-2.5">
                    {SHORTCUTS.map((s) => (
                      <div
                        key={s.action}
                        className="flex items-center justify-between gap-4 text-[13px]"
                      >
                        <dt className="text-ink-2">{s.action}</dt>
                        <dd className="flex shrink-0 gap-1">
                          {s.keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section>
                  <h3 className="mb-3 text-[11px] tracking-[0.18em] text-ink-3 uppercase">Mouse</h3>
                  <dl className="space-y-2.5">
                    {MOUSE.map((m) => (
                      <div
                        key={m.action}
                        className="flex items-center justify-between gap-4 text-[13px]"
                      >
                        <dt className="text-ink-2">{m.action}</dt>
                        <dd className="shrink-0 font-mono text-[12px] text-ink-1">{m.input}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-6 text-[12.5px] leading-relaxed text-ink-3">
                    Hand gestures arrive in the next milestone. Every gesture will also have a mouse
                    and keyboard equivalent.
                  </p>
                </section>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
