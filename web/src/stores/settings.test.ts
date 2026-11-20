import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  resolveReducedMotion,
  useSettings,
} from './settings';

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.getState().reset();
  });

  it('starts with defaults', () => {
    expect(useSettings.getState().particleDensity).toBe(DEFAULT_SETTINGS.particleDensity);
  });

  it('persists changes to localStorage', () => {
    useSettings.getState().set('trackingSmoothing', 0.8);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.state.trackingSmoothing).toBe(0.8);
    expect(stored.state).not.toHaveProperty('set');
  });

  it('reset restores defaults', () => {
    useSettings.getState().set('visualQuality', 'low');
    useSettings.getState().reset();
    expect(useSettings.getState().visualQuality).toBe('auto');
  });
});

describe('resolveReducedMotion', () => {
  it.each([
    ['system', true, true],
    ['system', false, false],
    ['on', false, true],
    ['off', true, false],
  ] as const)('pref=%s os=%s -> %s', (pref, os, expected) => {
    expect(resolveReducedMotion(pref, os)).toBe(expected);
  });
});
