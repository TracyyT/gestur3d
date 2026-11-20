import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VisualQuality = 'auto' | 'low' | 'medium' | 'high';
export type ReducedMotionPreference = 'system' | 'on' | 'off';

export interface SettingsState {
  /** 0..1. Higher = gestures trigger with less movement / lower confidence. Active from M2. */
  gestureSensitivity: number;
  /** 0..1. Higher = steadier but slightly laggier tracking. Active from M2. */
  trackingSmoothing: number;
  visualQuality: VisualQuality;
  /** 0..1 multiplier on particle counts. */
  particleDensity: number;
  reducedMotion: ReducedMotionPreference;
  /** Mouse and keyboard controls stay on alongside gestures. */
  mouseKeyboardEnabled: boolean;
  showDebugOverlay: boolean;
  preferredCameraId: string | null;
}

interface SettingsActions {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: SettingsState = {
  gestureSensitivity: 0.5,
  trackingSmoothing: 0.5,
  visualQuality: 'auto',
  particleDensity: 0.6,
  reducedMotion: 'system',
  mouseKeyboardEnabled: true,
  showDebugOverlay: false,
  preferredCameraId: null,
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
      version: 1,
      storage: createJSONStorage(() => localStorage),
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
