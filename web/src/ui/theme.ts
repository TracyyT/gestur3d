/**
 * Palette for code that can't read CSS variables cheaply (Three.js materials,
 * canvas overlays). Keep in sync with src/styles/tokens.css.
 */
export const palette = {
  void: '#05060a',
  abyss: '#090b12',
  ink1: '#e9edf6',
  ink2: '#a5aec3',
  ink3: '#6c7590',
  cyan: '#5ee7ff',
  cyanDeep: '#1fb6d6',
  violet: '#9b7bff',
  violetDeep: '#6b4fe0',
  good: '#5ef2b0',
  warn: '#ffc56b',
  bad: '#ff6b8a',
} as const;

export type PaletteColor = keyof typeof palette;
