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

### Bundle (measured 2026-11-20, production build)

| Chunk                                  | Size     | Gzipped | Loaded on                      |
| -------------------------------------- | -------- | ------- | ------------------------------ |
| App shell (React, router)              | 313 kB   | 99 kB   | every page                     |
| Three.js + R3F + drei + postprocessing | 1,049 kB | 287 kB  | lazily, with the first 3D view |
| UI kit + Motion                        | 150 kB   | 50 kB   | every page                     |
| Setup page + MediaPipe JS              | 171 kB   | 52 kB   | `/setup`                       |
| MediaPipe wasm runtime                 | 14.7 MB  | n/a     | `/setup` (self-hosted)         |
| Hand landmarker model                  | 7.8 MB   | n/a     | `/setup` (self-hosted)         |
