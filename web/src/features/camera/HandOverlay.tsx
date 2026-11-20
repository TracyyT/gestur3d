import { useEffect, useRef, type RefObject } from 'react';
import { HAND_BONES, type HandFrame } from '@/core/vision/types';
import { palette } from '@/ui/theme';

interface Props {
  latest: RefObject<HandFrame | null>;
  className?: string;
}

const STALE_MS = 300;

/**
 * Draws hand skeletons from the latest HandFrame on a canvas sized to its box.
 * Lives inside the same mirrored container as the <video>, so landmarks in
 * raw-frame coordinates line up with the mirrored preview automatically.
 */
export function HandOverlay({ latest, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const frame = latest.current;
      if (!frame || performance.now() - frame.timestamp > STALE_MS) return;

      for (const hand of frame.hands) {
        const color = hand.handedness === 'Right' ? palette.cyan : palette.violet;
        const p = hand.image;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (const [a, b] of HAND_BONES) {
          ctx.moveTo(p[a * 3]! * w, p[a * 3 + 1]! * h);
          ctx.lineTo(p[b * 3]! * w, p[b * 3 + 1]! * h);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.ink1;
        for (let i = 0; i < 21; i++) {
          const tip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
          ctx.beginPath();
          ctx.arc(p[i * 3]! * w, p[i * 3 + 1]! * h, tip ? 3.2 : 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [latest]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
