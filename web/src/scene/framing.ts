/**
 * Pure framing math shared by the 3D camera (PanelAwareFraming) and the hand
 * mapping, so the hand cursor's area is exactly the area the scene is drawn in.
 */

/** Width the side panels cover on the right edge (296 px panel + 16 px margin). */
export const PANEL_COVER_PX = 312;
/** Below this width the panels overlay the scene anyway; don't reframe. */
export const MIN_REFRAME_WIDTH_PX = 900;
/**
 * On-screen width the default object layout needs, as a multiple of the
 * viewport height (vertical FOV is fixed, so horizontal size scales with
 * height). Objects span about ±2.6 world units at ~7.7 units from the camera
 * with a 42° FOV: ≈ 0.88 × height, plus margin.
 */
const CONTENT_WIDTH_PER_HEIGHT = 1.0;
const MIN_ZOOM = 0.55;

export interface Framing {
  /** Horizontal projection shift in px (positive moves the scene left). */
  offsetX: number;
  /** Camera zoom (< 1 zooms out so the layout fits the free width). */
  zoom: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** True when the panels take space away from the scene (vs overlaying it). */
export function panelsReserveSpace(panelsVisible: boolean, width: number) {
  return panelsVisible && width >= MIN_REFRAME_WIDTH_PX;
}

/**
 * The part of the canvas where the scene is framed: right of a mode's left
 * panel (`leftInset` px, e.g. Practice's checklist) and left of the side panels.
 */
export function visibleSceneRect(
  panelsVisible: boolean,
  width: number,
  height: number,
  leftInset = 0,
): Rect {
  const roomy = width >= MIN_REFRAME_WIDTH_PX;
  const left = roomy ? leftInset : 0;
  const right = panelsReserveSpace(panelsVisible, width) ? PANEL_COVER_PX : 0;
  return { left, top: 0, width: width - left - right, height };
}

/**
 * Where the scene should sit: centered in the visible scene rect, and zoomed
 * out just enough for the default layout to fit.
 */
export function computeFraming(
  panelsVisible: boolean,
  width: number,
  height: number,
  leftInset = 0,
): Framing {
  const r = visibleSceneRect(panelsVisible, width, height, leftInset);
  const needed = height * CONTENT_WIDTH_PER_HEIGHT;
  const zoom = Math.min(1, Math.max(MIN_ZOOM, r.width / needed));
  // Shift so the scene's center lands in the middle of the free rect.
  const offsetX = width / 2 - (r.left + r.width / 2);
  return { offsetX, zoom };
}
