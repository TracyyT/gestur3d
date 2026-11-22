import { useEffect, useMemo, useState } from 'react';
import { frameAt, loopTime, motionBounds } from '@/core/demo/demoPlayback';
import type { Recording } from '@/core/vision/recording';
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

/**
 * A demo hand: a glowing skeleton that replays a landmark recording, zoomed
 * to the motion and mirrored like the camera preview. Lessons use it to show
 * each gesture. Restart it by changing its React key.
 */
export function GhostHand({ recording, label, playing, className }: Props) {
  const reduced = useReducedMotion();
  const play = playing ?? !reduced;
  const [t, setT] = useState(() => (play ? 0 : (recording.frames.at(-1)?.t ?? 0)));

  useEffect(() => {
    if (!play) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      setT(loopTime(performance.now() - start, recording));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, recording]);

  const a = recording.cameraAspect;
  const box = useMemo(() => motionBounds(recording), [recording]);
  const frame = frameAt(recording, play ? t : (recording.frames.at(-1)?.t ?? 0));
  if (!box || !frame) return null;

  // Mirrored, aspect-corrected space: X = (1 − x) · aspect, Y = y.
  const X = (x: number) => (1 - x) * a;
  const viewBox = `${X(box.x + box.width)} ${box.y} ${box.width * a} ${box.height}`;
  const r = box.height * 0.014;

  return (
    <svg viewBox={viewBox} role="img" aria-label={label} className={className}>
      {frame.hands.map((h, k) => {
        const color = h.handedness === 'Right' ? palette.cyan : palette.violet;
        const p = (i: number) => [X(h.image[i * 3]!), h.image[i * 3 + 1]!] as const;
        return (
          <g key={k}>
            <g
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
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
