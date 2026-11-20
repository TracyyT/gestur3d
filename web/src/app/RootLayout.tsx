import { MotionConfig } from 'motion/react';
import { Outlet } from 'react-router';
import { useReducedMotionAttribute } from '@/hooks/useReducedMotion';

export function RootLayout() {
  const reduced = useReducedMotionAttribute();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="min-h-dvh bg-void text-ink-1">
        <Outlet />
      </div>
    </MotionConfig>
  );
}
