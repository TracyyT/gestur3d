# Gestur3D

**A holographic 3D workspace you control with your hands through a webcam.** Grab, rotate and scale floating objects, draw in the air, and trigger effects with gestures. Hand tracking runs locally in the browser. The gesture classifiers are trained from scratch in PyTorch on a purpose-built landmark dataset and run in the browser via ONNX.

> **Status: Milestone 2 (hand tracking and manipulation) complete.** Pinch to grab, move and release objects with either hand, with mouse and keyboard as a full fallback. Two-hand scaling and rotation come in Milestone 3. See the [roadmap](#roadmap).

## What works today

- **Landing page** with an interactive holographic hero (React Three Fiber, selective bloom)
- **Camera setup**: explains camera use before the browser asks, then shows a mirrored live preview with hand skeletons, detection FPS and latency, a camera picker, and a calibration checklist (hands, distance, lighting). It gives specific recovery steps when the camera is blocked, missing or busy.
- **Hand control**: pinch to grab an object, move your hand to carry it, and open your fingers to release. Works with either hand.
  - Cursors per hand (cyan right, violet left) show detected, hovering (with pinch progress), grabbing, released and lost states.
  - Accurate at any window size and with the side panels open: the hand maps onto the visible scene area, and picking uses the same camera projection as rendering.
  - One Euro smoothing (adjustable), a "reach" setting for how far you move, and a 300 ms grace that freezes held objects through brief tracking dropouts.
  - Detection runs on the main thread by default (measured faster than the Web Worker, which stays available as a setting). The tracking panel shows backend, detection rate, inference time and end-to-end latency, and can record landmarks (never video).
- **Workspace**: holographic lab environment with directly manipulable objects
  - Mouse: click to select, drag to move, Shift-drag to rotate, scroll to scale, drag empty space to orbit
  - Keyboard: Tab cycles objects, arrows move, Q/E/W/S rotate, +/− scale, Delete removes, ? shows controls
  - HUD: measured render FPS and frame time, current mode, Objects and Settings panels, and a draggable camera preview
- **Privacy**: the camera turns off when you leave setup or the workspace. No frames are stored or uploaded. Models and the wasm runtime are self-hosted.
- **Accessibility**: every action works without gestures, focus is never trapped, selection changes are announced, and reduced motion follows the OS setting with an in-app override.

## Architecture

```mermaid
flowchart TD
  cam[Webcam] --> vision["Vision source<br/>MediaPipe Hand Landmarker<br/>(main thread or Web Worker)"]
  replay[Recorded landmarks] -.-> tracking
  vision --> tracking["Tracking<br/>coordinates, smoothing, hand identity (M2)"]
  tracking --> recog["Gesture recognition<br/>geometric + trained MLP / GRU via ONNX (M2–M5)"]
  recog --> engine["Interaction state engine (M3)"]
  engine -->|Commands| store[Scene store]
  mk[Mouse + keyboard] -->|same Commands| store
  store --> render[React Three Fiber renderer]
  telemetry[Telemetry: FPS, latency] -.-> hud[HUD]
```

Three rules keep it fast and testable (see [ADR-0002](docs/adr/0002-threading-and-render-loop.md), and [ADR-0003](docs/adr/0003-hand-pointer-pipeline.md) for the hand pipeline):

1. **Every input becomes a `Command`.** One pure reducer handles them all, so mouse, keyboard, gestures and replays share the same tested logic.
2. **No per-frame data in React state.** Landmarks and transforms live in refs and the render loop. React only sees throttled summaries.
3. **`src/core` is framework-free.** No React or Three.js (enforced by ESLint), so vision, tracking and interaction logic is unit-testable on its own.

Landmark conventions and normalization are defined once in [`shared/landmark-spec`](shared/landmark-spec/SPEC.md). Golden test vectors keep the browser and the Python training code in sync.

## Repository layout

```
web/                  Vite + React + TypeScript app
  src/core/           framework-free logic: vision (sources, worker, replay),
                      tracking (smoothing, pinch, hand tracks), interaction
                      (commands, reducer, hand mapping, hand engine)
  src/features/       landing, setup, workspace, camera, hands
  src/scene/          R3F canvas, environments, objects, shaders
  src/ui/             design system (glass components, tokens)
  src/stores/         Zustand stores: settings, scene, HUD layout
  e2e/                Playwright tests (run with a fake camera)
  scripts/            prepare-models: self-hosts MediaPipe assets
shared/landmark-spec/ landmark spec, reference normalization, golden vectors
ml/                   Python: dataset processing, training, evaluation (M4–M5)
docs/                 ADRs and benchmarks
```

## Getting started

Requirements: Node 22+, pnpm 10, and for `ml/`, [uv](https://docs.astral.sh/uv/).

```bash
pnpm install
pnpm dev            # downloads MediaPipe model files on first run, then starts Vite
```

Open `http://localhost:5173`. Camera access needs `localhost` or HTTPS. Desktop Chrome, Edge and Arc are the primary targets; Safari and Firefox are best-effort.

| Command                                      | What it does                                |
| -------------------------------------------- | ------------------------------------------- |
| `pnpm dev`                                   | Dev server                                  |
| `pnpm build` / `pnpm preview`                | Production build / serve it locally         |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Static checks and unit tests (all packages) |
| `pnpm test:e2e`                              | Playwright end-to-end tests                 |
| `cd ml && uv sync && uv run pytest`          | Python checks                               |

## Testing

- **Unit (Vitest):** command reducer, keyboard mapping, camera error handling, calibration math, rate meters, settings, UI components, landmark normalization (property tests and golden vectors)
- **End-to-end (Playwright, fake camera):** landing → setup, the camera on/off flow and turning it off on navigation, keyboard control without focus traps, panels, settings persistence
- **Hand interaction (Playwright + scripted landmarks):** grab/move/release at four window sizes, panels open and hidden, both hands; tracking dropouts; swept pinches and idle hands never grab. Where the hand model is available (CI), a test also checks that live detection starts in the workspace.
- CI runs everything on every pull request.

Performance numbers are recorded in [docs/benchmarks.md](docs/benchmarks.md). Only measured values go there.

## Roadmap

| Milestone                         | Scope                                                                         | Status  |
| --------------------------------- | ----------------------------------------------------------------------------- | ------- |
| M1 Foundation                     | Repo, design system, landing, camera setup, mouse/keyboard workspace, HUD     | ✅ Done |
| M2 Hand tracking and manipulation | Detection pipeline, smoothing, pinch grab/move/release, landmark recorder     | ✅ Done |
| M3 Advanced interactions          | Two-hand scale/rotate, air drawing, radial menu, state engine, rule baselines | Next    |
| M4 Dataset collection tool        | Record, label, review and export samples, multi-participant consent           | Planned |
| M5 Model training                 | Static MLP and dynamic GRU/TCN, participant-grouped splits, ONNX in browser   | Planned |
| M6 Effects and environments       | Particles, four environments, object library, adaptive quality                | Planned |
| M7 AR mode and launch             | Face filters, accessibility pass, benchmarks, deploy                          | Planned |

## Privacy

- Video is processed on your device and never recorded, stored or uploaded.
- The camera only runs on the setup and workspace screens. It turns off when you leave them, when you close the tab, or when you press the camera-off button.
- MediaPipe's runtime and models are served from this site, not a third-party CDN.
- The dataset tool (M4) will store **landmarks only, never video**, and only with explicit consent.
