import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { GlassPanel } from './GlassPanel';
import { cn } from './cn';

export interface PanelProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Collapsible glass panel with an accessible disclosure header. */
export function Panel({
  title,
  icon,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  actions,
  className,
  children,
}: PanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const bodyId = useId();

  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <GlassPanel className={cn('overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex flex-1 items-center gap-2 rounded-md text-left text-[13px] font-medium text-ink-1"
        >
          {icon && <span className="text-ink-3">{icon}</span>}
          <span className="flex-1">{title}</span>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={cn('size-3.5 text-ink-3 transition-transform', open && 'rotate-180')}
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        {actions}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="border-t border-line px-3 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
