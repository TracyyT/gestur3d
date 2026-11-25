/**
 * Hand → screen mapping.
 *
 * 1. Detection gives a raw, UNMIRRORED camera-normalized point (0..1).
 * 2. Mirror x once (selfie view): moving your hand right moves the cursor right.
 * 3. The "interaction box" is a centered sub-region of the camera frame
 *    (`reach` = its size as a fraction of the frame), cropped to the target
 *    rect's aspect ratio so horizontal and vertical motion scale equally.
 * 4. The box maps linearly onto the visible scene rect (between the panels),
 *    and extends at the same scale to the window's edges (extendBox).
 *
 * Screen → 3D ray happens in the scene layer using the same camera projection
 * as rendering, so hand picking matches mouse picking exactly.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** Position inside the scene rect, 0..1 (clamped). */
  u: number;
  v: number;
  /** False when the hand is outside the interaction box (cursor pinned to the edge). */
  inBox: boolean;
}

export const DEFAULT_REACH = 0.7;

/**
 * Centered interaction box in camera-normalized coordinates.
 * @param reach fraction of the camera frame the box spans (before cropping)
 * @param cameraAspect camera width / height
 * @param targetAspect scene rect width / height
 */
export function interactionBox(reach: number, cameraAspect: number, targetAspect: number): Box {
  const r = Math.min(1, Math.max(0.2, reach));
  // Work in "frame height" units so x and y are comparable.
  let w = r * cameraAspect;
  let h = r;
  if (w / h > targetAspect) w = h * targetAspect;
  else h = w / targetAspect;
  const bw = w / cameraAspect;
  return { x0: 0.5 - bw / 2, x1: 0.5 + bw / 2, y0: 0.5 - h / 2, y1: 0.5 + h / 2 };
}

/**
 * Grow `box` (aligned to `rect`) so it covers all of `bounds` at the same
 * scale. The scene stays centered under the hands, and the cursor can still
 * reach past the scene rect to the window's edges (behind side panels).
 */
export function extendBox(box: Box, rect: Rect, bounds: Rect): Box {
  const sx = (box.x1 - box.x0) / rect.width;
  const sy = (box.y1 - box.y0) / rect.height;
  return {
    x0: box.x0 - (rect.left - bounds.left) * sx,
    x1: box.x1 + (bounds.left + bounds.width - (rect.left + rect.width)) * sx,
    y0: box.y0 - (rect.top - bounds.top) * sy,
    y1: box.y1 + (bounds.top + bounds.height - (rect.top + rect.height)) * sy,
  };
}

/** Map a raw (unmirrored) camera point to screen pixels inside `rect`. */
export function cameraToScreen(raw: readonly [number, number], box: Box, rect: Rect): ScreenPoint {
  const mirroredX = 1 - raw[0];
  const uRaw = (mirroredX - box.x0) / (box.x1 - box.x0);
  const vRaw = (raw[1] - box.y0) / (box.y1 - box.y0);
  const inBox = uRaw >= 0 && uRaw <= 1 && vRaw >= 0 && vRaw <= 1;
  const u = Math.min(1, Math.max(0, uRaw));
  const v = Math.min(1, Math.max(0, vRaw));
  return { x: rect.left + u * rect.width, y: rect.top + v * rect.height, u, v, inBox };
}

/** Canvas pixel → normalized device coordinates (-1..1, y up). */
export function screenToNdc(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): [number, number] {
  return [(x / canvasWidth) * 2 - 1, -((y / canvasHeight) * 2 - 1)];
}

/** Inverse of cameraToScreen: scene-rect position (u, v in 0..1) → raw camera point. */
export function screenToCamera(u: number, v: number, box: Box): [number, number] {
  const mirroredX = box.x0 + u * (box.x1 - box.x0);
  return [1 - mirroredX, box.y0 + v * (box.y1 - box.y0)];
}
