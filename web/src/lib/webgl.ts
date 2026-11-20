let cached: boolean | undefined;

/** True if the browser can create a WebGL2 context. Cached after the first call. */
export function supportsWebGL2(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached = !!canvas.getContext('webgl2');
  } catch {
    cached = false;
  }
  return cached;
}
