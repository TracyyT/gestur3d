import type { ObjectKind } from '@/core/interaction/commands';
import { KIND_LABEL, MAX_OBJECTS, objectLabel } from '@/core/interaction/sceneModel';
import { useScene } from '@/stores/scene';
import { Button, Panel, cn } from '@/ui';

const KINDS: ObjectKind[] = ['sphere', 'cube', 'sculpture'];

function KindIcon({ kind }: { kind: ObjectKind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 } as const;
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
      {kind === 'sphere' && (
        <>
          <circle cx="8" cy="8" r="5.5" {...common} />
          <ellipse cx="8" cy="8" rx="5.5" ry="2" {...common} opacity=".5" />
        </>
      )}
      {kind === 'cube' && (
        <path d="M8 2.5l5 2.8v5.4L8 13.5l-5-2.8V5.3zM8 8l5-2.7M8 8v5.5M8 8L3 5.3" {...common} />
      )}
      {kind === 'sculpture' && (
        <path d="M4 8c0-5 8-5 8 0s-8 5-8 0zm2 0c0 2.5 4 2.5 4 0S6 5.5 6 8z" {...common} />
      )}
    </svg>
  );
}

export function ObjectsPanel() {
  const objects = useScene((s) => s.objects);
  const selectedId = useScene((s) => s.selectedId);
  const dispatch = useScene((s) => s.dispatch);
  const full = objects.length >= MAX_OBJECTS;

  return (
    <Panel title="Objects" defaultOpen className="shrink-0">
      <div className="space-y-4">
        <ul
          className="-mx-1 max-h-48 space-y-0.5 overflow-y-auto"
          aria-label="Objects in the scene"
        >
          {objects.map((o) => {
            const selected = o.id === selectedId;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => dispatch({ type: 'select', id: selected ? null : o.id }, 'ui')}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                    selected
                      ? 'bg-holo-cyan/10 text-ink-1'
                      : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink-1',
                  )}
                >
                  <span className={selected ? 'text-holo-cyan' : 'text-ink-3'}>
                    <KindIcon kind={o.kind} />
                  </span>
                  <span className="flex-1">
                    {objectLabel({ objects, selectedId, nextId: 0 }, o.id)}
                  </span>
                  <span className="tabular font-mono text-[11px] text-ink-3">
                    {o.scale.toFixed(2)}×
                  </span>
                </button>
              </li>
            );
          })}
          {!objects.length && (
            <li className="px-2 py-1.5 text-[12.5px] text-ink-3">The scene is empty.</li>
          )}
        </ul>

        <div>
          <p className="mb-2 text-[11px] tracking-[0.16em] text-ink-3 uppercase">Add</p>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <Button
                key={k}
                size="sm"
                disabled={full}
                onClick={() => dispatch({ type: 'add', kind: k }, 'ui')}
                className="rounded-lg"
                aria-label={`Add ${KIND_LABEL[k].toLowerCase()}`}
              >
                <KindIcon kind={k} />
                <span className="text-[12px]">{KIND_LABEL[k]}</span>
              </Button>
            ))}
          </div>
          {full && (
            <p className="mt-2 text-[11.5px] text-ink-3">Limit of {MAX_OBJECTS} objects reached.</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-line pt-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedId}
            onClick={() => selectedId && dispatch({ type: 'remove', id: selectedId }, 'ui')}
          >
            Remove selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'reset' }, 'ui')}>
            Reset scene
          </Button>
        </div>
      </div>
    </Panel>
  );
}
