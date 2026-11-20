import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { useCameraSession } from '@/features/camera/cameraSession';
import { PreviewDebugOverlay } from '@/features/hands/PreviewDebugOverlay';
import { useSettings } from '@/stores/settings';
import { clampToViewport, useHudLayout } from '@/stores/hudLayout';
import { GlassPanel, IconButton, buttonClasses } from '@/ui';

const WIDTH = 248;
const KEY_STEP = 24;
/** Keeps the preview below the top bar so it never covers the home link. */
const TOP_INSET = 64;

function defaultPos(height: number, viewportHeight: number) {
  return { x: 16, y: viewportHeight - height - 72 };
}

/**
 * Small floating, draggable webcam preview. Drag it by its header, or focus
 * the header and use the arrow keys. Position is remembered.
 */
export function CameraPreview() {
  const { status, stream, stop } = useCameraSession();
  const { previewPos, setPreviewPos, previewCollapsed, setPreviewCollapsed } = useHudLayout();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const on = status === 'on' && !!stream;
  const debug = useSettings((st) => st.showDebugOverlay);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || previewCollapsed) return;
    v.srcObject = stream;
    v.play().catch(() => {});
    return () => {
      v.srcObject = null;
    };
  }, [stream, previewCollapsed]);

  const [box, setBox] = useState({ w: WIDTH, h: 180 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pos = clampToViewport(
    previewPos ?? defaultPos(box.h, viewport.h),
    box,
    viewport,
    12,
    TOP_INSET,
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPreviewPos(
      clampToViewport({ x: e.clientX - d.dx, y: e.clientY - d.dy }, box, viewport, 12, TOP_INSET),
    );
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    setPreviewPos(
      clampToViewport({ x: pos.x + d[0], y: pos.y + d[1] }, box, viewport, 12, TOP_INSET),
    );
  };

  return (
    <div ref={boxRef} className="absolute z-20" style={{ left: pos.x, top: pos.y, width: WIDTH }}>
      <GlassPanel className="overflow-hidden">
        <div
          role="toolbar"
          tabIndex={0}
          aria-label="Camera preview. Drag, or use arrow keys, to move it."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="flex cursor-grab items-center gap-2 py-1.5 pr-1.5 pl-3 select-none active:cursor-grabbing"
        >
          <span
            aria-hidden
            className={
              on
                ? 'size-1.5 rounded-full bg-signal-bad shadow-[0_0_6px_var(--color-signal-bad)]'
                : 'size-1.5 rounded-full bg-ink-4'
            }
          />
          <span className="flex-1 text-[12px] text-ink-2">{on ? 'Camera on' : 'Camera off'}</span>
          {on && (
            <IconButton label="Turn camera off" className="size-7" onClick={stop}>
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
                <path
                  d="M2 2l12 12M6 4h4.5A1.5 1.5 0 0112 5.5V7l2.5-1.5v5L12 9M10 12H3.5A1.5 1.5 0 012 10.5v-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </IconButton>
          )}
          <IconButton
            label={previewCollapsed ? 'Show preview' : 'Hide preview'}
            className="size-7"
            onClick={() => setPreviewCollapsed(!previewCollapsed)}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
              <path
                d={previewCollapsed ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </IconButton>
        </div>
        {!previewCollapsed &&
          (on ? (
            <div className="relative aspect-video border-t border-line">
              <div className="absolute inset-0 -scale-x-100">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  aria-label="Your camera, mirrored"
                  className="size-full object-cover"
                />
                {debug && <PreviewDebugOverlay />}
              </div>
            </div>
          ) : (
            <div className="border-t border-line p-3 text-[12px] leading-relaxed text-ink-3">
              Hand control needs the camera.{' '}
              <Link
                to="/setup"
                className={buttonClasses('ghost', 'sm', 'mt-2 -ml-3 text-holo-cyan')}
              >
                Set up camera →
              </Link>
            </div>
          ))}
      </GlassPanel>
    </div>
  );
}
