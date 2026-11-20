import { Link } from 'react-router';
import type { CameraErrorKind } from '@/core/vision/camera';
import { Button, GlassPanel, buttonClasses } from '@/ui';

const copy: Record<CameraErrorKind, { title: string; body: string; steps?: string[] }> = {
  denied: {
    title: 'Camera access is blocked',
    body: 'The browser was told not to share your camera with this site.',
    steps: [
      'Click the camera or lock icon in the address bar.',
      'Set Camera to “Allow” for this site.',
      'Come back here and press Try again.',
    ],
  },
  'not-found': {
    title: 'No camera found',
    body: 'Connect a webcam, or check that your built-in camera is enabled in system settings.',
  },
  'in-use': {
    title: 'Your camera is busy',
    body: 'Another app (a video call, Photo Booth, OBS) is probably using it. Close that app and try again.',
  },
  insecure: {
    title: 'This page isn’t secure',
    body: 'Browsers only allow camera access over HTTPS or on localhost.',
  },
  unsupported: {
    title: 'Camera not supported here',
    body: 'This browser doesn’t expose camera access. Try the latest Chrome, Edge or Arc.',
  },
  unknown: {
    title: 'Something went wrong with the camera',
    body: 'An unexpected error stopped the camera from starting.',
  },
};

export function CameraErrorView({
  kind,
  detail,
  onRetry,
}: {
  kind: CameraErrorKind;
  detail?: string;
  onRetry: () => void;
}) {
  const c = copy[kind];
  return (
    <GlassPanel role="alert" className="mx-auto w-full max-w-xl p-8 md:p-10">
      <div className="mb-5 inline-grid size-11 place-items-center rounded-2xl border border-signal-bad/30 bg-signal-bad/10 text-signal-bad">
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path
            d="M12 8v5m0 3.2v.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight">{c.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
      {c.steps && (
        <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-[14px] text-ink-2 marker:text-ink-3">
          {c.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {kind === 'unknown' && detail && (
        <p className="mt-4 font-mono text-[12px] break-words text-ink-3">{detail}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
        <Link to="/workspace" className={buttonClasses('ghost')}>
          Continue with mouse only
        </Link>
      </div>
    </GlassPanel>
  );
}
