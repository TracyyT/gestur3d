import { describe, expect, it } from 'vitest';
import { isCameraRoute, MODES } from './modes';

describe('modes', () => {
  it('keeps the camera on for setup and every mode, and nowhere else', () => {
    expect(isCameraRoute('/setup')).toBe(true);
    for (const m of MODES) expect(isCameraRoute(m.path)).toBe(true);
    expect(isCameraRoute('/')).toBe(false);
    expect(isCameraRoute('/dev/ui')).toBe(false);
    expect(isCameraRoute('/workspace/extra')).toBe(false);
  });

  it('has unique ids and paths', () => {
    expect(new Set(MODES.map((m) => m.id)).size).toBe(MODES.length);
    expect(new Set(MODES.map((m) => m.path)).size).toBe(MODES.length);
  });
});
