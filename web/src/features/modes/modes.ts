/**
 * The app's modes. All of them share the scene, the hand pipeline and the
 * interaction engine (ModeShell); each adds its own goals and panels.
 * Modes are listed here once their route exists.
 */
export type ModeId = 'practice' | 'playground' | 'workspace';

export interface ModeInfo {
  id: ModeId;
  label: string;
  path: `/${string}`;
}

export const MODES: readonly ModeInfo[] = [
  { id: 'practice', label: 'Practice', path: '/practice' },
  { id: 'workspace', label: 'Workspace', path: '/workspace' },
];

/** A mode path to return to after camera setup, if `next` names one. */
export function modeReturnPath(next: string | null): string {
  return MODES.find((m) => m.path === next)?.path ?? '/workspace';
}

/** Routes where the camera may stay on: setup and every mode. */
export function isCameraRoute(pathname: string): boolean {
  return pathname === '/setup' || MODES.some((m) => m.path === pathname);
}
