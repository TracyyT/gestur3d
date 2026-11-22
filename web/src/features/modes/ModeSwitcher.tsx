import { Link } from 'react-router';
import { cn } from '@/ui/cn';
import { MODES, type ModeId } from './modes';

/** Header tabs between the modes. The camera stays on when switching. */
export function ModeSwitcher({ current }: { current: ModeId }) {
  return (
    <nav aria-label="Modes" className="glass pointer-events-auto flex rounded-full p-1">
      {MODES.map((m) => {
        const on = m.id === current;
        return (
          <Link
            key={m.id}
            to={m.path}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1 text-[13px] transition-colors',
              on ? 'bg-white/[0.08] font-medium text-ink-1' : 'text-ink-3 hover:text-ink-1',
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
