import { useEffect, useMemo, useRef } from 'react';
import { frameAt, loopTime, motionBounds } from '@/core/demo/demoPlayback';
import type { RecordedFrame, Recording } from '@/core/vision/recording';
import { HAND_BONES } from '@/core/vision/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { palette } from '@/ui/theme';

const TIPS = [4, 8, 12, 16, 20];

interface Props {
  /** A landmark recording (usually scripted) of the gesture to show. */
  recording: Recording;
  /** Screen-reader description of the gesture. */
  label: string;
  /** Loop the demo. With reduced motion it defaults to off and shows the end pose. */
  playing?: boolean;
  className?: string;
}

/** Most hands a demo shows at once. */
const MAX_HANDS = 2;

/**
 * A demo hand: a glowing skeleton that replays a landmark recording, zoomed
 * to the motion and mirrored like the camera preview. Lessons use it to show
 * each gesture. Restart it by changing its React key.
 *
 * Animation writes SVG attributes directly instead of re-rendering through
 * React: per-frame state updates would keep interrupting route transitions
 * (and other low-priority renders) on slower machines.
 */
export function GhostHand({ recording, label, playing, className }: Props) {
  const reduced = useReducedMotion();
  const play = playing ?? !reduced;
  const box = useMemo(() => motionBounds(recording), [recording]);
  const svgRef = useRef<SVGSVGElement>(null);
  const a = recording.cameraAspect;
  const endPose = frameAt(recording, recording.frames.at(-1)?.t ?? 0);
  const first = play ? frameAt(recording, 0) : endPose;

  useEffect(() => {
    const svg = svgRef.current;
    if (!play || !svg) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      draw(svg, frameAt(recording, loopTime(performance.now() - start, recording)), a);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, recording, a]);

  if (!box || !first) return null;

  // Mirrored, aspect-corrected space: X = (1 − x) · aspect, Y = y.
  const viewBox = `${(1 - box.x - box.width) * a} ${box.y} ${box.width * a} ${box.height}`;
  const r = box.height * 0.014;

  return (
    <svg ref={svgRef} viewBox={viewBox} role="img" aria-label={label} className={className}>
      {Array.from({ length: MAX_HANDS }, (_, k) => {
        const h = first.hands[k];
        const color = h?.handedness === 'Left' ? palette.violet : palette.cyan;
        const p = (i: number) => (h ? point(h.image, i, a) : ([0, 0] as const));
        return (
          <g key={k} data-hand={k} visibility={h ? 'visible' : 'hidden'}>
            <g
              data-bones
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            >
              {HAND_BONES.map(([i, j]) => {
                const [x1, y1] = p(i);
                const [x2, y2] = p(j);
                return (
                  <line
                    key={`${i}-${j}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {TIPS.map((i) => {
              const [cx, cy] = p(i);
              return <circle key={i} cx={cx} cy={cy} r={r} fill={palette.ink1} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function point(image: ArrayLike<number>, i: number, aspect: number) {
  return [(1 - image[i * 3]!) * aspect, image[i * 3 + 1]!] as const;
}

/** Move the skeleton's elements to a frame's landmarks. */
function draw(svg: SVGSVGElement, frame: RecordedFrame | null, aspect: number) {
  if (!frame) return;
  for (let k = 0; k < MAX_HANDS; k++) {
    const g = svg.querySelector<SVGGElement>(`[data-hand="${k}"]`);
    if (!g) continue;
    const h = frame.hands[k];
    g.setAttribute('visibility', h ? 'visible' : 'hidden');
    if (!h) continue;
    const color = h.handedness === 'Left' ? palette.violet : palette.cyan;
    const bones = g.querySelector<SVGGElement>('[data-bones]')!;
    bones.setAttribute('stroke', color);
    bones.style.filter = `drop-shadow(0 0 4px ${color})`;
    const lines = bones.querySelectorAll('line');
    HAND_BONES.forEach(([i, j], n) => {
      const [x1, y1] = point(h.image, i, aspect);
      const [x2, y2] = point(h.image, j, aspect);
      const l = lines[n]!;
      l.setAttribute('x1', String(x1));
      l.setAttribute('y1', String(y1));
      l.setAttribute('x2', String(x2));
      l.setAttribute('y2', String(y2));
    });
    const dots = g.querySelectorAll('circle');
    TIPS.forEach((i, n) => {
      const [cx, cy] = point(h.image, i, aspect);
      dots[n]!.setAttribute('cx', String(cx));
      dots[n]!.setAttribute('cy', String(cy));
    });
  }
}
