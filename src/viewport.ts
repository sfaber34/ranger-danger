import { CFG } from './config';

// Target world-width visible on mobile by orientation. Mobile portrait shows a
// tight (tall) view; mobile landscape shows a wider slice. Desktop is governed
// by the legacy sf formula so its look is unchanged.
const MOBILE_PORTRAIT_WORLD_W = 540;
const MOBILE_LANDSCAPE_WORLD_W = 720;

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
    // Desktop — preserve legacy behavior exactly. sf is the single factor used
    // for canvas rendering, camera zoom, and UI sizing. Canvas is sized to
    // CFG.width × CFG.height × sf and letterboxed by Phaser's FIT mode when
    // the window aspect doesn't match 3:2.
    const sf = Math.max(1, Math.min(w * dpr / CFG.width, h * dpr / CFG.height));
    return {
      isMobile: false,
      isPortrait,
      renderW: Math.round(CFG.width * sf),
      renderH: Math.round(CFG.height * sf),
      cameraZoom: sf,
      uiScale: sf,
    };
  }

  // Mobile — canvas fills the device viewport (no letterbox). Camera zoom is
  // picked to show an intended world width, not pinned to 960×640.
  const renderW = Math.round(w * dpr);
  const renderH = Math.round(h * dpr);
  const targetWorldW = isPortrait ? MOBILE_PORTRAIT_WORLD_W : MOBILE_LANDSCAPE_WORLD_W;
  const cameraZoom = renderW / targetWorldW;
  // UI scale: chunkier than desktop for tap targets. dpr * 1.5 keeps CSS-pixel
  // text around 22–24px for a 15-unit base — thumb-readable on mobile.
  const uiScale = dpr * 1.5;
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
