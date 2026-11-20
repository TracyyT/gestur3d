import { useEffect, useRef } from 'react';
import type { HandPointer } from '@/core/interaction/handInteraction';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScene } from '@/stores/scene';
import { palette } from '@/ui/theme';
import { handRuntime } from './handRuntime';

const RIPPLE_MS = 450;
const FADE_IN_MS = 220;
const LOST_FADE_MS = 300;

interface Ghost {
  x: number;
  y: number;
  handedness: HandPointer['handedness'];
  since: number;
}

const colorFor = (p: { handedness: HandPointer['handedness'] }) =>
  p.handedness === 'Right' ? palette.cyan : palette.violet;

/**
 * Screen-space hand cursors, one per hand (cyan = right, violet = left).
 *
 * tracking  thin ring with a center dot
 * hovering  larger ring with reticle ticks; an arc fills as the pinch closes
 * pinching  (nothing grabbed) dashed ring that tightens with the pinch
 * grabbing  solid core + ring, and a tether to the held object's center
 * released  short expanding ripple
 * lost      dashed ghost that fades over the grace period
 */
export function HandCursorOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const firstSeen = new Map<number, number>();
    const ghosts = new Map<number, Ghost>();

    const ring = (
      x: number,
      y: number,
      r: number,
      width: number,
      color: string,
      alpha: number,
      dash?: number[],
    ) => {
      // Dark underlay so the cursor stays readable over bright, glowing objects.
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = palette.void;
      ctx.lineWidth = width + 3;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const live = new Set<number>();
      for (const p of handRuntime.pointers) {
        live.add(p.id);
        if (!firstSeen.has(p.id)) firstSeen.set(p.id, now);
        const appear = reduced ? 1 : Math.min(1, (now - firstSeen.get(p.id)!) / FADE_IN_MS);
        const color = colorFor(p);
        const { x, y } = p.screen;

        if (p.phase === 'lost') {
          if (!ghosts.has(p.id)) ghosts.set(p.id, { x, y, handedness: p.handedness, since: now });
          continue;
        }
        ghosts.delete(p.id);

        ctx.save();
        ctx.shadowColor = color;

        if (p.phase === 'grabbing') {
          const obj = useScene.getState().objects.find((o) => o.id === p.grabbedId);
          const anchor = obj && handRuntime.project?.(obj.position);
          if (anchor) {
            const grad = ctx.createLinearGradient(x, y, anchor.x, anchor.y);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
            ctx.globalAlpha = 0.5 * appear;
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(anchor.x, anchor.y);
            ctx.stroke();
          }
          ctx.globalAlpha = appear;
          ctx.shadowBlur = 16;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ring(x, y, 14, 2.5, color, appear);
          continue;
        }

        if (p.phase === 'pinching') {
          ctx.restore();
          ring(x, y, 16 - 7 * p.pinchStrength, 1.5, color, 0.7 * appear, [3, 4]);
          continue;
        }

        const hovering = p.phase === 'hovering';
        const r = hovering ? 22 : 16;
        ctx.shadowBlur = hovering ? 14 : 6;
        ctx.restore();
        ring(x, y, r, hovering ? 2.5 : 2, color, (hovering ? 1 : 0.85) * appear);

        // Center dot.
        ctx.save();
        ctx.globalAlpha = appear;
        ctx.fillStyle = palette.ink1;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (hovering) {
          // Reticle ticks.
          ctx.save();
          ctx.globalAlpha = appear;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            ctx.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
            ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
          }
          ctx.stroke();
          // Pinch progress arc: how close the fingers are to grabbing.
          if (p.pinchStrength > 0.05) {
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(
              x,
              y,
              r,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.pinchStrength),
            );
            ctx.stroke();
          }
          ctx.restore();
        }

        if (!reduced && p.releasedAt !== null && now - p.releasedAt < RIPPLE_MS) {
          const t = (now - p.releasedAt) / RIPPLE_MS;
          ring(x, y, 12 + 26 * t, 1.5, color, 0.7 * (1 - t));
        }
      }

      // Lost hands: fading dashed ghost where they were last seen.
      for (const [id, g] of ghosts) {
        const t = (now - g.since) / LOST_FADE_MS;
        if (t >= 1 || !handRuntime.pointers.some((p) => p.id === id)) {
          if (t >= 1) ghosts.delete(id);
          continue;
        }
        ring(g.x, g.y, 14, 1.5, colorFor(g), 0.6 * (1 - t), [2, 4]);
      }
      for (const id of firstSeen.keys()) if (!live.has(id)) firstSeen.delete(id);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 size-full"
    />
  );
}
