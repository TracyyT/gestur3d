# Benchmarks

Only measured numbers go here, each with the date, commit and machine. Empty cells mean "not measured yet", not "fine".

**Reference machine:** MacBook Pro, Apple M5 Pro, 48 GB unified memory, built-in webcam, Chrome (latest stable), plugged in, display at native resolution.

## How to measure

1. `pnpm build && pnpm preview`, then open the printed URL in Chrome. Use a production build, never `pnpm dev`.
2. **Render FPS and frame time:** read from the workspace HUD after 30 s of idle, then while dragging an object.
3. **Detection FPS and latency:** read from the setup screen's preview overlay with both hands in view for 30 s.
4. Record the commit (`git rev-parse --short HEAD`).

## Milestone 1

Measured 2026-11-20 at commit `631ed59` on the reference machine, with DevTools docked (page area about 950 px wide).

| Metric                                   | Value                  | Notes                                                                                          |
| ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Landing hero render FPS                  | 120 fps                | DevTools frame-rendering stats. Capped by the 120 Hz display.                                  |
| Workspace render, idle, quality High     | 120 fps · 8.3 ms       | HUD. Capped by the display, so 8.3 ms is the frame interval, not the GPU cost.                 |
| Workspace render, dragging, quality High |                        | Not measured yet                                                                               |
| Hand detection, 1 hand, setup screen     | 30 fps · 12.0 ms · GPU | Detection rate is bound by the camera's 30 fps. 12.0 ms is time inside the detector per frame. |
| Hand detection, 2 hands                  |                        | Not measured yet                                                                               |
| Lighthouse accessibility, `/workspace`   | 100                    | Desktop. 22 audits passed.                                                                     |
| Lighthouse accessibility, landing        |                        | Not measured yet                                                                               |

Because both render readings hit the display's 120 Hz cap, they show that rendering keeps up, not how much headroom is left. GPU frame cost needs a DevTools Performance trace, planned for the M6 performance pass.

## Milestone 2: hand interaction

### Pipeline (synthetic, deterministic)

From `web/src/core/tracking/pipeline.measure.test.ts`: tracker + mapping at 1440×900 with panels open, 30 Hz input, independent landmark noise of ±0.002 of the frame. Render easing (12 ms time constant) comes on top.

| Smoothing setting | Cursor jitter, still hand (RMS) | Lag during a 0.5 s drag | Within 2 px after stopping |
| ----------------- | ------------------------------- | ----------------------- | -------------------------- |
| 0                 | 0.75 px                         | 9 ms                    | 67 ms                      |
| 0.5 (default)     | 0.59 px                         | 14 ms                   | 67 ms                      |
| 1                 | 0.26 px                         | 38 ms                   | 200 ms                     |

Real MediaPipe noise is partly correlated across landmarks (the whole hand shifts), which averaging doesn't remove, so real jitter will be higher. It's measured on hardware below.

### Mapping accuracy (end-to-end, scripted landmarks)

Replayed pinch-grabs of the cube to scene position (0.25, 0.30), through tracker, mapping, render-camera raycast, engine and scene, in `e2e/hand-interaction.spec.ts`: 1440×900 (panels open and hidden), 950×920, 700×900, with the right and left hand. The final position is within 0.2 px of the target in every case. Short dropouts (≤ 300 ms) freeze the object and the grab continues; longer ones release it in place.

### On the reference MacBook Pro

Measured 2026-11-20 on the reference machine with both hands in view, grabbing and moving objects for about 20 s per run, GPU delegate in both. Ranges are the Tracking panel and HUD values sampled every 0.5 s.

| Metric                                | Worker            | Main thread   | Notes            |
| ------------------------------------- | ----------------- | ------------- | ---------------- |
| Render FPS while tracking, idle       | 120 fps           | 118–121 fps   | HUD, display cap |
| Render FPS while dragging with a hand | 120 fps           | 118–121 fps   | HUD, display cap |
| Detection rate                        | 28–30 fps (24–26) | 29–31 fps     | Tracking panel   |
| Inference time, 2 hands               | 15–19 ms          | 11–12 ms      | Tracking panel   |
| Capture → render latency              | 22–26 ms (29)     | 15–16 ms (18) | Tracking panel   |
| Cursor jitter, still hand             |                   |               | Not measured yet |

Values in brackets are occasional dips or peaks. The worker run used a production build (`pnpm preview`); the main-thread run used the dev server, which can only be slower, so the gap is if anything understated.

**Decision:** the main thread is the default (see ADR-0002). It was about 5 ms faster per frame and about 8 ms lower in latency, and rendering stayed at the 120 Hz cap, so the worker's benefit of keeping detection off the render thread didn't show up on this machine. The worker stays available under _Hand tracking → Runs in_ and is worth re-checking on slower machines in M6.

### Bundle (measured 2026-11-20, production build)

| Chunk                                  | Size     | Gzipped | Loaded on                      |
| -------------------------------------- | -------- | ------- | ------------------------------ |
| App shell (React, router)              | 313 kB   | 99 kB   | every page                     |
| Three.js + R3F + drei + postprocessing | 1,049 kB | 287 kB  | lazily, with the first 3D view |
| UI kit + Motion                        | 150 kB   | 50 kB   | every page                     |
| Setup page + MediaPipe JS              | 171 kB   | 52 kB   | `/setup`                       |
| MediaPipe wasm runtime                 | 14.7 MB  | n/a     | `/setup` (self-hosted)         |
| Hand landmarker model                  | 7.8 MB   | n/a     | `/setup` (self-hosted)         |

## Milestone 3: two hands, menu and drawing

### Interaction cost per detection (synthetic)

From `web/src/core/interaction/engine.measure.test.ts`, 3000 detections each, measured 2026-11-21 at commit `6d0ac2c` in Node on a CI-class cloud CPU (not the reference machine). Budgets in the test catch regressions of 10× or more.

| Work                                | Mean   | p99    |
| ----------------------------------- | ------ | ------ |
| One hand dragging an object         | ~4 µs  | ~4 µs  |
| Two hands scaling and turning       | ~8 µs  | ~40 µs |
| Drawing, per detection              | ~2 µs  | ~2 µs  |
| Finishing a 2000-point stroke       | 0.6 ms |        |
| Adding the finished stroke to scene | 0.4 ms |        |

Finishing a long stroke took 7–11 ms before #63, enough to drop a frame on release. It now thins raw points before smoothing, and the simplifier no longer allocates.

### Scene cost (draw calls and triangles)

From the Tracking panel, which counts every pass (scene and bloom) in a frame. Counts don't depend on the machine.

| Scene                       | Draw calls | Triangles |
| --------------------------- | ---------- | --------- |
| Default scene, quality High | 26         | 11k       |
| Plus 10 drawings            | 36         | 18k       |

Each drawing costs one draw call and about 700 triangles; the 40-drawing cap bounds this at about +40 calls and +28k triangles.

### On the reference MacBook Pro

| Metric                                         | Value | Notes            |
| ---------------------------------------------- | ----- | ---------------- |
| Render FPS, two-hand scale + rotate            |       | Not measured yet |
| Render FPS while drawing, 40 drawings in scene |       | Not measured yet |
| Two-hand scale jitter, hands still (RMS)       |       | Not measured yet |
| Menu opened by accident, 2 min of normal use   |       | Not measured yet |

How to measure the last two: record landmarks from the Tracking panel while holding an object still with two hands for 10 s, and during 2 minutes of ordinary grabbing and drawing; the recordings replay in tests.
