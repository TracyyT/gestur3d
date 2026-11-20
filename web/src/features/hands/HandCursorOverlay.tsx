import { useEffect, useRef } from 'react';
import { palette } from '@/ui/theme';
import { handRuntime } from './handRuntime';

/** Screen-space hand cursors, drawn every frame from handRuntime (no React state). */
export function HandCursorOverlay() {
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
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const p of handRuntime.pointers) {
        const color = p.handedness === 'Right' ? palette.cyan : palette.violet;
        ctx.globalAlpha = p.phase === 'lost' ? 0.35 : 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          p.screen.x,
          p.screen.y,
          p.phase === 'grabbing' ? 10 : 16 - 6 * p.pinchStrength,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 size-full"
    />
  );
}
