import { describe, expect, it } from 'vitest';
import vercelJson from '../../vercel.json?raw';
import { routes } from './routes';

interface Rewrite {
  source: string;
  destination: string;
}

const { rewrites } = JSON.parse(vercelJson) as { rewrites: Rewrite[] };

/** Where the host sends a request path that has no file behind it. */
function rewriteTarget(path: string): string | undefined {
  return rewrites.find((r) => new RegExp(`^${r.source}$`).test(path))?.destination;
}

const appPaths = routes[0]!.children!.flatMap((r) => (r.path && r.path !== '*' ? [r.path] : []));

describe('SPA rewrites in vercel.json', () => {
  it('covers every app route', () => {
    expect(appPaths).toEqual(expect.arrayContaining(['setup', 'practice', 'workspace']));
    for (const path of ['/', ...appPaths.map((p) => `/${p}`)]) {
      expect(rewriteTarget(path), path).toBe('/index.html');
    }
  });

  it('sends unknown pages to the app, which shows its not-found page', () => {
    expect(rewriteTarget('/does-not-exist')).toBe('/index.html');
  });

  it('leaves missing assets and model files as real 404s', () => {
    for (const path of [
      '/assets/missing-abc123.js',
      '/models/mediapipe/missing.task',
      '/favicon.svg',
    ]) {
      expect(rewriteTarget(path), path).toBeUndefined();
    }
  });
});
