import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-line-strong bg-white/[0.04] px-1 font-mono text-[11px] text-ink-2">
      {children}
    </kbd>
  );
}
