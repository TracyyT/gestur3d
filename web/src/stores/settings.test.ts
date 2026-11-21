import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  resolveReducedMotion,
  migrateSettings,
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

describe('migrateSettings', () => {
  it('moves the old auto default to the main thread', () => {
    expect(migrateSettings({ trackingBackend: 'auto' }, 1).trackingBackend).toBe('main-thread');
  });

  it('keeps an explicit worker choice', () => {
    expect(migrateSettings({ trackingBackend: 'worker' }, 1).trackingBackend).toBe('worker');
  });

  it('leaves auto alone once on v2', () => {
    expect(migrateSettings({ trackingBackend: 'auto' }, 2).trackingBackend).toBe('auto');
  });
});
