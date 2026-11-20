import { useEffect, useSyncExternalStore } from 'react';
import { resolveReducedMotion, useSettings } from '@/stores/settings';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;
}

export function useOsPrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True when animation should be minimized (OS setting or in-app override). */
export function useReducedMotion() {
  const pref = useSettings((s) => s.reducedMotion);
  const os = useOsPrefersReducedMotion();
  return resolveReducedMotion(pref, os);
}

/** Mirrors the resolved value onto <html data-reduced-motion> for CSS. */
export function useReducedMotionAttribute() {
  const reduced = useReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  return reduced;
}
