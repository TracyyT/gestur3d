import { useEffect } from 'react';
import { useCameraSession } from '@/features/camera/cameraSession';
import { createLiveHandSource } from '@/features/camera/createHandSource';
import { useSettings } from '@/stores/settings';
import { useHandTracking } from './handTrackingStore';

/**
 * Starts live hand detection in the workspace whenever the camera is on.
 * Uses its own hidden <video> so detection doesn't depend on the preview
 * being visible. A replay installed by test hooks takes precedence.
 */
export function useWorkspaceHandSource() {
  const stream = useCameraSession((s) => s.stream);
  const preference = useSettings((s) => s.trackingBackend);

  useEffect(() => {
    const store = useHandTracking.getState();
    if (store.backend === 'replay') return;
    if (!stream) {
      store.set({ status: 'off', source: null, backend: null, delegate: null, error: null });
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    let cancelled = false;
    let source: Awaited<ReturnType<typeof createLiveHandSource>> | null = null;
    store.set({ status: 'starting', error: null });

    (async () => {
      await video.play();
      if (!video.videoWidth) {
        await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
      }
      const created = await createLiveHandSource(video, preference);
      if (cancelled) {
        created.dispose();
        return;
      }
      source = created;
      created.start();
      useHandTracking.getState().set({
        status: 'running',
        source: created,
        backend: created.backend,
        delegate: created.delegate,
        cameraAspect: video.videoWidth / video.videoHeight || 16 / 9,
      });
    })().catch((err: unknown) => {
      if (cancelled) return;
      useHandTracking.getState().set({
        status: 'error',
        source: null,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return () => {
      cancelled = true;
      source?.dispose();
      video.pause();
      video.srcObject = null;
      if (useHandTracking.getState().backend !== 'replay') {
        useHandTracking
          .getState()
          .set({ status: 'off', source: null, backend: null, delegate: null });
      }
    };
  }, [stream, preference]);
}
