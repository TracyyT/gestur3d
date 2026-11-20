import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useCameraSession } from '@/features/camera/cameraSession';
import { useReducedMotionAttribute } from '@/hooks/useReducedMotion';

/** Routes allowed to keep the camera running. Anywhere else, it switches off. */
const CAMERA_ROUTES = ['/setup', '/workspace'];

function useCameraRouteGuard() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!CAMERA_ROUTES.includes(pathname)) useCameraSession.getState().stop();
  }, [pathname]);

  useEffect(() => {
    const stop = () => useCameraSession.getState().stop();
    window.addEventListener('pagehide', stop);
    return () => window.removeEventListener('pagehide', stop);
  }, []);
}

export function RootLayout() {
  const reduced = useReducedMotionAttribute();
  useCameraRouteGuard();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="min-h-dvh bg-void text-ink-1">
        <Outlet />
      </div>
    </MotionConfig>
  );
}
