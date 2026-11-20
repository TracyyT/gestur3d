import { lazy, Suspense, useCallback, useState } from 'react';
import { Link } from 'react-router';
import { objectLabel } from '@/core/interaction/sceneModel';
import { supportsWebGL2 } from '@/lib/webgl';
import { useScene } from '@/stores/scene';
import { GlassPanel, Kbd, Logo } from '@/ui';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useWorkspaceKeyboard } from './useWorkspaceKeyboard';

const WorkspaceCanvas = lazy(() => import('@/scene/WorkspaceCanvas'));

/** Announces selection changes to screen readers. */
function SelectionAnnouncer() {
  const label = useScene((s) => {
    if (!s.selectedId) return 'No object selected.';
    return `${objectLabel(s, s.selectedId)} selected. Arrow keys move it, Q and E rotate, plus and minus scale.`;
  });
  return (
    <p className="sr-only" aria-live="polite">
      {label}
    </p>
  );
}

function NoWebGL() {
  return (
    <div className="grid h-full place-items-center p-6">
      <GlassPanel className="max-w-md p-8 text-center">
        <h1 className="text-[18px] font-semibold">3D isn’t available</h1>
        <p className="mt-2 text-[14px] text-ink-2">
          This browser couldn’t start WebGL 2. Try the latest Chrome, Edge or Arc, and check that
          hardware acceleration is turned on.
        </p>
      </GlassPanel>
    </div>
  );
}

export function WorkspacePage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [webgl] = useState(supportsWebGL2);
  const toggleHelp = useCallback(() => setHelpOpen((o) => !o), []);
  const onKeyDown = useWorkspaceKeyboard(toggleHelp);

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <div
        // The scene region is focusable so keyboard users can drive it.
        tabIndex={0}
        role="application"
        aria-roledescription="3D workspace"
        aria-label="3D workspace. Press Tab to select objects, question mark for controls."
        onKeyDown={onKeyDown}
        className="absolute inset-0 outline-none focus-visible:shadow-[inset_0_0_0_1px_rgb(94_231_255/0.35)]"
      >
        {webgl ? (
          <Suspense fallback={null}>
            <WorkspaceCanvas />
          </Suspense>
        ) : (
          <NoWebGL />
        )}
      </div>

      <SelectionAnnouncer />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Link
          to="/"
          className="glass pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-4 pl-2 text-[13px] font-medium"
        >
          <Logo className="size-5" />
          Gestur3D
        </Link>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
        <p className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full px-4 py-2 text-[12px] text-ink-2">
          <span>Drag to move</span>
          <span className="text-ink-4">·</span>
          <span>⇧ drag to rotate</span>
          <span className="text-ink-4">·</span>
          <span>Scroll to scale</span>
          <span className="text-ink-4">·</span>
          <button
            type="button"
            onClick={toggleHelp}
            className="inline-flex items-center gap-1.5 hover:text-ink-1"
          >
            <Kbd>?</Kbd> controls
          </button>
        </p>
      </div>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
