import { useEffect, useRef } from 'react';
import type { HandPointer } from '@/core/interaction/handInteraction';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScene } from '@/stores/scene';
import { palette } from '@/ui/theme';
import { handRuntime } from './handRuntime';

const RIPPLE_MS = 450;
const FADE_IN_MS = 220;
const LOST_FADE_MS = 300;
/** Matches the tracker's lost-hand grace period. */
const GRACE_MS = 300;
/** Turns smaller than this (radians) don't draw an arc. */
const MIN_ROLL = (2 * Math.PI) / 180;

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
 *
 * Two-hand grab: a glowing line between the hands with a dot at the pivot
 * (their midpoint) instead of the tethers, an arc showing the turn since the
 * grab started, and a chip with the scale and angle (amber at a scale limit). If one hand is lost, its half of
 * the line turns grey and dashed, and its ghost ring shrinks over the grace
 * period.
 */
export function HandCursorOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
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

    const lostSince = new Map<number, number>();
    const chip = chipRef.current;
    let chipText = '';

    /** Line between the two hands of each two-hand grab, with the pivot dot. */
    const drawTwoHandLinks = (now: number) => {
      for (const t of handRuntime.twoHand) {
        const a = handRuntime.pointers.find((p) => p.id === t.pointerIds[0]);
        const b = handRuntime.pointers.find((p) => p.id === t.pointerIds[1]);
        if (!a || !b) continue;
        const mx = (a.screen.x + b.screen.x) / 2;
        const my = (a.screen.y + b.screen.y) / 2;
        for (const p of [a, b]) {
          const lost = p.phase === 'lost';
          ctx.save();
          if (lost) {
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = palette.ink3;
            ctx.setLineDash([4, 5]);
            ctx.lineWidth = 1.25;
          } else {
            const color = colorFor(p);
            ctx.globalAlpha = t.mode === 'two' ? 0.85 : 0.6;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = reduced ? 0 : 10;
            ctx.lineWidth = 1.75;
          }
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(p.screen.x, p.screen.y);
          ctx.stroke();
          ctx.restore();

          // A lost hand's ring shrinks over the grace period.
          if (lost) {
            if (!lostSince.has(p.id)) lostSince.set(p.id, now);
            const k = Math.max(0, 1 - (now - lostSince.get(p.id)!) / GRACE_MS);
            if (k > 0) ring(p.screen.x, p.screen.y, 4 + 12 * k, 1.5, palette.ink2, 0.8, [2, 3]);
          }
        }
        // Pivot dot.
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = palette.ink1;
        ctx.shadowColor = palette.cyan;
        ctx.shadowBlur = reduced ? 0 : 12;
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ring(mx, my, 8, 1.25, palette.ink1, t.mode === 'two' ? 0.6 : 0.3);

        // Turn since the grab started: an arc from the starting line angle to
        // the current one (screen y points down, so CCW roll is a smaller angle).
        if (t.mode === 'two' && Math.abs(t.roll) > MIN_ROLL) {
          const lineAngle = Math.atan2(b.screen.y - a.screen.y, b.screen.x - a.screen.x);
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.strokeStyle = palette.ink1;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          // One arc on each side of the pivot, like the rim of a wheel.
          for (const side of [0, Math.PI]) {
            ctx.beginPath();
            ctx.arc(mx, my, 30, lineAngle + side + t.roll, lineAngle + side, t.roll > 0);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      updateChip();
    };

    /** Scale and angle readout for the first two-hand grab, above its pivot. */
    const updateChip = () => {
      if (!chip) return;
      const t = handRuntime.twoHand.find((x) => x.mode === 'two');
      const a = t && handRuntime.pointers.find((p) => p.id === t.pointerIds[0]);
      const b = t && handRuntime.pointers.find((p) => p.id === t.pointerIds[1]);
      if (!t || !a || !b) {
        if (chip.style.opacity !== '0') chip.style.opacity = '0';
        return;
      }
      const mx = (a.screen.x + b.screen.x) / 2;
      const my = (a.screen.y + b.screen.y) / 2;
      const deg = Math.round((Math.abs(t.roll) * 180) / Math.PI);
      const text = `${t.scale.toFixed(2)}× · ${deg}°`;
      if (text !== chipText) {
        chip.textContent = text;
        chipText = text;
      }
      chip.dataset.limit = String(t.atLimit);
      chip.style.opacity = '1';
      chip.style.transform = `translate(${mx}px, ${my - 46}px) translate(-50%, -50%)`;
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

      const twoHandIds = new Set(handRuntime.twoHand.flatMap((t) => t.pointerIds));
      drawTwoHandLinks(now);

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
        if (lostSince.has(p.id)) lostSince.delete(p.id);
        ghosts.delete(p.id);

        ctx.save();
        ctx.shadowColor = color;

        if (p.phase === 'grabbing') {
          const obj = useScene.getState().objects.find((o) => o.id === p.grabbedId);
          const anchor = !twoHandIds.has(p.id) && obj && handRuntime.project?.(obj.position);
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
        if (twoHandIds.has(id)) continue;
        ring(g.x, g.y, 14, 1.5, colorFor(g), 0.6 * (1 - t), [2, 4]);
      }
      for (const id of firstSeen.keys()) if (!live.has(id)) firstSeen.delete(id);
      for (const id of lostSince.keys()) if (!live.has(id)) lostSince.delete(id);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 size-full"
      />
      <div
        ref={chipRef}
        aria-hidden
        data-testid="two-hand-readout"
        style={{ opacity: 0 }}
        className="glass text-ink-1 data-[limit=true]:text-signal-warn data-[limit=true]:border-signal-warn/40 pointer-events-none absolute top-0 left-0 z-10 rounded-full px-2.5 py-1 font-mono text-xs tabular-nums transition-[opacity,color] duration-150"
      />
    </>
  );
}
