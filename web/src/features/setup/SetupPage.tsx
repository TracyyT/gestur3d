import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCameraSession } from '@/features/camera/cameraSession';
import { HandOverlay } from '@/features/camera/HandOverlay';
import { useFrameLuminance } from '@/features/camera/useFrameLuminance';
import { useHandTracking } from '@/features/camera/useHandTracking';
import { Button, GlassPanel, Logo, Select, StatusPill, buttonClasses } from '@/ui';
import { CalibrationChecklist } from './CalibrationChecklist';
import { CameraErrorView } from './CameraErrorView';
import { PermissionIntro } from './PermissionIntro';
import { buildChecks } from './checks';
import { ThumbsUpHint, ThumbsUpPreviewBadge } from './ThumbsUpHint';
import { useThumbsUpHold } from './useThumbsUpHold';

/** Decorative corner brackets that frame the live preview like a HUD viewport. */
function FrameCorners() {
  const corner = 'absolute size-5 border-holo-cyan/50';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-3">
      <span className={`${corner} top-0 left-0 rounded-tl-lg border-t border-l`} />
      <span className={`${corner} top-0 right-0 rounded-tr-lg border-t border-r`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-lg border-b border-l`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-lg border-r border-b`} />
    </div>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const { status, stream, error, devices, deviceId, start, stop, switchDevice } =
    useCameraSession();
  const videoRef = useRef<HTMLVideoElement>(null);

  const live = status === 'on' && !!stream;
  const tracking = useHandTracking(videoRef, live);
  const luminance = useFrameLuminance(videoRef, live);
  const checks = useMemo(
    () => buildChecks(tracking.status, tracking.summary, luminance),
    [tracking.status, tracking.summary, luminance],
  );
  const allGood = checks.every((c) => c.state === 'pass');

  // Both hands are busy during calibration, so a held thumbs-up also enters.
  const getAspect = useCallback(() => {
    const v = videoRef.current;
    return v?.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
  }, []);
  const enterWorkspace = useCallback(() => navigate('/workspace'), [navigate]);
  const thumbsProgress = useThumbsUpHold(
    tracking.latest,
    getAspect,
    tracking.status === 'ready',
    enterWorkspace,
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.play().catch(() => {
      /* autoplay is allowed for muted inline video; ignore aborted plays on fast switches */
    });
    return () => {
      v.srcObject = null;
    };
  }, [stream]);

  const handCount = tracking.summary.hands.length;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgb(94_231_255/0.07),transparent_70%)]"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
          <Logo className="size-6" />
          Gestur3D
        </Link>
        <p className="text-[12px] tracking-[0.2em] text-ink-3 uppercase">Camera setup</p>
        <div className="w-32 text-right whitespace-nowrap">
          {live && (
            <Button size="sm" variant="ghost" onClick={stop}>
              Stop camera
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pb-12 md:px-10">
        {(status === 'off' || status === 'starting') && (
          <PermissionIntro onEnable={() => void start()} busy={status === 'starting'} />
        )}

        {status === 'error' && error && (
          <CameraErrorView kind={error.kind} detail={error.message} onRetry={() => void start()} />
        )}

        {live && (
          <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section aria-label="Camera preview" className="space-y-3">
              <div className="glass relative aspect-video overflow-hidden rounded-(--radius-panel)">
                {/* Mirror the display only: detection always sees the raw frame. */}
                <div className="absolute inset-0 -scale-x-100">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="size-full object-cover"
                    aria-label="Live camera preview, mirrored"
                  />
                  <HandOverlay latest={tracking.latest} className="absolute inset-0 size-full" />
                </div>
                <FrameCorners />
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  {tracking.status === 'loading' && (
                    <StatusPill tone="idle" pulse>
                      Loading hand tracking…
                    </StatusPill>
                  )}
                  {tracking.status === 'ready' && (
                    <StatusPill tone={handCount ? 'good' : 'active'} pulse={handCount > 0}>
                      {handCount === 0
                        ? 'No hands in view'
                        : handCount === 1
                          ? `${tracking.summary.hands[0]!.handedness} hand`
                          : 'Both hands'}
                    </StatusPill>
                  )}
                  {tracking.status === 'error' && (
                    <StatusPill tone="bad">Tracking unavailable</StatusPill>
                  )}
                </div>
                {tracking.status === 'ready' && (
                  <div className="tabular absolute right-4 bottom-4 rounded-md bg-void/60 px-2 py-1 font-mono text-[11px] text-ink-2 backdrop-blur">
                    {tracking.summary.detectionFps.toFixed(0)} fps ·{' '}
                    {tracking.summary.detectionMs.toFixed(1)} ms · {tracking.delegate}
                  </div>
                )}
                <ThumbsUpPreviewBadge progress={thumbsProgress} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full max-w-xs">
                  <Select
                    label="Camera"
                    value={deviceId ?? ''}
                    onChange={(id) => void switchDevice(id)}
                    options={
                      devices.length
                        ? devices.map((d) => ({ value: d.deviceId, label: d.label }))
                        : [{ value: deviceId ?? '', label: 'Default camera' }]
                    }
                  />
                </div>
              </div>
            </section>

            <GlassPanel className="flex flex-col p-6">
              <h1 className="text-[18px] font-semibold tracking-tight">Calibrate</h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                Sit about an arm’s length from the screen and raise both hands. When the checks are
                green, give a thumbs-up.
              </p>
              <div className="mt-6">
                <CalibrationChecklist items={checks} />
              </div>

              {tracking.status === 'error' && (
                <div className="mt-6 rounded-xl border border-signal-warn/25 bg-signal-warn/[0.06] p-3 text-[12.5px] leading-relaxed text-ink-2">
                  Hand tracking couldn’t load, so the model files may be missing. You can still use
                  the workspace with mouse and keyboard.
                </div>
              )}

              <ul className="mt-6 space-y-1.5 border-t border-line pt-5 text-[12.5px] text-ink-3">
                <li>A plain background behind your hands helps.</li>
                <li>Keep your palms open and facing the camera to start.</li>
              </ul>

              <div className="mt-auto flex flex-col gap-3 pt-8">
                {tracking.status === 'ready' && <ThumbsUpHint progress={thumbsProgress} />}
                <Button
                  variant={allGood ? 'primary' : 'secondary'}
                  size="lg"
                  onClick={enterWorkspace}
                >
                  {allGood ? 'Enter workspace' : 'Enter anyway'}
                </Button>
                <Link
                  to="/workspace"
                  onClick={stop}
                  className={buttonClasses('ghost', 'sm', 'self-center')}
                >
                  Continue without camera
                </Link>
              </div>
            </GlassPanel>
          </div>
        )}
      </main>
    </div>
  );
}
