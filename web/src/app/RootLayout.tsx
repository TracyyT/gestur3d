import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useCameraSession } from '@/features/camera/cameraSession';
import { useReducedMotionAttribute } from '@/hooks/useReducedMotion';
import { isCameraRoute } from '@/features/modes/modes';

/** The camera may run on setup and in the modes. Anywhere else, it switches off. */
function useCameraRouteGuard() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isCameraRoute(pathname)) useCameraSession.getState().stop();
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
