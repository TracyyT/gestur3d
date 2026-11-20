# Benchmarks

Only measured numbers go here, each with the date, commit and machine. Empty cells mean "not measured yet", not "fine".

**Reference machine:** MacBook Pro, Apple M5 Pro, 48 GB unified memory, built-in webcam, Chrome (latest stable), plugged in, display at native resolution.

## How to measure

1. `pnpm build && pnpm preview`, then open the printed URL in Chrome. Use a production build, never `pnpm dev`.
2. **Render FPS and frame time:** read from the workspace HUD after 30 s of idle, then while dragging an object.
3. **Detection FPS and latency:** read from the setup screen's preview overlay with both hands in view for 30 s.
4. Record the commit (`git rev-parse --short HEAD`).

## Milestone 1

| Metric                                       | Value | Date | Commit | Notes                   |
| -------------------------------------------- | ----- | ---- | ------ | ----------------------- |
| Landing hero render FPS (1080p window)       |       |      |        | Target ≥ 55             |
| Workspace render FPS, idle, quality Auto     |       |      |        |                         |
| Workspace render FPS, dragging, quality High |       |      |        |                         |
| Detection FPS, 2 hands, setup screen (GPU)   |       |      |        | Camera-rate bound (~30) |
| Detection time per frame, 2 hands (GPU)      |       |      |        |                         |
| Lighthouse accessibility, landing            |       |      |        | Target ≥ 90             |

### Bundle (measured 2026-11-20, production build)

| Chunk                                  | Size     | Gzipped | Loaded on                      |
| -------------------------------------- | -------- | ------- | ------------------------------ |
| App shell (React, router)              | 313 kB   | 99 kB   | every page                     |
| Three.js + R3F + drei + postprocessing | 1,049 kB | 287 kB  | lazily, with the first 3D view |
| UI kit + Motion                        | 150 kB   | 50 kB   | every page                     |
| Setup page + MediaPipe JS              | 171 kB   | 52 kB   | `/setup`                       |
| MediaPipe wasm runtime                 | 14.7 MB  | n/a     | `/setup` (self-hosted)         |
| Hand landmarker model                  | 7.8 MB   | n/a     | `/setup` (self-hosted)         |
