// Procedural pixel-art primitives shared by every art-* module.
// - `Put` / `PutRGB`: pixel-write callbacks (Put takes hex strings,
//   PutRGB takes raw r/g/b — used by terrain noise loops where hex
//   parsing per pixel would be a hot-path cost).
// - `P`: the master palette. Adding a new colour goes here so the
//   art modules can import it.
// - `S`: scale factor (2). Every sprite is drawn at logical res then
//   Scale2x'\d to 2× physical so we keep crisp pixel-art edges.
// - drawing primitives: rect/disc/ring/line/ellipse/flashOverlay.
// - hexToRgb: cached hex→[r,g,b] conversion used by terrain code.

import Phaser from 'phaser';

export type Put = (x: number, y: number, c: string | null) => void;
export type PutRGB = (x: number, y: number, r: number, g: number, b: number) => void;

// ------------------------------------------------------------------
//  Palette
// ------------------------------------------------------------------
export const P = {
  outline: '#0b0f1a',
  shadow:  '#141a2e',

  skin:    '#f2c79a',
  skinD:   '#b07c4e',
  skinL:   '#ffe1bf',

  blue:    '#4a90e2',
  blueD:   '#1e3c7a',
  blueM:   '#2f68b8',
  blueL:   '#a8d1ff',

  red:     '#d9412b',
  redD:    '#6e1a0e',
  redM:    '#a32a18',
  redL:    '#ff7a5c',

  heavy:   '#7a1d14',
  heavyD:  '#2a0704',
  heavyM:  '#5a1208',
  heavyL:  '#b8342a',

  wood:    '#8b5a2b',
  woodD:   '#3e2310',
  woodM:   '#6b4220',
  woodL:   '#c08850',

  stone:   '#8892a0',
  stoneD:  '#3e4654',
  stoneM:  '#5a6270',
  stoneL:  '#b6bfcc',

  gold:    '#ffd84a',
  goldD:   '#7a4e08',
  goldM:   '#c08820',
  goldL:   '#fff0a0',

  bronze:  '#c47a3e',
  bronzeD: '#4a2408',
  bronzeM: '#8b4513',
  bronzeL: '#e8a572',

  silver:  '#c8d0d8',
  silverD: '#4a525a',
  silverM: '#7a8090',
  silverL: '#eef2f6',

  steel:   '#c0c8d4',
  steelD:  '#5a6270',

  arrow:   '#d8b878',
  arrowD:  '#4a3210',

  white:   '#ffffff',
  spark:   '#ffe070',
  sparkL:  '#fffbd0',

  grass:   '#2e4a2a',
  grassD:  '#1a2e18',
  grassM:  '#243d22',
  grassL:  '#3e5f38',

  // infected enemy colors
  infect:  '#9040d0',   // main purple body
  infectD: '#4a1870',   // dark purple
  infectM: '#6a28a0',   // mid purple
  infectL: '#c070ff',   // light purple highlight

  infectH:  '#d08020',  // infected heavy — orange
  infectHD: '#6a3808',  // dark orange
  infectHM: '#a06018',  // mid orange
  infectHL: '#ffb040',  // light orange

  infectR:  '#e0d020',  // infected runner — yellow
  infectRD: '#6a6008',  // dark yellow
  infectRL: '#fff060',  // light yellow

  // boss belly
  belly:   '#d89080',
  bellyD:  '#7a3a2a',
  bellyM:  '#a8604a',

  // snake colors
  snake:   '#4a7a30',
  snakeD:  '#3a5a20',
  snakeM:  '#5a8a40',
  snakeL:  '#6a9a48',
  snakeBelly: '#c8cc88',
  snakePat: '#2a4a18',

  // rat colors
  rat:     '#7a6a5a',
  ratD:    '#5a4a3a',
  ratL:    '#8a7a6a',
  ratTail: '#a08070',

  // deer colors
  deer:    '#8a6a48',
  deerD:   '#6a4a30',
  deerM:   '#7a5a38',
  deerL:   '#a88a60',
  deerBelly: '#c8b898',
  antler:  '#d4c8a0',
  antlerD: '#a89870',

  // archer tower extras
  tunic:   '#2a7a3a',
  tunicD:  '#1a4a24',
  tunicL:  '#3a9a4a',
  hood:    '#3a5a2a',
  hoodD:   '#1a3a18',
  stoneHL: '#d0d8e4',
  banner:  '#c04040',
  bannerL: '#e06060',

  // Forest enemies
  wolf:    '#8a8a8a',
  wolfD:   '#4a4a4a',
  wolfM:   '#6a6a6a',
  wolfL:   '#b0b0b0',

  bear:    '#5a3a1a',
  bearD:   '#2a1a0a',
  bearM:   '#4a2a10',
  bearL:   '#8a6a3a',

  spider:  '#2a2a2a',
  spiderD: '#0a0a0a',
  spiderM: '#1a1a1a',
  spiderL: '#4a4a4a',
  spiderEye: '#ff2020',

  // Forest boss (Wendigo) + shared bark/leaf for boulders etc.
  bark:    '#4a3420',
  barkD:   '#2a1808',
  barkM:   '#3a2814',
  barkL:   '#6a5030',
  leaf:    '#1a3a12',
  leafD:   '#0e2408',
  leafM:   '#28521e',
  leafL:   '#38682c',
  leafB:   '#4a7e3a',
  entEye:  '#60ff60',
  entEyeD: '#208020',

  // Wendigo bone/spectral colors
  wBone:   '#c8c0a8',
  wBoneD:  '#8a8068',
  wBoneL:  '#e8e0d0',

  // Forest boss green-flame ramp (dark edge → white-hot core)
  gfire:   '#2aa84a',
  gfireD:  '#15602c',
  gfireL:  '#7df08a',
  gfireC:  '#d6ffd2',
  wGhost:  '#1a3a20',   // solid equivalent of translucent green mist
  wGhostD: '#0e2410',   // darker mist
  wGhostL: '#2a5a30',   // lighter mist edge
  wGhostB: '#3a7a40',   // bright mist highlight

  // Ancient Ram boss
  ram:     '#8a8078',
  ramD:    '#5a5048',
  ramM:    '#706860',
  ramL:    '#aaa098',
  ramBelly:'#c0b8a8',
  wool:    '#c8c0b0',
  woolD:   '#908878',
  woolL:   '#e0d8cc',
  horn:    '#d8d0b8',
  hornD:   '#a8a088',
  hornM:   '#c0b8a0',
  hornL:   '#ece8d8',

  // Ancient Ram demonic recolor — charcoal hide + ember accents
  dram:    '#332e2b',   // dark charcoal-brown hide
  dramD:   '#1c1816',
  dramM:   '#272320',
  dramL:   '#46403a',
  dmane:   '#221e1b',   // near-black shaggy fleece
  dmaneD:  '#141110',
  dmaneL:  '#36302b',
  dhorn:   '#3b3734',   // soot-grey horn
  dhornD:  '#232020',
  dhornM:  '#2e2a28',
  dhornL:  '#544e48',
  ember:   '#ff3a14',   // demonic glow
  emberD:  '#8a1408',
  emberL:  '#ff9a30',

  // Fog Phantom (river boss)
  fog:     '#324060',
  fogD:    '#1a2840',
  fogM:    '#283450',
  fogL:    '#506888',
  // river phantom blue-flame ramp (dark edge → white-hot core)
  bfire:   '#2848d8',
  bfireD:  '#18246e',
  bfireL:  '#5aa0ff',
  bfireC:  '#d8eeff',
  fogGlow: '#64c8ff',
  fogGlowD:'#3090c0',
  fogCore: '#405878',
  fogWisp: '#283a58'
};

