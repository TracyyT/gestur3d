import { useSampled } from '@/hooks/useSampled';
import { Button } from '@/ui';
import { downloadSession, sessionLog } from './session';

const eventCount = () => sessionLog.events.length;

/** Settings section: what the session log holds, and export or clear it. */
export function SessionSection() {
  const count = useSampled(eventCount, 500);
  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label="Session log">
      <p className="text-[11px] tracking-[0.16em] text-ink-3 uppercase">Session log</p>
      <p className="text-[12px] text-ink-2">
        {count} {count === 1 ? 'event' : 'events'}. Actions and timings only, kept in this tab.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => downloadSession('csv')} disabled={!count}>
          Export CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={() => downloadSession('json')} disabled={!count}>
          Export JSON
        </Button>
        <Button size="sm" variant="ghost" onClick={() => sessionLog.clear()} disabled={!count}>
          Clear
        </Button>
      </div>
    </section>
  );
}
