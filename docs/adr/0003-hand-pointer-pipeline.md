# ADR-0003: Hand pointer pipeline

- Status: accepted (M2)
- Date: 2026-11-20

## Context

Hands must select, grab, move and release objects with the same accuracy as the mouse, at any window size, with or without the side panels, and with either hand, without jitter, noticeable lag, or objects jumping when tracking drops out. Later milestones add two-hand scale/rotate and trained gesture classifiers, so the pipeline must have clean seams.

## Decision

```
HandSource (worker | main thread | replay)
  → HandTracker      identity, One Euro smoothing, pinch detection, loss grace
  → handMapping      mirror once, reach box cropped to scene aspect, scene rect
  → HandController   per render frame; raycasts with the render camera
  → HandInteractionEngine   hover / grab / move / release → Commands
  → scene reducer (same as mouse and keyboard)
```

1. **One coordinate convention.** Detection sees the raw, unmirrored frame. x is mirrored exactly once, in `cameraToScreen`. The preview mirrors only its display.
2. **Map to the visible scene, not the window.** The reach box (default 70% of the frame, cropped to the scene rect's aspect so motion is isotropic) maps onto `visibleSceneRect()`, which is the same function the 3D camera framing uses. Screen → ray goes through the render camera's projection, including the panel offset and zoom.
3. **Cursor anchor = thumb and index knuckles.** They don't move when the pinch opens or closes (0 px drift, vs 19–38 px for fingertip-based anchors), so grabbing and releasing can't nudge the object. Held objects also stop following once the fingers start opening, before the pinch counts as ended.
4. **Smoothing in the tracker, easing at render.** A One Euro filter on the cursor anchor (camera space, real timestamps), plus a 12 ms render-rate ease between 30 Hz detections.
5. **Pinch is geometric.** Thumb-index distance over palm size, from metric world landmarks, with hysteresis and a 60 ms hold. It's more reliable than classification for a continuous control; trained classifiers (M5) add discrete gestures alongside it.
6. **Grab only on the pinch's start edge**, over the hovered object. A closed pinch swept across objects, or a hand appearing already pinched, never grabs.
7. **Tracking loss.** A missing hand is `lost` for 300 ms. The held object freezes and the grab resumes if the hand returns; otherwise it's released in place. The grace is measured in frame time while frames flow, so render stalls can't end a grab early or extend one.
8. **Pinch edges are accumulated** across all detections consumed in a render frame, so a frame hitch can't swallow a grab.
9. **Backends are interchangeable.** The worker (module worker, transferred `ImageBitmap`, at most one frame in flight) and the main thread share one interface. The default is chosen by measurement on the reference machine.

## Consequences

- `HandPointer` (id, handedness, phase, screen, pinch strength, hover, grabbed) is the unit M3 builds on: two-hand scale/rotate reads two pointers and adds a coordinator above the engine.
- Every stage is pure and replayable, so interaction tests run in CI with scripted landmarks at several window sizes and with either hand.
- Depth (push/pull) is not mapped yet; grabs move on a camera-facing plane like the mouse. Planned for M3.
