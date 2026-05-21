import { CFG } from './config';

// Target world-width visible across the SHORT device dimension on mobile. Both
// portrait and landscape use the same magnification factor (shorterDim / 540)
// so rotating the device doesn't change how big the player/enemies appear —
// landscape just reveals more world horizontally because the canvas is wider.
// Desktop is governed by the legacy sf formula so its look is unchanged.
const MOBILE_WORLD_W_PER_SHORT_DIM = 540;

// Mobile UI design space. The UI is laid out assuming the canvas is this many
// base units. uiScale = renderDimension / designDimension, so a slot defined at
// base size 48 renders tap-friendly on phones while still fitting horizontally.
const MOBILE_PORTRAIT_UI_DESIGN_W = 400;
const MOBILE_PORTRAIT_UI_DESIGN_H = 800;
const MOBILE_LANDSCAPE_UI_DESIGN_W = 800;
const MOBILE_LANDSCAPE_UI_DESIGN_H = 400;

export interface ViewportInfo {
  isMobile: boolean;
  isPortrait: boolean;
  /** Physical canvas width in pixels (what setGameSize should use). */
  renderW: number;
  /** Physical canvas height in pixels. */
  renderH: number;
  /** Camera zoom so that the visible world has the intended dimensions. */
  cameraZoom: number;
  /** UI scale factor — multiplies base-resolution UI coords for sizing/positioning. */
  uiScale: number;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // pointer:coarse = touch-first device (phones, most tablets).
  if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  // Fallback: tiny viewport with no fine pointer.
  if (window.innerWidth < 720 && !window.matchMedia?.('(pointer: fine)').matches) return true;
  return false;
}

export function computeViewport(): ViewportInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const isMobile = isMobileDevice();
  const isPortrait = h > w;

  if (!isMobile) {
    // Desktop — canvas fills the full browser window (no 3:2 letterbox in
    // GameScene). LevelSelectScene re-fits its own gameSize to 3:2
    // internally so the hand-painted level-select map stays in place.
    // sf is still derived from CFG.* for camera zoom + UI sizing so HUD
    // dimensions and the visible world height feel the same as before;
    // the only difference is wider monitors get more horizontal world
    // (and a correspondingly larger spawn radius — see recomputeSpawnDist).
    const sf = Math.max(1, Math.min(w * dpr / CFG.width, h * dpr / CFG.height));
    return {
      isMobile: false,
      isPortrait,
      renderW: Math.round(w * dpr),
      renderH: Math.round(h * dpr),
      cameraZoom: sf,
      uiScale: sf,
    };
  }

  // Mobile — canvas fills the device viewport (no letterbox). Camera zoom is
  // pinned to the shorter device dimension so portrait and landscape have the
  // same magnification; rotating the device just reveals more world along the
  // long axis instead of zooming the world contents.
  const renderW = Math.round(w * dpr);
  const renderH = Math.round(h * dpr);
  const shortDim = Math.min(renderW, renderH);
  const cameraZoom = shortDim / MOBILE_WORLD_W_PER_SHORT_DIM;
  // UI scale: on mobile the UI is re-authored to a smaller design space so the
  // resulting uiScale is generous enough for tap-sized hit targets while still
  // guaranteeing `designW * uiScale ≤ canvas_width` (no overflow).
  const designW = isPortrait ? MOBILE_PORTRAIT_UI_DESIGN_W : MOBILE_LANDSCAPE_UI_DESIGN_W;
  const designH = isPortrait ? MOBILE_PORTRAIT_UI_DESIGN_H : MOBILE_LANDSCAPE_UI_DESIGN_H;
  const uiScale = Math.min(renderW / designW, renderH / designH);
  return {
    isMobile: true,
    isPortrait,
    renderW,
    renderH,
    cameraZoom,
    uiScale,
  };
}

/** Compute how many world units are currently visible in the camera view. */
export function viewportWorldSize(vp: ViewportInfo): { w: number; h: number } {
  return { w: vp.renderW / vp.cameraZoom, h: vp.renderH / vp.cameraZoom };
}

/** Install a debounced listener that re-runs `onChange` whenever the window's
 *  size or orientation changes (rotation, browser resize, address-bar
 *  collapse). Returns a cleanup function. */
export function installViewportResizeListener(
  onChange: (vp: ViewportInfo) => void,
  debounceMs = 120,
): () => void {
  let timer: number | undefined;
  const handler = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      onChange(computeViewport());
    }, debounceMs);
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  // visualViewport gives more accurate values when iOS Safari shows/hides the
  // address bar. Not all browsers expose it.
  const vv = window.visualViewport;
  vv?.addEventListener('resize', handler);
  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    vv?.removeEventListener('resize', handler);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
