# Gestur3D

A holographic 3D workspace you control with your hands through a webcam. Hand tracking runs in the browser, and the gesture models are trained from scratch on our own landmark data.

**Status:** Milestone 3 is done; Milestone 4 (modes and Practice) is in progress.

## Features

- **Hand control:** pinch to grab and move objects with either hand. Use two hands to resize, rotate, and push or pull.
- **Radial menu:** point with your index finger and hold still to open it. Add shapes, draw, recolor, undo, delete or clear.
- **Air drawing:** pinch empty space to draw glowing strokes that you can then move like any object.
- **Practice:** a checklist of gestures that tick off as you do them, with a demo hand for each.
- **Mouse and keyboard:** everything works without a camera too. Press `?` in the app for the controls.
- **Private by design:** video stays on your device and is never recorded or uploaded.

## Getting started

Requires Node 22+ and pnpm 10 (and [uv](https://docs.astral.sh/uv/) for `ml/`).

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Camera access needs `localhost` or HTTPS. Chrome, Edge and Arc are the main targets.

Other commands:

- `pnpm build` and `pnpm preview` build and serve the production app
- `pnpm typecheck`, `pnpm lint` and `pnpm test` run checks and unit tests
- `pnpm test:e2e` runs the Playwright tests with scripted hands
- `cd ml && uv sync && uv run pytest` runs the Python checks

## Project layout

- `web/` is the React, Three.js and MediaPipe app. Framework-free logic lives in `web/src/core`.
- `shared/landmark-spec/` holds the landmark format shared by the app and the training code.
- `ml/` will hold dataset processing, training and evaluation.
- `docs/` has design decisions (ADRs) and [benchmarks](docs/benchmarks.md).

## Roadmap

1. ~~Foundation~~, ~~hand tracking~~, ~~two-hand gestures, drawing and menu~~
2. **Modes and Practice:** Practice, Playground and Workspace on one shared engine
3. **Dataset tool:** consented, landmark-only recordings with participant IDs
4. **Playground:** level-based building puzzles with time and accuracy scores
5. **Model training:** our own static and dynamic gesture models, tested on unseen participants
6. **Workspace models:** import glTF models, select parts, annotate and save
7. **Study and launch:** compare gestures against the mouse, then polish and deploy

## Privacy

Video is processed on your device and never stored. The camera turns off when you leave the setup screen or a mode. The dataset tool will only save hand landmarks, with consent.
