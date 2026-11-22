# ADR-0004: Two-hand manipulation, radial menu and air drawing

- Status: accepted (M3)
- Date: 2026-11-21

## Context

M3 adds the interactions that make hands worth using over a mouse: scaling, rotating and pushing objects with two hands, a menu you can open without a keyboard, and drawing in the air. They have to share one engine with M2's one-hand grab, never make objects jump, and stay usable with real webcam noise, small objects and hands that overlap or drop out.

## Decision

### Two-hand grab (`bimanual.ts`, `handInteraction.ts`)

1. **A second hand joins by pinching anywhere**, on the held object or in empty space. Small objects can't fit two cursors, so requiring both on the object failed in webcam testing.
2. **Snapshot and rebase.** On join, and whenever the set of driving hands changes, the engine snapshots the object's pose and the hands' geometry, and measures change from there. Nothing ever jumps on join, loss or return.
3. **Scale and roll come from the fingertips**, not the knuckle cursors, so hands can bring their pinch points together. The pivot is the object's center by default.
4. **Soft limits.** Dead zones (3% scale, 2° roll) hide jitter. Scale eases into 0.3×–3×. When the hands get very close (with hysteresis) scale and roll hold, because the line between close hands is noisy.
5. **Depth is separate from spread.** Each hand's apparent palm size gives its distance. The dead-zoned change in palm size (gain 8) moves the object toward or away from the camera, and that change is removed from the spread, so pulling hands apart while leaning in doesn't also scale. It's a setting, on by default after webcam testing.
6. **Loss.** If one hand drops out, the other carries on one-handed; if both do, the object freezes for the 300 ms grace and is then released in place.
7. **Roll only.** Yaw from two hands was too noisy in testing; it stays behind future jitter measurements.

### Open-hand depth (one hand)

While one hand holds an object, the other hand held **open** over it for 250 ms pushes or pulls the object by moving toward or away from the camera (gain 8, 0.03 dead zone, 200 ms exit grace). The target zone is 1.8× the object's screen size, with a 150 px floor, so small objects work.

### Radial menu (`radialMenu.ts`, `gestureMenu.ts`, `menuStore.ts`)

1. **Open by pointing.** An index finger held up and still for 600 ms opens it at the hand; a ring shows hold progress. A fist or the hand leaving closes it. Pointing was chosen over an open palm because an open palm is also the depth gesture.
2. **Six actions**, Add, Draw, Color, Undo, Delete and Clear. Add and Color open an outer ring.
3. **Sticky hit testing.** The highlighted sector keeps 45% of its width as extra margin and the ring boundaries 12 px, so small movements don't flick to a neighbor.
4. **While open, pinches belong to the menu.** Hands that aren't holding something can't grab.
5. **One store for all inputs.** Keyboard (M, arrows, Enter, Esc), mouse and hands drive the same state.

### Undo

Structural steps (add, remove, color, add drawing, Clear) push their inverse, up to 50 steps. Continuous moves don't, because they're easy to redo by hand and would flood the history.

### Air drawing (`strokeBuilder.ts`, `drawController.ts`)

1. **Drawings are scene objects** (`kind: 'stroke'`, points stored around their centroid), so selection, moving, two-hand scaling, color, delete and undo all work on them unchanged. They render as a glowing tube with an invisible, padded pick box. At most 40 are kept, and the oldest is dropped.
2. **Draw tool.** With Draw on, a pinch that starts in empty space draws on a camera-facing plane through the scene's middle. A pinch on an object still grabs it. The mouse draws the same way (orbiting is off while drawing).
3. **Capture, then clean up.** A point is added after 3 px of movement, up to 2000 points. On release, taps (< 120 ms or < 10 px) are dropped. Otherwise the stroke is thinned, smoothed (Catmull-Rom) and simplified (RDP at 0.4% of its size). A briefly lost hand pauses its stroke rather than ending it.

## Consequences

- Every gesture still reduces to `Command`s, so mouse, keyboard and hands stay interchangeable and every interaction is testable with scripted landmarks.
- The rule-based poses (pointing, open hand, fist) and pinch are the **baselines** M5's trained classifiers must beat on the same recordings.
- Per-detection cost stays in microseconds (see benchmarks), so the 33 ms budget goes to detection and rendering.
- Open: yaw rotation, and whether depth needs per-user calibration of palm size.