// ------------------------------------------------------------------
//  Draw helpers
// ------------------------------------------------------------------

// Resolution scale — every sprite is drawn at logical res then Scale2x'd to 2× physical
export const S = 2;

// Scale2x pixel-art upscaler: preserves hard edges while smoothing staircase diagonals
export function pxIdx(w: number, x: number, y: number) { return (y * w + x) * 4; }
export function pxEq(d: Uint8ClampedArray, w: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const i = pxIdx(w, x1, y1), j = pxIdx(w, x2, y2);
  return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
}
export function pxCopy(s: Uint8ClampedArray, sw: number, sx: number, sy: number,
                d: Uint8ClampedArray, dw: number, dx: number, dy: number) {
  const si = pxIdx(sw, sx, sy), di = pxIdx(dw, dx, dy);
  d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
}
export function scale2x(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number) {
  const dw = w * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ay = Math.max(0, y - 1);          // up
      const bx = Math.min(w - 1, x + 1);      // right
      const cx = Math.max(0, x - 1);           // left
      const dy2 = Math.min(h - 1, y + 1);     // down

      const ca = pxEq(src, w, cx, y, x, ay);
      const ab = pxEq(src, w, x, ay, bx, y);
      const cd = pxEq(src, w, cx, y, x, dy2);
      const bd = pxEq(src, w, bx, y, x, dy2);

      const ox = x * 2, oy = y * 2;

      if (ca && !cd && !ab) pxCopy(src, w, x, ay, dst, dw, ox, oy);
      else pxCopy(src, w, x, y, dst, dw, ox, oy);

      if (ab && !ca && !bd) pxCopy(src, w, bx, y, dst, dw, ox + 1, oy);
      else pxCopy(src, w, x, y, dst, dw, ox + 1, oy);

      if (cd && !bd && !ca) pxCopy(src, w, cx, y, dst, dw, ox, oy + 1);
      else pxCopy(src, w, x, y, dst, dw, ox, oy + 1);

      if (bd && !ab && !cd) pxCopy(src, w, bx, y, dst, dw, ox + 1, oy + 1);
      else pxCopy(src, w, x, y, dst, dw, ox + 1, oy + 1);
    }
  }
}

