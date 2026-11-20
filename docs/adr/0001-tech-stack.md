# ADR-0001: Tech stack

- Status: accepted
- Date: 2026-11-20

## Context

Gestur3D needs real-time 3D rendering, in-browser hand tracking, custom-trained gesture classifiers running locally, and free hosting. It's a portfolio project, so clarity of architecture and reproducible ML matter as much as visuals.

## Decision

| Area                | Choice                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| App                 | React + TypeScript (strict) + Vite, static SPA                             |
| 3D                  | Three.js via React Three Fiber + Drei, postprocessing for selective bloom  |
| Styling / motion    | Tailwind CSS (tokens as CSS variables), Motion for UI only                 |
| State               | Zustand, with transient reads for per-frame data                           |
| Vision              | MediaPipe Tasks Vision (Hand and Face Landmarker), self-hosted model files |
| Inference           | ONNX Runtime Web, WASM backend, single-threaded                            |
| Training            | Python, PyTorch, NumPy, scikit-learn, managed with uv                      |
| Testing             | Vitest, Playwright, pytest                                                 |
| Repo / CI / hosting | pnpm monorepo (`web/`, `ml/`, `shared/`), GitHub Actions, Vercel           |

Primary target: desktop Chromium (Chrome, Edge, Arc). Safari and Firefox are best-effort. The benchmark machine is a MacBook Pro (M5 Pro, 48 GB) with its built-in webcam.

## Consequences

- PyTorch stays the single source of truth for models; ONNX is the browser handoff format.
- Single-threaded ORT avoids COOP/COEP headers. Revisit only if inference time becomes a bottleneck.
- Self-hosting MediaPipe assets adds a few MB to the deploy, but nothing is fetched from third-party CDNs at runtime.
- Benchmarks are reported for the target machine and labeled as such; other devices may differ.
