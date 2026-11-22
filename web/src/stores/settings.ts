import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VisualQuality = 'auto' | 'low' | 'medium' | 'high';
export type ReducedMotionPreference = 'system' | 'on' | 'off';
export type TrackingBackendPreference = 'auto' | 'worker' | 'main-thread';

export interface SettingsState {
  /** 0..1. Higher = pinches register with fingers further apart. */
  gestureSensitivity: number;
  /** 0..1. Higher = steadier but slightly laggier tracking. */
  trackingSmoothing: number;
  /** 0.4..1. Fraction of the camera frame your hand moves within to cover the scene. */
  handReach: number;
  visualQuality: VisualQuality;
  /** 0..1 multiplier on particle counts. */
  particleDensity: number;
  reducedMotion: ReducedMotionPreference;
  /** Mouse and keyboard controls stay on alongside gestures. */
  mouseKeyboardEnabled: boolean;
  showDebugOverlay: boolean;
  preferredCameraId: string | null;
  /**
   * Where hand detection runs. Main thread by default: on the reference Mac it
   * measured faster than the worker (docs/benchmarks.md). Auto = worker, falling
   * back to the main thread.
   */
  trackingBackend: TrackingBackendPreference;
  /** An open palm held still opens the radial menu. */
  palmMenu: boolean;
  /** Both hands moving toward / away from the camera move a two-hand grab in depth. */
  twoHandDepth: boolean;
}

interface SettingsActions {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: SettingsState = {
  gestureSensitivity: 0.5,
  trackingSmoothing: 0.5,
  handReach: 0.7,
  visualQuality: 'auto',
  particleDensity: 0.6,
  reducedMotion: 'system',
  mouseKeyboardEnabled: true,
  showDebugOverlay: false,
  preferredCameraId: null,
  trackingBackend: 'main-thread',
  palmMenu: true,
  twoHandDepth: true,
};

export const SETTINGS_STORAGE_KEY = 'gestur3d.settings';

export const useSettings = create<SettingsState & SettingsActions>()(
  persist(
    (setState) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => setState({ [key]: value } as Pick<SettingsState, typeof key>),
      reset: () => setState(DEFAULT_SETTINGS),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => migrateSettings(persisted, version),
      partialize: ({ set: _set, reset: _reset, ...state }) => state,
    },
  ),
);

/** Combine the in-app preference with the OS-level setting. */
export function resolveReducedMotion(pref: ReducedMotionPreference, osPrefersReduced: boolean) {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return osPrefersReduced;
}

/**
 * v1 → v2: the default backend changed from "auto" (worker) to the main thread.
 * Users still on the old default move with it; an explicit "worker" is kept.
 */
export function migrateSettings(persisted: unknown, version: number) {
  const state = { ...(persisted as Partial<SettingsState>) };
  if (version < 2 && state.trackingBackend === 'auto') state.trackingBackend = 'main-thread';
  return state as SettingsState & SettingsActions;
}
