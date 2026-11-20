# ADR-0002: Threading and render-loop data flow

- Status: accepted (M1), worker move planned for M2
- Date: 2026-11-20

## Context

Hand detection (MediaPipe, roughly 5–15 ms a frame) and 3D rendering with bloom both want the main thread. When they share it, frames drop and input feels laggy. Per-frame data pushed through React state would add re-render cost on top.

## Decision

1. **Per-frame data never goes through React state.** Landmarks live in refs. Object transforms ease toward the model inside `useFrame`. Render timings go into a plain module (`lib/telemetry/renderStats`). React only sees throttled summaries: hand count at 8 Hz, HUD metrics at 4 Hz.
2. **Detection sits behind a `HandSource` interface** (`core/vision/types.ts`) with `start`, `stop`, `subscribe` and `dispose`.
   - **M1:** `MainThreadHandSource`, used only on the setup screen. It runs once per decoded video frame via `requestVideoFrameCallback`.
   - **M2:** a Web Worker source. Frames go in as transferable `ImageBitmap`s and landmarks come back as `Float32Array`s. Detection runs at camera rate (~30 Hz) while rendering runs at the display rate, with smoothing in between.
   - **Tests and replay:** a source that plays back recorded landmark streams.
3. **Fallback.** If the GPU delegate can't start inside a worker on a given browser, use the main-thread source and report which backend is active in the HUD.
4. **Everything in `src/core` is framework-free.** ESLint enforces it: no React or Three.js imports. Tracking, recognition and the interaction state engine can then be unit-tested and benchmarked on their own.

## Consequences

- M2 swaps the source implementation without touching the UI or the scene.
- The worker adds message-passing latency, so the M2 benchmarks compare main-thread vs worker end-to-end latency before it becomes the default.
