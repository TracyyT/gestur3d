import { AnimatePresence, motion } from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';
import type { HoloColor, ObjectKind } from '@/core/interaction/commands';
import {
  MENU_ACTIONS,
  MENU_GEOMETRY as G,
  outerAngle,
  outerStep,
  sectorAngle,
  type MenuAction,
} from '@/core/interaction/radialMenu';
import { KIND_LABEL } from '@/core/interaction/sceneModel';
import { KindIcon } from '@/features/workspace/hud/ObjectsPanel';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScene } from '@/stores/scene';
import { palette } from '@/ui/theme';
import { actionEnabled, outerItems, useMenu } from './menuStore';

const LABEL: Record<MenuAction, string> = {
  add: 'Add',
  draw: 'Draw',
  color: 'Color',
  undo: 'Undo',
  delete: 'Delete',
  clear: 'Clear',
};

const COLOR_LABEL: Record<HoloColor, string> = { cyan: 'Cyan', violet: 'Violet', white: 'White' };
const SWATCH: Record<HoloColor, string> = {
  cyan: palette.cyan,
  violet: palette.violet,
  white: palette.ink1,
};

const SIZE = 2 * G.outerOuter + 8;
const C = SIZE / 2;

/** Point at radius r, angle a (0 = up, clockwise). */
const pt = (r: number, a: number) => [C + Math.sin(a) * r, C - Math.cos(a) * r] as const;

/** Annular wedge from a0 to a1 between radii r0 and r1. */
function wedge(r0: number, r1: number, a0: number, a1: number, gap = 0.02) {
  const s = a0 + gap;
  const e = a1 - gap;
  const large = e - s > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, s);
  const [x1, y1] = pt(r1, e);
  const [x2, y2] = pt(r0, e);
  const [x3, y3] = pt(r0, s);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

function ActionIcon({ action }: { action: MenuAction }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
  } as const;
  const paths: Record<MenuAction, ReactNode> = {
    add: <path d="M8 3v10M3 8h10" {...p} />,
    draw: <path d="M3 13l2-.5 7-7-1.5-1.5-7 7zM10 4l1.5 1.5" {...p} />,
    color: (
      <>
        <circle cx="8" cy="8" r="5" {...p} />
        <path d="M8 3a5 5 0 010 10z" fill="currentColor" />
      </>
    ),
    undo: <path d="M5 6H10a3 3 0 010 6H7M5 6l2.5-2.5M5 6l2.5 2.5" {...p} />,
    delete: <path d="M4 5h8M6.5 5V3.5h3V5M5 5l.6 7.5h4.8L11 5" {...p} />,
    clear: <path d="M3 13h10M5 10l5-6 2.5 2.5-5 6" {...p} />,
  };
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      {paths[action]}
    </svg>
  );
}

/**
 * The radial menu: six actions on an inner ring, with an outer ring of
 * choices for Add (object kinds) and Color. Driven by `useMenu`; the same
 * state serves the keyboard (M, arrows, Enter, Esc), the mouse, and hands.
 */
export function RadialMenu() {
  const { open, x, y, expanded, highlight, point, choose, close } = useMenu();
  // Subscribed so enabled states refresh when the selection or history changes.
  useScene((s) => `${s.selectedId}|${s.undoStack.length}`);
  const reduced = useReducedMotion();

  const outer = expanded !== null ? outerItems(MENU_ACTIONS[expanded]!) : null;
  const n = MENU_ACTIONS.length;
  const half = Math.PI / n;

  let center = 'Close';
  if (highlight.ring === 'inner') center = LABEL[MENU_ACTIONS[highlight.index]!];
  if (highlight.ring === 'outer' && outer && expanded !== null) {
    const item = outer[highlight.index]!;
    center =
      MENU_ACTIONS[expanded] === 'add'
        ? KIND_LABEL[item as ObjectKind]
        : COLOR_LABEL[item as HoloColor];
  }

  const onPointer = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    point(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="radial-menu"
          role="menu"
          aria-label="Radial menu"
          className="pointer-events-none absolute z-[9]"
          style={{ left: x - C, top: y - C, width: SIZE, height: SIZE }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg
            width={SIZE}
            height={SIZE}
            className="pointer-events-auto"
            onPointerMove={onPointer}
            onClick={(e) => {
              onPointer(e);
              choose();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              close();
            }}
          >
            {MENU_ACTIONS.map((action, i) => {
              const a = sectorAngle(i);
              const on = highlight.ring === 'inner' && highlight.index === i;
              const enabled = actionEnabled(action);
              const [lx, ly] = pt((G.deadZone + G.innerOuter) / 2, a);
              return (
                <g key={action} role="menuitem" aria-label={LABEL[action]} aria-disabled={!enabled}>
                  <path
                    d={wedge(G.deadZone + 4, G.innerOuter, a - half, a + half)}
                    fill={on && enabled ? 'rgb(94 231 255 / 0.16)' : 'rgb(12 15 24 / 0.9)'}
                    stroke={on && enabled ? palette.cyan : 'rgb(255 255 255 / 0.1)'}
                    strokeWidth={on ? 1.5 : 1}
                  />
                  <foreignObject x={lx - 30} y={ly - 22} width={60} height={44}>
                    <div
                      className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] ${
                        enabled ? (on ? 'text-ink-1' : 'text-ink-2') : 'text-ink-4'
                      }`}
                    >
                      <ActionIcon action={action} />
                      {LABEL[action]}
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {outer &&
              expanded !== null &&
              outer.map((item, j) => {
                const a = outerAngle(expanded, j, outer.length);
                const w = outerStep(outer.length) / 2;
                const on = highlight.ring === 'outer' && highlight.index === j;
                const isAdd = MENU_ACTIONS[expanded] === 'add';
                const [lx, ly] = pt((G.innerOuter + G.outerOuter) / 2 + 2, a);
                const label = isAdd
                  ? KIND_LABEL[item as ObjectKind]
                  : COLOR_LABEL[item as HoloColor];
                return (
                  <g key={item} role="menuitem" aria-label={label}>
                    <path
                      d={wedge(G.innerOuter + 6, G.outerOuter, a - w, a + w, 0.015)}
                      fill={on ? 'rgb(155 123 255 / 0.2)' : 'rgb(12 15 24 / 0.9)'}
                      stroke={on ? palette.violet : 'rgb(255 255 255 / 0.1)'}
                      strokeWidth={on ? 1.5 : 1}
                    />
                    <foreignObject x={lx - 32} y={ly - 20} width={64} height={40}>
                      <div
                        className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] ${
                          on ? 'text-ink-1' : 'text-ink-2'
                        }`}
                      >
                        {isAdd ? (
                          <KindIcon kind={item as ObjectKind} />
                        ) : (
                          <span
                            className="size-3.5 rounded-full border border-line-strong"
                            style={{ background: SWATCH[item as HoloColor] }}
                          />
                        )}
                        {label}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

            <circle
              cx={C}
              cy={C}
              r={G.deadZone}
              fill="rgb(5 6 10 / 0.8)"
              stroke="rgb(255 255 255 / 0.12)"
            />
            <text
              x={C}
              y={C + 4}
              textAnchor="middle"
              className="fill-ink-1 font-sans text-[12px] font-medium"
            >
              {center}
            </text>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
