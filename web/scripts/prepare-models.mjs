#!/usr/bin/env node
/**
 * Puts MediaPipe runtime files in web/public/models/mediapipe so the app
 * serves them itself (no third-party CDN at runtime):
 *   - wasm/  copied from the installed @mediapipe/tasks-vision package
 *   - *.task model files, downloaded once from Google's model storage
 *
 * Runs before `dev` and `build`. A failed download only warns, so the app
 * still builds; camera setup then shows its "model failed to load" state.
 * Set REQUIRE_MODELS=1 (e.g. on Vercel) to make a missing model fatal.
 */
import { createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'models', 'mediapipe');

/** Pinned model versions. Bump deliberately. */
const MODELS = [
  {
    file: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
];

/**
 * The app loads MediaPipe's ES-module runtime itself (src/core/vision/
 * mediapipeRuntime.ts), on the main thread and in the worker, so only the
 * module variant is shipped.
 */
const WASM_FILES = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'];

async function copyWasm() {
  // pnpm links the package into web/node_modules; its exports map hides package.json.
  const pkgDir = join(here, '..', 'node_modules', '@mediapipe', 'tasks-vision');
  const target = join(outDir, 'wasm');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await Promise.all(WASM_FILES.map((f) => cp(join(pkgDir, 'wasm', f), join(target, f))));
  console.log(`[models] copied MediaPipe wasm runtime (${WASM_FILES.length} files)`);
}

async function download({ file, url }) {
  const dest = join(outDir, file);
  if (existsSync(dest) && (await stat(dest)).size > 0) {
    console.log(`[models] ${file} present`);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const tmp = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    await rename(tmp, dest);
    const { size } = await stat(dest);
    console.log(`[models] downloaded ${file} (${(size / 1e6).toFixed(1)} MB)`);
    return true;
  } catch (err) {
    console.warn(`[models] could not download ${file}: ${err.message}`);
    return false;
  }
}

await mkdir(outDir, { recursive: true });
await copyWasm();
const results = await Promise.all(MODELS.map(download));
if (results.includes(false) && process.env.REQUIRE_MODELS === '1') {
  console.error('[models] required model missing; failing build');
  process.exit(1);
}