export function makeCanvas(size: number, draw: (put: Put) => void): HTMLCanvasElement {
  // Draw at logical resolution
  const logCanvas = document.createElement('canvas');
  logCanvas.width = size; logCanvas.height = size;
  const logCtx = logCanvas.getContext('2d')!;
  logCtx.imageSmoothingEnabled = false;
  const put: Put = (x, y, col) => {
    if (col == null) return;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    logCtx.fillStyle = col;
    logCtx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  };
  draw(put);

  // Scale2x upscale to 2× physical resolution
  const physSize = size * S;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = physSize; outCanvas.height = physSize;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.imageSmoothingEnabled = false;

  const srcData = logCtx.getImageData(0, 0, size, size);
  const dstData = outCtx.createImageData(physSize, physSize);
  scale2x(srcData.data, dstData.data, size, size);
  outCtx.putImageData(dstData, 0, 0);

  return outCanvas;
}

/** Wrap a put so all x-coordinates are mirrored around the center (31-x for 32px sprites). */
export function mirrorX(put: Put): Put {
  return (x, y, c) => put(31 - x, y, c);
}

/** Stroke a 1px P.outline border around a recorded silhouette. `body` is the
 *  set of painted body pixels keyed `y * size + x` (collect them with a
 *  recording put wrapper); every empty pixel 4-adjacent to the body gets the
 *  outline colour. Draw shadows with the raw (unrecorded) put so they stay
 *  outside the stroke. */
export function strokeOutline(body: Set<number>, put: Put, size = 32) {
  for (const k of body) {
    const x = k % size, y = (k / size) | 0;
    if (!body.has(k - size)) put(x, y - 1, P.outline);
    if (!body.has(k + size)) put(x, y + 1, P.outline);
    if (x > 0 && !body.has(k - 1)) put(x - 1, y, P.outline);
    if (x + 1 < size && !body.has(k + 1)) put(x + 1, y, P.outline);
  }
}

export function rect(put: Put, x: number, y: number, w: number, h: number, c: string | null) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c);
}
export function disc(put: Put, cx: number, cy: number, r: number, c: string | null) {
  const r2 = r * r + r * 0.4;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r2) put(cx + x, cy + y, c);
}
export function ring(put: Put, cx: number, cy: number, r: number, c: string | null) {
  const outer = r * r + r * 0.4;
  const inner = (r - 1) * (r - 1) + (r - 1) * 0.4;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= outer && d > inner) put(cx + x, cy + y, c);
    }
}
export function line(put: Put, x0: number, y0: number, x1: number, y1: number, c: string) {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 200; i++) {
    put(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
export function ellipse(put: Put, cx: number, cy: number, rx: number, ry: number, c: string | null) {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) put(cx + x, cy + y, c);
}
export function flashOverlay(put: Put, size: number, within: (x: number, y: number) => boolean) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (within(x, y)) put(x, y, P.white);
}

/** Register a canvas as a Phaser texture under `key`. Overwrites any
 *  existing texture with the same name (re-running generateAllArt across
 *  scene restarts otherwise warns about duplicates). */
export function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// hexToRgb (with its own colour cache) lives here because terrain
// noise loops call it tens of thousands of times per chunk.
const _colorCache = new Map<string, [number, number, number]>();
export function hexToRgb(hex: string): [number, number, number] {
  let c = _colorCache.get(hex);
  if (c) return c;
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _colorCache.set(hex, c);
  return c;
}
