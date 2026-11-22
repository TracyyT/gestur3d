import { SessionLog } from '@/core/session/sessionLog';
import { onMenuAction, useMenu } from '@/features/menu/menuStore';
import { onSceneChange } from '@/stores/scene';

/** This tab's session log. Kept in memory; exported on request. */
export const sessionLog = new SessionLog();

/**
 * Records scene changes, undos and menu use into the session log while a
 * mode is open. Returns a cleanup that stops recording.
 */
export function recordSession(mode: string): () => void {
  sessionLog.add({ type: 'mark', name: 'mode-enter', detail: mode });
  let chosen: { action: string; choice?: string } | null = null;

  const offScene = onSceneChange((c) => {
    if (c.kind === 'undo') sessionLog.add({ type: 'undo', source: c.source });
    else sessionLog.command(c.cmd, c.source);
  });
  const offAction = onMenuAction((action, choice) => {
    chosen = { action, ...(choice ? { choice } : {}) };
  });
  const offMenu = useMenu.subscribe((s, prev) => {
    if (s.open && !prev.open) {
      chosen = null;
      sessionLog.add({ type: 'menuOpen', by: s.openedBy ?? 'unknown' });
    } else if (!s.open && prev.open) {
      sessionLog.add({ type: 'menuClose', ...(chosen ?? {}) });
      chosen = null;
    }
  });

  return () => {
    offScene();
    offAction();
    offMenu();
    sessionLog.add({ type: 'mark', name: 'mode-leave', detail: mode });
  };
}

/** Save the log as a file. */
export function downloadSession(format: 'json' | 'csv') {
  const body =
    format === 'json' ? JSON.stringify(sessionLog.toJSON(), null, 2) : sessionLog.toCSV();
  const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestur3d-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
