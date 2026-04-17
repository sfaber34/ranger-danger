// Procedural pixel art drawn at logical resolution then Scale2x'd to 2× physical.
// Logical sizes: gameplay sprites 32→64px, towers/boss 64→128px.
// All sprites use setScale(0.5) to maintain the same world-space dimensions.
// Every frame is registered as its own texture and animations reference them
// in order via registerAnimations().

import Phaser from 'phaser';

type Put = (x: number, y: number, c: string | null) => void;

// ------------------------------------------------------------------
//  Palette
// ------------------------------------------------------------------
const P = {
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

  // Forest boss (Ent)
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
  entEyeD: '#208020'
};

// ------------------------------------------------------------------
//  Draw helpers
// ------------------------------------------------------------------

// Resolution scale — every sprite is drawn at logical res then Scale2x'd to 2× physical
const S = 2;

// Scale2x pixel-art upscaler: preserves hard edges while smoothing staircase diagonals
function pxIdx(w: number, x: number, y: number) { return (y * w + x) * 4; }
function pxEq(d: Uint8ClampedArray, w: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const i = pxIdx(w, x1, y1), j = pxIdx(w, x2, y2);
  return d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2] && d[i + 3] === d[j + 3];
}
function pxCopy(s: Uint8ClampedArray, sw: number, sx: number, sy: number,
                d: Uint8ClampedArray, dw: number, dx: number, dy: number) {
  const si = pxIdx(sw, sx, sy), di = pxIdx(dw, dx, dy);
  d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
}
function scale2x(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number) {
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

function makeCanvas(size: number, draw: (put: Put) => void): HTMLCanvasElement {
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

function rect(put: Put, x: number, y: number, w: number, h: number, c: string | null) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c);
}
function disc(put: Put, cx: number, cy: number, r: number, c: string | null) {
  const r2 = r * r + r * 0.4;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r2) put(cx + x, cy + y, c);
}
function ring(put: Put, cx: number, cy: number, r: number, c: string | null) {
  const outer = r * r + r * 0.4;
  const inner = (r - 1) * (r - 1) + (r - 1) * 0.4;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= outer && d > inner) put(cx + x, cy + y, c);
    }
}
function line(put: Put, x0: number, y0: number, x1: number, y1: number, c: string) {
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
function ellipse(put: Put, cx: number, cy: number, rx: number, ry: number, c: string | null) {
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) put(cx + x, cy + y, c);
}
function flashOverlay(put: Put, size: number, within: (x: number, y: number) => boolean) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (within(x, y)) put(x, y, P.white);
}

// ==================================================================
//  PLAYER (32x32) — top-down blue-clad hero, 16px wide body
// ==================================================================
type PFrame = 'idle0'|'idle1'|'move0'|'move1'|'move2'|'move3'|'shoot0'|'shoot1'|'hit';

function drawPlayer(frame: PFrame) {
  return (put: Put) => {
    const cx = 16;
    const bob = frame === 'idle1' ? 1 : 0;

    // ----- shadow ellipse under feet
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(cx + dx, 28 + dy, P.shadow);

    // ----- legs
    let lLeftY = 0, lRightY = 0;
    if (frame === 'move0') { lLeftY = -1; lRightY = 1; }
    if (frame === 'move2') { lLeftY = 1; lRightY = -1; }
    if (frame === 'move1' || frame === 'move3') { /* center */ }
    // left leg
    rect(put, cx - 4, 22 + lLeftY, 3, 5, P.blueD);
    rect(put, cx - 4, 27 + lLeftY, 3, 1, P.outline); // boot
    // right leg
    rect(put, cx + 1, 22 + lRightY, 3, 5, P.blueD);
    rect(put, cx + 1, 27 + lRightY, 3, 1, P.outline);

    // ----- torso (tunic) -----
    const torsoY = 13 + bob;
    rect(put, cx - 6, torsoY, 12, 9, P.blue);
    // highlight band along top + left shoulder
    rect(put, cx - 6, torsoY, 12, 1, P.blueL);
    rect(put, cx - 6, torsoY + 1, 1, 8, P.blueM);
    rect(put, cx + 5, torsoY + 1, 1, 8, P.blueD);
    rect(put, cx - 5, torsoY + 8, 10, 1, P.blueD);
    // belt
    rect(put, cx - 6, torsoY + 6, 12, 1, P.woodD);
    put(cx, torsoY + 6, P.goldL); // buckle
    // chest strap
    rect(put, cx - 2, torsoY + 1, 4, 1, P.blueL);

    // ----- shoulder stubs (arms are on the bow sprite) -----
    const armY = torsoY + 2;
    // left shoulder nub
    rect(put, cx - 7, armY, 2, 3, P.blue);
    put(cx - 7, armY, P.blueL);
    // right shoulder nub
    rect(put, cx + 5, armY, 2, 3, P.blue);
    put(cx + 6, armY, P.blueL);

    // ----- head -----
    const headCx = cx, headCy = 9 + bob;
    disc(put, headCx, headCy, 4, P.skin);
    // hair cap
    for (let y = -4; y <= -1; y++)
      for (let x = -4; x <= 4; x++)
        if (x * x + y * y <= 16) put(headCx + x, headCy + y, P.woodD);
    // hair highlight
    put(headCx - 2, headCy - 3, P.wood);
    put(headCx - 1, headCy - 4, P.wood);
    // eyes
    put(headCx - 2, headCy, P.outline);
    put(headCx + 1, headCy, P.outline);
    // mouth
    put(headCx, headCy + 2, P.skinD);
    // chin shadow
    put(headCx - 1, headCy + 3, P.skinD);
    put(headCx + 1, headCy + 3, P.skinD);
    // neck
    rect(put, cx - 1, headCy + 4, 3, 1, P.skinD);

    // ----- hit flash overlay (white-out) -----
    if (frame === 'hit') {
      for (let y = 5; y < 30; y++) {
        for (let x = 4; x < 28; x++) {
          // can't easily re-test silhouette; do a simple body-area flash
          if (y >= headCy - 4 && y <= 29 && x >= cx - 8 && x <= cx + 8) put(x, y, P.white);
        }
      }
    }
  };
}

// ==================================================================
//  BOW (32x32) — separate rotatable weapon sprite
//  Drawn pointing right. Origin set to (0.25, 0.5) = grip area at ~(8, 16).
// ==================================================================
function drawBow(shooting: boolean) {
  return (put: Put) => {
    const gx = 8, gy = 16; // grip / pivot point

    // ===== BACK ARM (string hand) =====
    // Extends from body (left) to the string pull point
    const stringPullX = shooting ? gx - 4 : gx;
    // upper arm from shoulder area
    rect(put, gx - 6, gy - 1, 2, 3, P.blue);
    put(gx - 6, gy - 1, P.blueL);
    // forearm reaching to string
    const backArmLen = Math.abs(stringPullX - (gx - 4));
    for (let x = gx - 4; x >= stringPullX; x--) {
      rect(put, x, gy - 1, 1, 3, P.blueM);
    }
    // string hand
    rect(put, stringPullX - 1, gy - 1, 2, 3, P.skin);
    put(stringPullX - 1, gy + 1, P.skinD);

    // ===== FRONT ARM (bow hand) =====
    // Extends from body (left) out to the grip
    // upper arm
    rect(put, gx - 6, gy - 2, 2, 3, P.blue);
    put(gx - 6, gy - 2, P.blueL);
    // forearm
    rect(put, gx - 4, gy - 2, 4, 3, P.blueM);
    rect(put, gx - 4, gy - 2, 4, 1, P.blueL);
    // grip hand
    rect(put, gx, gy - 2, 3, 4, P.skin);
    put(gx, gy - 2, P.skinL);
    put(gx + 2, gy + 1, P.skinD);

    // ===== BOW (wooden arc) =====
    for (let y = -10; y <= 10; y++) {
      const curve = Math.round(y * y * 0.04);
      const bx = gx + 4 - curve;
      put(bx + 1, gy + y, P.woodD);
      put(bx, gy + y, P.wood);
      put(bx - 1, gy + y, P.woodL);
    }
    // Limb tips (steel caps)
    rect(put, gx + 3, gy - 10, 2, 2, P.steel);
    rect(put, gx + 3, gy + 9, 2, 2, P.steel);

    // ===== BOWSTRING =====
    for (let y = -9; y <= 9; y++) {
      const pull = shooting ? Math.round((1 - (y * y) / 81) * 4) : 0;
      put(gx + 1 - pull, gy + y, P.stoneL);
    }

    // ===== ARROW =====
    const arrowStartX = shooting ? gx - 4 : gx + 1;
    for (let x = arrowStartX; x <= gx + 14; x++) {
      put(x, gy, P.arrowD);
    }
    // arrowhead
    put(gx + 15, gy, P.steel);
    put(gx + 16, gy - 1, P.steel);
    put(gx + 16, gy, P.steel);
    put(gx + 16, gy + 1, P.steel);
    // fletching
    put(arrowStartX, gy - 1, P.white);
    put(arrowStartX, gy + 1, P.white);
    put(arrowStartX - 1, gy - 1, P.white);
    put(arrowStartX - 1, gy + 1, P.white);

    // Muzzle flash when shooting
    if (shooting) {
      put(gx + 17, gy, P.sparkL);
      put(gx + 18, gy - 1, P.spark);
      put(gx + 18, gy + 1, P.spark);
    }
  };
}

// ==================================================================
//  ENEMY BASIC (32x32) — small fast red goblin
// ==================================================================
type EFrame = 'move0'|'move1'|'move2'|'move3'|'atk0'|'atk1'|'hit'|'die0'|'die1'|'die2'|'die3';

function drawEnemyBasic(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.red);
      disc(put, 16, 18, Math.max(0, r - 1), P.redL);
      // splat debris
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        const px = Math.round(16 + Math.cos(a) * d);
        const py = Math.round(18 + Math.sin(a) * d);
        put(px, py, P.redD);
        put(px + 1, py, P.red);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.red;
    const bodyD = flash ? P.white : P.redD;
    const bodyM = flash ? P.white : P.redM;
    const bodyL = flash ? P.white : P.redL;

    // ----- shadow -----
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // ----- feet (tiny claws) -----
    let footY = 0;
    if (f === 'move1') footY = -1;
    if (f === 'move3') footY = 1;
    rect(put, 11, 25 + footY, 3, 2, bodyD);
    rect(put, 18, 25 - footY, 3, 2, bodyD);
    put(10, 26 + footY, P.outline);
    put(21, 26 - footY, P.outline);
    put(13, 27 + footY, P.outline);
    put(18, 27 - footY, P.outline);

    // ----- body (round with spines) -----
    disc(put, 16, 17, 8, bodyD);
    disc(put, 16, 17, 7, body);
    disc(put, 16, 16, 5, bodyL);
    // back spines
    put(10, 12, P.outline); put(11, 11, bodyD);
    put(13, 10, P.outline); put(14, 9, bodyD);
    put(18, 9, P.outline); put(19, 10, bodyD);
    put(21, 11, P.outline); put(22, 12, bodyD);

    // ----- face area -----
    // eyes
    put(12, 16, P.white); put(13, 16, P.white);
    put(19, 16, P.white); put(20, 16, P.white);
    put(12, 16, P.outline); put(20, 16, P.outline);
    // brow
    rect(put, 11, 15, 3, 1, bodyM);
    rect(put, 18, 15, 3, 1, bodyM);
    // fangs / mouth
    if (f === 'atk0') {
      rect(put, 13, 19, 6, 2, P.outline);
      put(14, 20, P.white); put(17, 20, P.white);
    } else if (f === 'atk1') {
      rect(put, 13, 18, 6, 4, P.outline);
      put(14, 19, P.white); put(17, 19, P.white);
      put(15, 21, P.white); put(16, 21, P.white);
    } else {
      rect(put, 14, 19, 4, 1, P.outline);
      put(14, 20, P.white); put(17, 20, P.white);
    }

    // little arms/claws
    put(7, 18, bodyD); put(8, 19, bodyD); put(8, 18, body);
    put(25, 18, bodyD); put(24, 19, bodyD); put(24, 18, body);
  };
}

// ==================================================================
//  ENEMY HEAVY (32x32) — bigger dark-red armored brute
// ==================================================================
function drawEnemyHeavy(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.heavy);
      disc(put, 16, 18, Math.max(0, r - 1), P.heavyL);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.3;
        const d = step * 3 + 4;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.heavyD);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.heavy;
    const bodyD = flash ? P.white : P.heavyD;
    const bodyM = flash ? P.white : P.heavyM;
    const bodyL = flash ? P.white : P.heavyL;

    // shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -8; dx <= 8; dx++)
        if ((dx * dx) / 64 + (dy * dy) / 1.5 <= 1) put(16 + dx, 29 + dy, P.shadow);

    // feet (heavy stompers)
    let footY = 0;
    if (f === 'move1') footY = -1;
    if (f === 'move3') footY = 1;
    rect(put, 9, 26 + footY, 5, 3, bodyD);
    rect(put, 18, 26 - footY, 5, 3, bodyD);
    rect(put, 9, 28 + footY, 5, 1, P.outline);
    rect(put, 18, 28 - footY, 5, 1, P.outline);

    // main body
    disc(put, 16, 17, 10, bodyD);
    disc(put, 16, 17, 9, body);
    disc(put, 16, 16, 7, bodyL);
    // armor plates
    rect(put, 10, 18, 12, 1, bodyD);
    rect(put, 10, 21, 12, 1, bodyD);
    rect(put, 14, 13, 4, 1, bodyD);
    // rivets
    put(11, 18, P.steel); put(15, 18, P.steel); put(20, 18, P.steel);
    put(11, 21, P.steel); put(15, 21, P.steel); put(20, 21, P.steel);

    // horns
    put(9, 8, P.outline); put(10, 9, bodyD); put(11, 10, body);
    put(23, 8, P.outline); put(22, 9, bodyD); put(21, 10, body);

    // glowing eyes
    put(11, 14, P.redL); put(12, 14, P.white);
    put(20, 14, P.white); put(21, 14, P.redL);
    put(11, 15, P.redD); put(21, 15, P.redD);

    // tusks / mouth
    if (f === 'atk0' || f === 'atk1') {
      rect(put, 12, 18, 9, 3, P.outline);
      put(12, 20, P.white); put(14, 20, P.white); put(17, 20, P.white); put(19, 20, P.white);
      if (f === 'atk1') put(16, 21, P.red);
    } else {
      rect(put, 13, 19, 7, 1, P.outline);
      put(13, 20, P.white);
      put(19, 20, P.white);
    }

    // big shoulders
    rect(put, 5, 15, 3, 3, bodyD);
    rect(put, 24, 15, 3, 3, bodyD);
    put(6, 15, bodyM);
    put(25, 15, bodyM);
  };
}

// ==================================================================
//  INFECTED BASIC (32x32) — purple infected variant of basic enemy
// ==================================================================
function drawEnemyInfectedBasic(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.infect);
      disc(put, 16, 18, Math.max(0, r - 1), P.infectL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        const px = Math.round(16 + Math.cos(a) * d);
        const py = Math.round(18 + Math.sin(a) * d);
        put(px, py, P.infectD);
        put(px + 1, py, P.infect);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.infect;
    const bodyD = flash ? P.white : P.infectD;
    const bodyM = flash ? P.white : P.infectM;
    const bodyL = flash ? P.white : P.infectL;

    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    let footY = 0;
    if (f === 'move1') footY = -1;
    if (f === 'move3') footY = 1;
    rect(put, 11, 25 + footY, 3, 2, bodyD);
    rect(put, 18, 25 - footY, 3, 2, bodyD);
    put(10, 26 + footY, P.outline);
    put(21, 26 - footY, P.outline);
    put(13, 27 + footY, P.outline);
    put(18, 27 - footY, P.outline);

    disc(put, 16, 17, 8, bodyD);
    disc(put, 16, 17, 7, body);
    disc(put, 16, 16, 5, bodyL);
    // pustules instead of spines
    put(10, 12, '#40e060'); put(11, 11, bodyD);
    put(13, 10, '#40e060'); put(14, 9, bodyD);
    put(18, 9, '#40e060'); put(19, 10, bodyD);
    put(21, 11, '#40e060'); put(22, 12, bodyD);

    // glowing yellow-green eyes
    put(12, 16, '#e0ff40'); put(13, 16, '#e0ff40');
    put(19, 16, '#e0ff40'); put(20, 16, '#e0ff40');
    put(12, 16, P.outline); put(20, 16, P.outline);
    rect(put, 11, 15, 3, 1, bodyM);
    rect(put, 18, 15, 3, 1, bodyM);

    if (f === 'atk0') {
      rect(put, 13, 19, 6, 2, P.outline);
      put(14, 20, '#40e060'); put(17, 20, '#40e060');
    } else if (f === 'atk1') {
      rect(put, 13, 18, 6, 4, P.outline);
      put(14, 19, '#40e060'); put(17, 19, '#40e060');
      put(15, 21, '#40e060'); put(16, 21, '#40e060');
    } else {
      rect(put, 14, 19, 4, 1, P.outline);
      put(14, 20, '#40e060'); put(17, 20, '#40e060');
    }

    put(7, 18, bodyD); put(8, 19, bodyD); put(8, 18, body);
    put(25, 18, bodyD); put(24, 19, bodyD); put(24, 18, body);
  };
}

// ==================================================================
//  INFECTED HEAVY (32x32) — orange infected armored brute
// ==================================================================
function drawEnemyInfectedHeavy(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.infectH);
      disc(put, 16, 18, Math.max(0, r - 1), P.infectHL);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.3;
        const d = step * 3 + 4;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.infectHD);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.infectH;
    const bodyD = flash ? P.white : P.infectHD;
    const bodyM = flash ? P.white : P.infectHM;
    const bodyL = flash ? P.white : P.infectHL;

    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -8; dx <= 8; dx++)
        if ((dx * dx) / 64 + (dy * dy) / 1.5 <= 1) put(16 + dx, 29 + dy, P.shadow);

    let footY = 0;
    if (f === 'move1') footY = -1;
    if (f === 'move3') footY = 1;
    rect(put, 9, 26 + footY, 5, 3, bodyD);
    rect(put, 18, 26 - footY, 5, 3, bodyD);
    rect(put, 9, 28 + footY, 5, 1, P.outline);
    rect(put, 18, 28 - footY, 5, 1, P.outline);

    disc(put, 16, 17, 10, bodyD);
    disc(put, 16, 17, 9, body);
    disc(put, 16, 16, 7, bodyL);
    // infected plates with green ooze
    rect(put, 10, 18, 12, 1, bodyD);
    rect(put, 10, 21, 12, 1, bodyD);
    rect(put, 14, 13, 4, 1, bodyD);
    put(11, 18, '#40e060'); put(15, 18, '#40e060'); put(20, 18, '#40e060');
    put(11, 21, '#40e060'); put(15, 21, '#40e060'); put(20, 21, '#40e060');

    // horns with green tips
    put(9, 8, '#40e060'); put(10, 9, bodyD); put(11, 10, body);
    put(23, 8, '#40e060'); put(22, 9, bodyD); put(21, 10, body);

    // glowing yellow-green eyes
    put(11, 14, '#e0ff40'); put(12, 14, '#e0ff40');
    put(20, 14, '#e0ff40'); put(21, 14, '#e0ff40');
    put(11, 15, bodyD); put(21, 15, bodyD);

    if (f === 'atk0' || f === 'atk1') {
      rect(put, 12, 18, 9, 3, P.outline);
      put(12, 20, '#40e060'); put(14, 20, '#40e060'); put(17, 20, '#40e060'); put(19, 20, '#40e060');
      if (f === 'atk1') put(16, 21, P.infect);
    } else {
      rect(put, 13, 19, 7, 1, P.outline);
      put(13, 20, '#40e060');
      put(19, 20, '#40e060');
    }

    rect(put, 5, 15, 3, 3, bodyD);
    rect(put, 24, 15, 3, 3, bodyD);
    put(6, 15, bodyM);
    put(25, 15, bodyM);
  };
}

// ==================================================================
//  ENEMY WOLF (32x32) — fast grey pack hunter
// ==================================================================
function drawEnemyWolf(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.wolf);
      disc(put, 16, 18, Math.max(0, r - 1), P.wolfL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.wolfD);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.wolf;
    const bodyD = flash ? P.white : P.wolfD;
    const bodyM = flash ? P.white : P.wolfM;
    const bodyL = flash ? P.white : P.wolfL;

    // shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // tail (bushy, curves up)
    let tailY = 0;
    if (f === 'move1' || f === 'move3') tailY = 1;
    put(6, 14 + tailY, bodyD); put(5, 13 + tailY, bodyM); put(4, 12 + tailY, body);
    put(4, 11 + tailY, bodyL); put(5, 11 + tailY, body);

    // hind legs
    let footY = 0;
    if (f === 'move1') footY = -1;
    if (f === 'move3') footY = 1;
    rect(put, 9, 24 + footY, 3, 3, bodyD);
    rect(put, 19, 24 - footY, 3, 3, bodyD);
    put(9, 26 + footY, P.outline);
    put(11, 26 + footY, P.outline);
    put(19, 26 - footY, P.outline);
    put(21, 26 - footY, P.outline);

    // body (elongated oval)
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -8; dx <= 8; dx++)
        if ((dx * dx) / 64 + (dy * dy) / 25 <= 1)
          put(16 + dx, 18 + dy, bodyD);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if ((dx * dx) / 49 + (dy * dy) / 16 <= 1)
          put(16 + dx, 18 + dy, body);
    // belly highlight
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if ((dx * dx) / 25 + (dy * dy) / 4 <= 1)
          put(16 + dx, 17 + dy, bodyL);

    // head (snout pointing right)
    disc(put, 22, 15, 4, bodyD);
    disc(put, 22, 15, 3, body);
    disc(put, 22, 14, 2, bodyL);
    // snout
    rect(put, 25, 15, 4, 2, bodyM);
    rect(put, 26, 15, 3, 2, bodyL);

    // ears (pointed)
    put(20, 10, bodyD); put(21, 10, body); put(21, 9, bodyL);
    put(24, 10, bodyD); put(23, 10, body); put(23, 9, bodyL);

    // eyes
    put(21, 14, P.outline); put(24, 14, P.outline);
    put(21, 13, bodyL); put(24, 13, bodyL);

    // mouth / fangs
    if (f === 'atk0' || f === 'atk1') {
      rect(put, 26, 17, 3, 2, P.outline);
      put(27, 17, P.white); put(28, 17, P.white);
      if (f === 'atk1') put(27, 18, P.red);
    } else {
      put(27, 17, P.outline); put(28, 17, P.outline);
    }
  };
}

// ==================================================================
//  ENEMY BEAR (32x32) — tanky brown brute
// ==================================================================
// Bear frame type — Option C Bulky Brute, 8-frame walk, 5-frame attack
type BearFrame =
  | 'move0' | 'move1' | 'move2' | 'move3' | 'move4' | 'move5' | 'move6' | 'move7'
  | 'atk0' | 'atk1' | 'atk2' | 'atk3' | 'atk4'
  | 'hit'
  | 'die0' | 'die1' | 'die2' | 'die3';

const bearFrames: BearFrame[] = [
  'move0','move1','move2','move3','move4','move5','move6','move7',
  'atk0','atk1','atk2','atk3','atk4',
  'hit',
  'die0','die1','die2','die3'
];

// Warm bear palette (Option C)
const PB = {
  outline: '#000000',
  body:    '#C1673D',
  bodyD:   '#9E5533',
  bodyM:   '#D27549',
  bodyL:   '#DF9F7E',
  nose:    '#4A2311',
  eye:     '#ff2222',
  mouth:   '#4a1008',
};

// Draw bear facing RIGHT — Option C Bulky Brute style
function drawBearRight(f: BearFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, PB.body);
      disc(put, 16, 18, Math.max(0, r - 1), PB.bodyM);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.3;
        const d = step * 3 + 4;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), PB.bodyD);
      }
      return;
    }

    const flash = f === 'hit';
    const o  = flash ? P.white : PB.outline;
    const b  = flash ? P.white : PB.body;
    const bd = flash ? P.white : PB.bodyD;
    const bm = flash ? P.white : PB.bodyM;
    const bl = flash ? P.white : PB.bodyL;

    // Walk params
    const isMove = f.startsWith('move');
    const moveIdx = isMove ? parseInt(f.slice(4)) : 0;
    const phase = isMove ? (moveIdx / 8) * Math.PI * 2 : 0;
    const bodyBob = isMove ? Math.round(Math.sin(phase * 2) * 1) : 0;
    // Leg offsets — sinusoidal, front/back pairs offset by half cycle
    const fl = isMove ? Math.round(Math.sin(phase) * 3) : 0;
    const fr = isMove ? Math.round(Math.sin(phase + Math.PI) * 3) : 0;
    const blg = isMove ? Math.round(Math.sin(phase + Math.PI) * 3) : 0;
    const br = isMove ? Math.round(Math.sin(phase) * 3) : 0;

    // Attack params: 0=windup, 1=lunge, 2=bite, 3=hold, 4=recover
    const isAtk = f.startsWith('atk');
    const atkStage = isAtk ? parseInt(f.slice(3)) : -1;
    const headLunge = atkStage === 1 ? 3 : atkStage === 2 ? 4 : atkStage === 3 ? 2 : atkStage === 0 ? -1 : 0;
    const jawOpen = atkStage >= 1 && atkStage <= 3;
    const bigBite = atkStage === 2;
    const bodyRecoil = atkStage === 0 ? 1 : atkStage === 4 ? -1 : 0;

    const by = 18 + bodyBob + bodyRecoil;

    // Shadow
    for (let dx = -10; dx <= 10; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if ((dx * dx) / 100 + (dy * dy) / 1 <= 1) put(16 + dx, 29 + dy, P.shadow);

    // === FAR LEGS (behind body, darker) ===
    // Far back leg
    rect(put, 7, by + 5 + blg, 5, 6, o); rect(put, 8, by + 6 + blg, 3, 4, bd);
    // Far front leg
    rect(put, 20 + headLunge, by + 5 + fl, 5, 6, o); rect(put, 21 + headLunge, by + 6 + fl, 3, 4, bd);

    // === BODY — big oval ===
    for (let y = -8; y <= 7; y++)
      for (let x = -12; x <= 10; x++)
        if ((x * x) / 144 + (y * y) / 64 <= 1) put(16 + x, by + y, o);
    for (let y = -7; y <= 6; y++)
      for (let x = -11; x <= 9; x++)
        if ((x * x) / 121 + (y * y) / 49 <= 1) put(16 + x, by + y, bd);
    for (let y = -6; y <= 5; y++)
      for (let x = -10; x <= 8; x++)
        if ((x * x) / 100 + (y * y) / 36 <= 1) put(16 + x, by + y, b);
    // Upper highlight
    for (let y = -5; y <= -1; y++)
      for (let x = -8; x <= 2; x++)
        if ((x * x) / 64 + (y * y) / 25 <= 1) put(15 + x, by - 1 + y, bm);

    // === NEAR LEGS (in front of body, lighter) ===
    // Near back leg
    rect(put, 10, by + 5 + br, 5, 6, o); rect(put, 11, by + 6 + br, 3, 4, b);
    put(11, by + 6 + br, bm); put(12, by + 6 + br, bm);
    // Near front leg
    rect(put, 18 + headLunge, by + 5 + fr, 5, 6, o); rect(put, 19 + headLunge, by + 6 + fr, 3, 4, b);
    put(19 + headLunge, by + 6 + fr, bm); put(20 + headLunge, by + 6 + fr, bm);

    // === HEAD ===
    const hx = 24 + headLunge, hy = by - 5;
    disc(put, hx, hy, 5, o);
    disc(put, hx, hy, 4, bd);
    disc(put, hx, hy, 3, b);
    disc(put, hx + 1, hy - 1, 2, bm);
    // Ears
    disc(put, hx - 2, hy - 5, 2, o); put(hx - 2, hy - 5, bd);
    disc(put, hx + 2, hy - 5, 2, o); put(hx + 2, hy - 5, bd);
    // Snout
    rect(put, hx + 4, hy - 1, 3, 3, o);
    rect(put, hx + 4, hy, 2, 2, bl);
    put(hx + 6, hy, flash ? P.white : PB.nose); // nose
    // Eye
    put(hx + 1, hy - 2, flash ? P.white : PB.eye);

    // Mouth
    if (jawOpen) {
      const jawH = bigBite ? 3 : 2;
      rect(put, hx + 3, hy + 2, 5, jawH, o);
      rect(put, hx + 4, hy + 2, 3, jawH - 1, flash ? P.white : PB.mouth);
      // Upper fangs
      put(hx + 4, hy + 2, P.white);
      put(hx + 6, hy + 2, P.white);
      // Lower fangs on big bite
      if (bigBite) {
        put(hx + 4, hy + 4, P.white);
        put(hx + 6, hy + 4, P.white);
      }
    } else {
      rect(put, hx + 3, hy + 2, 4, 1, o);
      if (atkStage === 0) {
        // Snarl on windup
        put(hx + 4, hy + 3, P.white); put(hx + 6, hy + 3, P.white);
      }
    }

    // Tail stub
    put(3 - bodyRecoil, by - 2, bd);
    put(2 - bodyRecoil, by - 3, bd);
  };
}

// Mirror a canvas horizontally for left-facing version
function mirrorCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.translate(dst.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return dst;
}

// Extract a 32x32 cell from the bear sprite sheet, strip grey bg, return canvas
function extractBearCell(sheet: HTMLCanvasElement | HTMLImageElement, row: number, col: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(sheet, col * 32, row * 32, 32, 32, 0, 0, 32, 32);
  // Strip grey background (#4D4D4D) — make transparent
  const id = ctx.getImageData(0, 0, 32, 32);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Match the grey bg (77,77,77) with some tolerance
    if (Math.abs(r - 77) < 8 && Math.abs(g - 77) < 8 && Math.abs(b - 77) < 8) {
      d[i + 3] = 0; // make transparent
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

// Scale2x upscale a small canvas (for consistency with other sprites)
function scale2xCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const sw = src.width, sh = src.height;
  const dst = document.createElement('canvas');
  dst.width = sw * 2; dst.height = sh * 2;
  const ctx = dst.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, sw * 2, sh * 2);
  return dst;
}

// Extract all bear frames from the loaded spritesheet and register as textures
function extractBearFrames(scene: Phaser.Scene) {
  const sheetTex = scene.textures.get('bearsheet');
  const sheetImg = sheetTex.getSourceImage() as HTMLImageElement;

  // Frame map: spritesheet [row, col] -> animation frame
  // Walk right: row1-col0, row1-col2, row2-col2, row2-col3 (4 frames)
  const walkRight: [number, number][] = [[1,0], [1,2], [2,2], [2,3]];
  // Walk left: row1-col1, row1-col3, row2-col1, row2-col0 (4 frames)
  const walkLeft: [number, number][] = [[1,1], [1,3], [2,1], [2,0]];
  // Attack right: row3-col0 (rear up), row0-col2 (mid), row3-col2 (lunge) (3 frames)
  const atkRight: [number, number][] = [[3,0], [0,2], [3,2]];
  // Attack left: row3-col3 (rear up), row0-col1 (mid), row3-col1 (lunge) (3 frames)
  const atkLeft: [number, number][] = [[3,3], [0,1], [3,1]];
  // Hit: row0-col0 (standing front)
  const hitFrame: [number, number] = [0,0];

  // Extract, scale, and register each frame
  const reg = (key: string, row: number, col: number) => {
    const cell = extractBearCell(sheetImg, row, col);
    const scaled = scale2xCanvas(cell);
    add(scene, key, scaled);
  };

  // Walk right frames
  walkRight.forEach((rc, i) => reg(`ear_move${i}`, rc[0], rc[1]));
  // Duplicate as move4-7 for an 8-frame cycle (ping-pong: 0,1,2,3,2,1,0,3)
  reg('ear_move4', walkRight[2][0], walkRight[2][1]);
  reg('ear_move5', walkRight[1][0], walkRight[1][1]);
  reg('ear_move6', walkRight[0][0], walkRight[0][1]);
  reg('ear_move7', walkRight[3][0], walkRight[3][1]);

  // Walk left frames
  walkLeft.forEach((rc, i) => reg(`eal_move${i}`, rc[0], rc[1]));
  reg('eal_move4', walkLeft[2][0], walkLeft[2][1]);
  reg('eal_move5', walkLeft[1][0], walkLeft[1][1]);
  reg('eal_move6', walkLeft[0][0], walkLeft[0][1]);
  reg('eal_move7', walkLeft[3][0], walkLeft[3][1]);

  // Attack right frames
  atkRight.forEach((rc, i) => reg(`ear_atk${i}`, rc[0], rc[1]));
  // Pad to 5 frames: hold + recover
  reg('ear_atk3', atkRight[2][0], atkRight[2][1]); // hold = repeat lunge
  reg('ear_atk4', atkRight[0][0], atkRight[0][1]); // recover = back to rear

  // Attack left frames
  atkLeft.forEach((rc, i) => reg(`eal_atk${i}`, rc[0], rc[1]));
  reg('eal_atk3', atkLeft[2][0], atkLeft[2][1]);
  reg('eal_atk4', atkLeft[0][0], atkLeft[0][1]);

  // Hit frame (same for both directions)
  reg('ear_hit', hitFrame[0], hitFrame[1]);
  reg('eal_hit', hitFrame[0], hitFrame[1]);

  // Die frames — use procedural (the bear dissolves, direction doesn't matter)
  for (let i = 0; i < 4; i++) {
    const rightCanvas = makeCanvas(32, drawBearRight(`die${i}` as BearFrame));
    add(scene, `ear_die${i}`, rightCanvas);
    add(scene, `eal_die${i}`, rightCanvas);
  }
}

// ==================================================================
//  ENEMY SPIDER (32x32) — dark arachnid with red eyes
// ==================================================================
function drawEnemySpider(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 6 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, P.spider);
      disc(put, 16, 18, Math.max(0, r - 1), P.spiderL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.spiderD);
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : P.spider;
    const bodyD = flash ? P.white : P.spiderD;
    const bodyM = flash ? P.white : P.spiderM;
    const bodyL = flash ? P.white : P.spiderL;
    const eye = flash ? P.white : P.spiderEye;

    // shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if ((dx * dx) / 49 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // legs — 4 per side, animated
    const legStep = (f === 'move1' || f === 'move3') ? 1 : 0;
    const legAngles = [-0.8, -0.3, 0.2, 0.7]; // spread angles
    for (let i = 0; i < 4; i++) {
      const a = legAngles[i];
      const flip = (i + legStep) % 2 === 0 ? 1 : -1;
      // Left leg
      const lx1 = 16 - 5, ly1 = 18 + Math.round(a * 6);
      const lx2 = lx1 - 6, ly2 = ly1 + flip * 3;
      put(lx1, ly1, bodyD); put(lx1 - 1, ly1, bodyM);
      put(lx2, ly2, bodyD); put(lx2 + 1, ly2, bodyM);
      put(lx2 - 1, ly2 + 1, P.outline); // foot
      // Right leg
      const rx1 = 16 + 5, ry1 = 18 + Math.round(a * 6);
      const rx2 = rx1 + 6, ry2 = ry1 + flip * 3;
      put(rx1, ry1, bodyD); put(rx1 + 1, ry1, bodyM);
      put(rx2, ry2, bodyD); put(rx2 - 1, ry2, bodyM);
      put(rx2 + 1, ry2 + 1, P.outline); // foot
    }

    // abdomen (rear body)
    disc(put, 16, 21, 6, bodyD);
    disc(put, 16, 21, 5, body);
    disc(put, 16, 20, 3, bodyL);
    // markings on abdomen
    put(15, 23, bodyM); put(17, 23, bodyM);
    put(16, 24, bodyM);

    // head (front)
    disc(put, 16, 14, 4, bodyD);
    disc(put, 16, 14, 3, body);
    disc(put, 16, 13, 2, bodyL);

    // eyes (4 red dots)
    put(14, 12, eye); put(18, 12, eye);
    put(13, 14, eye); put(19, 14, eye);

    // fangs
    if (f === 'atk0' || f === 'atk1') {
      put(14, 17, P.outline); put(15, 18, P.outline);
      put(18, 17, P.outline); put(17, 18, P.outline);
      if (f === 'atk1') { put(15, 19, P.red); put(17, 19, P.red); }
    } else {
      put(14, 17, P.outline); put(18, 17, P.outline);
    }
  };
}

// ==================================================================
//  TOWER (64x64) — 2x2 tile crossbow turret
// ==================================================================
function drawTowerBase(put: Put) {
  // 3/4 top-down Kingdom Rush style tower base — fills 64×64 canvas
  // Camera ~35° from above: large top surface + front face below
  // Intentionally bleeds past top edge for taller presence
  const cx = 32;
  const faceTop = 22; // where top surface ends, front face begins (shifted up)
  const faceBot = 62; // bottom of visible front
  const faceHW = 26;  // half-width of front

  // Ground shadow
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -30; dx <= 30; dx++)
      if ((dx * dx) / 900 + (dy * dy) / 25 <= 1) put(cx + dx, 60 + dy, P.shadow);

  // --- Front face (stone wall visible below the top surface) ---
  for (let y = faceTop; y < faceBot; y++) {
    const yPct = (y - faceTop) / (faceBot - faceTop);
    const hw = Math.round(faceHW + yPct * 2);
    for (let x = -hw; x <= hw; x++) {
      const t = (x + hw) / (hw * 2);
      let col: string;
      if (t < 0.07)      col = P.outline;
      else if (t < 0.2)  col = P.stoneD;
      else if (t < 0.5)  col = P.stoneM;
      else if (t < 0.78) col = P.stone;
      else if (t < 0.93) col = P.stoneL;
      else                col = P.outline;
      put(cx + x, y, col);
    }
  }
  // Bottom edge
  for (let x = -29; x <= 29; x++) put(cx + x, faceBot, P.outline);

  // Stone block seams on front
  for (let row = 0; row < 5; row++) {
    const by = faceTop + 2 + row * 6;
    if (by >= faceBot - 1) break;
    for (let x = -faceHW + 1; x < faceHW; x++) put(cx + x, by, P.stoneD);
    const off = row % 2 === 0 ? 0 : 6;
    for (let vx = -faceHW + 3 + off; vx < faceHW; vx += 11) {
      for (let dy = 0; dy < 6 && by + dy < faceBot; dy++) put(cx + vx, by + dy, P.stoneD);
    }
  }

  // Arrow slit on front
  rect(put, cx - 1, faceTop + 8, 3, 10, P.outline);
  put(cx - 2, faceTop + 13, P.outline);
  put(cx + 2, faceTop + 13, P.outline);

  // Door at base
  rect(put, cx - 4, faceBot - 10, 8, 10, P.outline);
  rect(put, cx - 3, faceBot - 9, 6, 8, '#1a1a2a');
  put(cx - 3, faceBot - 10, P.stoneM); put(cx + 2, faceBot - 10, P.stoneM);
  // Door arch
  put(cx - 2, faceBot - 11, P.stoneM); put(cx + 1, faceBot - 11, P.stoneM);

  // --- TOP SURFACE (large elliptical stone platform seen from above) ---
  ellipse(put, cx, faceTop - 1, 28, 14, P.outline);
  ellipse(put, cx, faceTop - 1, 27, 13, P.stoneD);
  ellipse(put, cx, faceTop - 2, 25, 12, P.stoneM);
  ellipse(put, cx, faceTop - 3, 21, 10, P.stone);
  // Light highlight on upper-left
  ellipse(put, cx - 4, faceTop - 7, 12, 6, P.stoneL);
  ellipse(put, cx - 6, faceTop - 9, 6, 3, P.stoneHL);

  // --- Crenellations around rim ---
  const crenCount = 10;
  for (let i = 0; i < crenCount; i++) {
    const angle = (i / crenCount) * Math.PI * 2 - Math.PI * 0.1;
    const mx = Math.round(cx + Math.cos(angle) * 26);
    const my = Math.round(faceTop - 1 + Math.sin(angle) * 12);
    // Each merlon is a small block
    rect(put, mx - 2, my - 3, 4, 4, P.outline);
    if (angle > Math.PI * 0.3 && angle < Math.PI * 1.3) {
      rect(put, mx - 1, my - 2, 3, 3, P.stoneD);
      put(mx, my - 3, P.stoneM);
    } else {
      rect(put, mx - 1, my - 2, 3, 2, P.stoneM);
      put(mx, my - 3, P.stoneL);
    }
  }

  // Inner floor (darker standing area)
  ellipse(put, cx, faceTop - 2, 18, 8, P.stoneD);
  ellipse(put, cx, faceTop - 3, 15, 6, '#4a4e58');
}

// Static ballista stand — drawn as its own sprite, does NOT rotate
function drawBallistaStand(put: Put) {
  const cx = 32, cy = 32;

  // Center post
  rect(put, cx - 2, cy - 2, 4, 12, P.outline);
  rect(put, cx - 1, cy - 1, 2, 10, P.woodD);
  put(cx - 1, cy - 1, P.woodM); put(cx, cy - 1, P.wood);
  put(cx - 1, cy, P.woodD); put(cx, cy, P.woodM);

  // Tripod legs
  line(put, cx - 1, cy + 6, cx - 7, cy + 10, P.outline);
  line(put, cx - 1, cy + 7, cx - 6, cy + 10, P.woodD);
  rect(put, cx - 8, cy + 10, 3, 2, P.outline);
  rect(put, cx - 7, cy + 10, 2, 1, P.woodM);
  line(put, cx + 1, cy + 6, cx + 7, cy + 10, P.outline);
  line(put, cx + 1, cy + 7, cx + 6, cy + 10, P.woodD);
  rect(put, cx + 6, cy + 10, 3, 2, P.outline);
  rect(put, cx + 6, cy + 10, 2, 1, P.woodM);
  line(put, cx, cy + 7, cx, cy + 11, P.outline);
  put(cx - 1, cy + 11, P.outline); put(cx + 1, cy + 11, P.outline);
  put(cx, cy + 10, P.woodM);

  // Pivot bracket (metal)
  rect(put, cx - 3, cy - 4, 6, 4, P.outline);
  rect(put, cx - 2, cy - 3, 4, 2, P.silverD);
  put(cx - 1, cy - 3, P.silverM); put(cx, cy - 3, P.silver);
  put(cx + 1, cy - 3, P.silverM);
}

// ------------------------------------------------------------------
// Tower archer — green-robed archer standing on tower, same style as player
// Static body sprite (32x32), bow is separate and rotatable
// ------------------------------------------------------------------
function drawTowerArcher(put: Put) {
  const cx = 16;

  // Shadow
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -5; dx <= 5; dx++)
      if ((dx * dx) / 25 + (dy * dy) / 1.5 <= 1) put(cx + dx, 27 + dy, P.shadow);

  // Legs
  rect(put, cx - 3, 22, 3, 4, P.tunicD);
  rect(put, cx - 3, 26, 3, 1, P.outline);
  rect(put, cx + 1, 22, 3, 4, P.tunicD);
  rect(put, cx + 1, 26, 3, 1, P.outline);

  // Torso (green tunic)
  const ty = 13;
  rect(put, cx - 5, ty, 11, 9, P.tunic);
  rect(put, cx - 5, ty, 11, 1, P.tunicL);
  rect(put, cx - 5, ty + 1, 1, 8, P.tunicL);
  rect(put, cx + 5, ty + 1, 1, 8, P.tunicD);
  rect(put, cx - 4, ty + 8, 9, 1, P.tunicD);
  // Belt
  rect(put, cx - 5, ty + 6, 11, 1, P.woodD);
  put(cx, ty + 6, P.goldL);

  // Shoulder stubs
  rect(put, cx - 6, ty + 2, 2, 3, P.tunic);
  put(cx - 6, ty + 2, P.tunicL);
  rect(put, cx + 5, ty + 2, 2, 3, P.tunic);

  // Head with hood
  const hx = cx, hy = 9;
  disc(put, hx, hy, 4, P.skin);
  // Hood
  for (let y = -4; y <= -1; y++)
    for (let x = -4; x <= 4; x++)
      if (x * x + y * y <= 16) put(hx + x, hy + y, P.hood);
  // Hood point
  put(hx, hy - 5, P.hoodD); put(hx - 1, hy - 5, P.hoodD);
  put(hx, hy - 6, P.outline);
  // Hood highlight
  put(hx - 2, hy - 3, P.tunic); put(hx - 1, hy - 4, P.tunic);
  // Face
  rect(put, hx - 2, hy, 5, 2, P.skin);
  put(hx - 2, hy, P.skinL); put(hx - 1, hy, P.skinL);
  put(hx + 1, hy, P.skinD); put(hx + 2, hy, P.skinD);
  // Eyes
  put(hx - 1, hy + 1, P.outline); put(hx + 1, hy + 1, P.outline);
  // Neck
  rect(put, cx - 1, hy + 4, 3, 1, P.skinD);

  // Quiver on back
  rect(put, cx - 4, ty + 1, 2, 6, P.woodD);
  put(cx - 4, ty + 1, P.woodM); put(cx - 3, ty + 1, P.woodM);
  // Arrow tips poking out
  put(cx - 4, ty, P.steel); put(cx - 3, ty, P.steel);
  put(cx - 4, ty - 1, P.steelD);
}

// Tower archer bow — same as player bow but green arms
function drawTowerBow(shooting: boolean) {
  return (put: Put) => {
    const gx = 8, gy = 16;

    // Back arm (string hand)
    const stringPullX = shooting ? gx - 4 : gx;
    rect(put, gx - 6, gy - 1, 2, 3, P.tunic);
    put(gx - 6, gy - 1, P.tunicL);
    for (let x = gx - 4; x >= stringPullX; x--) {
      rect(put, x, gy - 1, 1, 3, P.tunicD);
    }
    rect(put, stringPullX - 1, gy - 1, 2, 3, P.skin);
    put(stringPullX - 1, gy + 1, P.skinD);

    // Front arm (bow hand)
    rect(put, gx - 6, gy - 2, 2, 3, P.tunic);
    put(gx - 6, gy - 2, P.tunicL);
    rect(put, gx - 4, gy - 2, 4, 3, P.tunicD);
    rect(put, gx - 4, gy - 2, 4, 1, P.tunicL);
    rect(put, gx, gy - 2, 3, 4, P.skin);
    put(gx, gy - 2, P.skinL);
    put(gx + 2, gy + 1, P.skinD);

    // Bow (wooden arc)
    for (let y = -10; y <= 10; y++) {
      const curve = Math.round(y * y * 0.04);
      const bx = gx + 4 - curve;
      put(bx + 1, gy + y, P.woodD);
      put(bx, gy + y, P.wood);
      put(bx - 1, gy + y, P.woodL);
    }
    rect(put, gx + 3, gy - 10, 2, 2, P.steel);
    rect(put, gx + 3, gy + 9, 2, 2, P.steel);

    // Bowstring
    for (let y = -9; y <= 9; y++) {
      const pull = shooting ? Math.round((1 - (y * y) / 81) * 4) : 0;
      put(gx + 1 - pull, gy + y, P.stoneL);
    }

    // Arrow
    const arrowStartX = shooting ? gx - 4 : gx + 1;
    for (let x = arrowStartX; x <= gx + 14; x++) {
      put(x, gy, P.arrowD);
    }
    put(gx + 15, gy, P.steel);
    put(gx + 16, gy - 1, P.steel);
    put(gx + 16, gy, P.steel);
    put(gx + 16, gy + 1, P.steel);
    put(arrowStartX, gy - 1, P.white);
    put(arrowStartX, gy + 1, P.white);
    put(arrowStartX - 1, gy - 1, P.white);
    put(arrowStartX - 1, gy + 1, P.white);

    if (shooting) {
      put(gx + 17, gy, P.sparkL);
      put(gx + 18, gy - 1, P.spark);
      put(gx + 18, gy + 1, P.spark);
    }
  };
}

// Legacy wrapper
function drawTowerTop(shoot = false) {
  return drawTowerBow(shoot);
}

// ==================================================================
//  CANNON TURRET TOP (64x64) — fat dark cannon, pivot (32,32), aims right
// ==================================================================
// Static cannon mount / carriage — does not rotate
function drawCannonMount() {
  return (put: Put) => {
    const cx = 32, cy = 32;

    // shadow under the mount
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -12; dx <= 12; dx++)
        if ((dx * dx) / 144 + (dy * dy) / 20 <= 1) put(cx + dx, cy + 7 + dy, P.shadow);

    // trunnion mount / carriage (wide dark block)
    rect(put, cx - 9, cy + 2, 18, 6, P.outline);
    rect(put, cx - 8, cy + 2, 16, 5, P.stoneD);
    rect(put, cx - 8, cy + 2, 16, 1, P.stoneM);
    // iron bands
    rect(put, cx - 4, cy + 2, 1, 5, P.outline);
    rect(put, cx + 3,  cy + 2, 1, 5, P.outline);
    // rivets
    put(cx - 6, cy + 4, P.steel);
    put(cx + 1, cy + 4, P.steel);
    put(cx + 6, cy + 4, P.steel);

    // center mounting pin (pivot)
    disc(put, cx, cy, 3, P.outline);
    disc(put, cx, cy, 2, P.steelD);
    put(cx, cy, P.steel);
  };
}

function drawCannonTop(shoot = false) {
  return (put: Put) => {
    const cx = 32, cy = 32;

    // ----- barrel (thick dark cylinder running along x)
    // outline first
    rect(put, cx - 6, cy - 6, 28, 11, P.outline);
    // main body dark iron
    rect(put, cx - 5, cy - 5, 26, 9, P.stoneD);
    // lower shade
    rect(put, cx - 5, cy + 2, 26, 2, '#20242e');
    // top highlight stripe (cylindrical lighting)
    rect(put, cx - 4, cy - 5, 24, 1, P.stoneM);
    rect(put, cx - 3, cy - 4, 22, 1, P.stone);
    // subtle mid gleam
    rect(put, cx + 2, cy - 4, 8, 1, P.stoneL);

    // ----- breech ring (back of the barrel)
    rect(put, cx - 7, cy - 6, 2, 11, P.outline);
    rect(put, cx - 6, cy - 5, 1, 9, P.stoneM);
    // breech cap bulge
    put(cx - 8, cy - 2, P.outline);
    put(cx - 8, cy - 1, P.outline);
    put(cx - 8, cy,     P.outline);
    put(cx - 8, cy + 1, P.outline);

    // ----- reinforcing bands along the barrel
    for (const bx of [cx - 1, cx + 5, cx + 11]) {
      rect(put, bx, cy - 6, 1, 11, P.outline);
      rect(put, bx + 1, cy - 5, 1, 9, P.stoneM);
    }

    // ----- muzzle ring at the front
    rect(put, cx + 19, cy - 7, 3, 13, P.outline);
    rect(put, cx + 20, cy - 6, 2, 11, P.stoneM);
    rect(put, cx + 20, cy - 6, 2, 1,  P.stoneL);
    // barrel bore (dark hole)
    rect(put, cx + 21, cy - 3, 1, 7, P.outline);
    put(cx + 22, cy - 2, P.outline);
    put(cx + 22, cy - 1, P.outline);
    put(cx + 22, cy,     P.outline);
    put(cx + 22, cy + 1, P.outline);
    put(cx + 22, cy + 2, P.outline);

    // ----- muzzle flash + smoke when firing
    if (shoot) {
      // bright flash
      disc(put, cx + 26, cy, 4, P.sparkL);
      disc(put, cx + 26, cy, 3, P.white);
      disc(put, cx + 26, cy, 2, P.spark);
      // flash rays
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 6;
        put(Math.round(cx + 26 + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), P.spark);
      }
      // recoil puff back along barrel
      put(cx + 30, cy - 1, P.stoneL);
      put(cx + 31, cy,     P.stoneL);
      put(cx + 30, cy + 1, P.stoneL);
    }
  };
}

// ==================================================================
//  WALL (32x32) — stacked brick
// ==================================================================
// WC2-style dark fortress wall with autotiling
// Neighbor bitmask: N=1, E=2, S=4, W=8
// Wall nearly fills the tile; connected sides go edge-to-edge seamlessly
function drawWall(mask: number, damaged: boolean) {
  return (put: Put) => {
    const S = 32;
    const pad = 1;      // tiny inset on open ends (just outline room)
    const fd = 5;       // front face depth (3/4 view)

    // Colors — dark fortress palette
    const O  = '#12141e';   // outline
    const TL = '#808ca4';   // top highlight
    const T  = '#636e82';   // top surface
    const TM = '#565f72';   // top mid
    const TD = '#484f5e';   // top shadow/edge
    const F  = '#3a4050';   // front face
    const FM = '#2e3444';   // front mid
    const FD = '#222834';   // front face dark

    const hasN = !!(mask & 1);
    const hasE = !!(mask & 2);
    const hasS = !!(mask & 4);
    const hasW = !!(mask & 8);

    // Wall extents — nearly full tile, edge-to-edge on connected sides
    // When connecting south, top surface extends to tile edge (no front face)
    const l = hasW ? 0 : pad;
    const r = hasE ? S - 1 : S - 1 - pad;
    const t = hasN ? 0 : pad;
    const bTop = hasS ? S - 1 : S - 1 - pad - fd;      // bottom of top surface
    const bBot = hasS ? S - 1 : S - 1 - pad;            // bottom of front face

    // --- FRONT FACE (south-facing depth visible in 3/4 view) ---
    for (let y = bTop + 1; y <= bBot; y++) {
      for (let x = l; x <= r; x++) {
        const atL = x === l && !hasW;
        const atR = x === r && !hasE;
        const py = (y - bTop - 1) / Math.max(1, bBot - bTop - 1);
        let c: string;
        if (atL || atR) c = O;
        else if (x <= l + 1 && !hasW) c = FD;
        else if (x >= r - 1 && !hasE) c = FD;
        else if (py > 0.7) c = FD;
        else if (py < 0.2) c = F;
        else c = FM;
        put(x, y, c);
      }
    }
    // Bottom outline (only on open south side)
    if (!hasS) for (let x = l; x <= r; x++) put(x, bBot, O);

    // --- TOP SURFACE ---
    for (let y = t; y <= bTop; y++) {
      for (let x = l; x <= r; x++) {
        const atL = x === l && !hasW;
        const atR = x === r && !hasE;
        const atT = y === t && !hasN;
        const w = r - l;
        const h = bTop - t;
        const px = w > 0 ? (x - l) / w : 0.5;
        const py = h > 0 ? (y - t) / h : 0.5;
        let c: string;
        // Outlines only on open edges
        if (atL || atR || atT) c = O;
        // Lighting: top-left bright, bottom-right dark
        else if (py < 0.12 && !hasN) c = TL;
        else if (py < 0.25) c = TL;
        else if (px < 0.08 && !hasW) c = TL;
        else if (py > 0.85) c = TD;
        else if (px > 0.92 && !hasE) c = TD;
        else if (py < 0.5) c = T;
        else c = TM;
        put(x, y, c);
      }
    }

    // 1px outline on open edges (reinforce)
    if (!hasN) for (let x = l; x <= r; x++) put(x, t, O);
    if (!hasW) for (let y = t; y <= bBot; y++) put(l, y, O);
    if (!hasE) for (let y = t; y <= bBot; y++) put(r, y, O);

    // Inner border highlight/shadow (1px inside outline on open sides)
    if (!hasN) for (let x = l + 2; x <= r - 2; x++) put(x, t + 1, TL);
    if (!hasW) for (let y = t + 2; y <= bTop - 1; y++) put(l + 1, y, TL);
    if (!hasE) for (let y = t + 2; y <= bTop - 1; y++) put(r - 1, y, TD);

    // Brick seams on top surface (running bond pattern)
    const seamC = '#4e5668';
    const rowH = 8;
    for (let row = 0; row < 4; row++) {
      const sy = t + 3 + row * rowH;
      if (sy > bTop - 2) break;
      // Horizontal seam
      for (let x = l + 2; x <= r - 2; x++) put(x, sy, seamC);
      // Vertical seams (offset per row)
      const off = row % 2 === 0 ? 0 : 5;
      for (let vx = l + 4 + off; vx <= r - 2; vx += 10) {
        for (let dy = 1; dy < rowH && sy + dy <= bTop - 1; dy++) put(vx, sy + dy, seamC);
      }
    }

    // Brick seams on front face
    const fSeamC = '#283040';
    const fMidY = Math.round((bTop + 1 + bBot) / 2);
    if (bBot - bTop > 3) {
      for (let x = l + 2; x <= r - 2; x++) put(x, fMidY, fSeamC);
      for (let vx = l + 6; vx <= r - 2; vx += 10) {
        for (let y = bTop + 2; y < fMidY; y++) put(vx, y, fSeamC);
      }
      for (let vx = l + 11; vx <= r - 2; vx += 10) {
        for (let y = fMidY + 1; y < bBot - 1; y++) put(vx, y, fSeamC);
      }
    }

    if (damaged) {
      const cx = Math.round((l + r) / 2);
      const cy = Math.round((t + bTop) / 2);
      line(put, cx - 4, cy - 4, cx + 2, cy + 4, O);
      line(put, cx + 3, cy - 3, cx - 1, cy + 5, O);
      disc(put, cx + 2, cy + 1, 2, O);
      put(cx + 2, cy + 1, FD);
    }
  };
}

// ==================================================================
//  ARROW (32x32)
// ==================================================================
function drawArrow(frame: 0|1) {
  return (put: Put) => {
    const cy = 16;
    // shaft
    rect(put, 4, cy - 1, 18, 1, P.arrowD);
    rect(put, 4, cy, 18, 1, P.arrow);
    rect(put, 4, cy + 1, 18, 1, P.arrowD);

    // head (diamond)
    put(22, cy, P.steel);
    put(23, cy - 1, P.steel); put(23, cy, P.steel); put(23, cy + 1, P.steel);
    put(24, cy - 2, P.steel); put(24, cy - 1, P.white); put(24, cy, P.steel); put(24, cy + 1, P.white); put(24, cy + 2, P.steel);
    put(25, cy - 1, P.steel); put(25, cy, P.steel); put(25, cy + 1, P.steel);
    put(26, cy, P.steelD);
    // head outline
    put(23, cy - 2, P.outline); put(23, cy + 2, P.outline);
    put(25, cy - 2, P.outline); put(25, cy + 2, P.outline);
    put(27, cy, P.outline);

    // fletching
    put(3, cy - 2, P.white); put(4, cy - 2, P.white); put(5, cy - 2, P.white);
    put(3, cy + 2, P.white); put(4, cy + 2, P.white); put(5, cy + 2, P.white);
    put(2, cy - 1, P.red); put(2, cy, P.redD); put(2, cy + 1, P.red);
    put(6, cy - 2, P.redD); put(6, cy + 2, P.redD);

    if (frame === 1) {
      put(27, cy - 1, P.sparkL);
      put(28, cy, P.sparkL);
      put(27, cy + 1, P.sparkL);
    }
  };
}

// ==================================================================
//  CANNONBALL (32x32) — dark iron sphere with specular highlight
// ==================================================================
function drawCannonball(frame: 0|1) {
  return (put: Put) => {
    const cx = 16, cy = 16, r = 5;
    // Main sphere body — dark iron
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        let color: string;
        if (dist < 0.4) color = '#4a4a54';       // lighter center
        else if (dist < 0.7) color = '#333340';   // mid
        else color = '#1e1e28';                    // dark edge
        put(cx + dx, cy + dy, color);
      }
    }
    // Outline ring
    for (let dy = -(r + 1); dy <= r + 1; dy++) {
      for (let dx = -(r + 1); dx <= r + 1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + 1) * (r + 1) || d2 <= r * r) continue;
        // Only draw outline where there isn't already a sphere pixel
        const innerD = Math.sqrt(dx * dx + dy * dy);
        if (innerD > r && innerD <= r + 1.2) put(cx + dx, cy + dy, P.outline);
      }
    }
    // Specular highlight — upper-left
    const hx = cx - 2, hy = cy - 2;
    put(hx, hy, '#8888a0');
    put(hx + 1, hy, '#6a6a7a');
    put(hx, hy + 1, '#6a6a7a');
    if (frame === 0) {
      put(hx - 1, hy - 1, '#aaaabc');  // bright specular dot
    } else {
      put(hx + 1, hy - 1, '#aaaabc');  // shifted slightly for subtle spin
    }
    // Bottom rivet/seam detail
    put(cx - 1, cy + 3, '#141420');
    put(cx, cy + 3, '#141420');
    put(cx + 1, cy + 3, '#141420');
  };
}

// Cannonball shadow (32x32) — simple dark ellipse
function drawCannonballShadow() {
  return (put: Put) => {
    const cx = 16, cy = 16;
    // Ellipse: wider than tall
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const nx = dx / 4, ny = dy / 2;
        if (nx * nx + ny * ny <= 1) {
          put(cx + dx, cy + dy, P.outline);
        }
      }
    }
  };
}

// ==================================================================
//  COIN (32x32) — 6 spin frames
// ==================================================================
type CoinTier = 'bronze' | 'silver' | 'gold';
function drawCoin(frame: 0|1|2|3|4|5, tier: CoinTier = 'gold') {
  const pal = tier === 'bronze'
    ? { base: P.bronze, d: P.bronzeD, m: P.bronzeM, l: P.bronzeL }
    : tier === 'silver'
    ? { base: P.silver, d: P.silverD, m: P.silverM, l: P.silverL }
    : { base: P.gold, d: P.goldD, m: P.goldM, l: P.goldL };
  return (put: Put) => {
    const cx = 16, cy = 16;
    // shadow
    for (let dx = -5; dx <= 5; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if ((dx * dx) / 25 + (dy * dy) / 1.5 <= 1) put(cx + dx, 24 + dy, P.shadow);

    // width profile: face → edge → face
    const widths = [7, 6, 3, 1, 3, 6];
    const w = widths[frame];
    const h = 7;
    // disc body
    for (let y = -h; y <= h; y++) {
      for (let x = -w; x <= w; x++) {
        if ((x * x) / (w * w + 0.1) + (y * y) / (h * h) <= 1) {
          put(cx + x, cy + y, pal.base);
        }
      }
    }
    // outline
    for (let y = -h; y <= h; y++) {
      for (let x = -w - 1; x <= w + 1; x++) {
        if ((x * x) / ((w + 1) * (w + 1) + 0.1) + (y * y) / ((h + 0.6) * (h + 0.6)) <= 1 &&
            !((x * x) / (w * w + 0.1) + (y * y) / (h * h) <= 1)) {
          put(cx + x, cy + y, pal.d);
        }
      }
    }
    // highlight arc (upper left)
    if (w >= 3) {
      for (let y = -h + 1; y <= -2; y++) {
        for (let x = -w + 1; x <= 0; x++) {
          if ((x * x) / ((w - 1) * (w - 1) + 0.1) + (y * y) / ((h - 1) * (h - 1)) <= 1) {
            put(cx + x, cy + y, pal.l);
          }
        }
      }
    }
    // shadow arc (lower right)
    if (w >= 3) {
      for (let y = 2; y <= h - 1; y++) {
        for (let x = 1; x <= w - 1; x++) {
          if ((x * x) / ((w - 1) * (w - 1) + 0.1) + (y * y) / ((h - 1) * (h - 1)) <= 1) {
            put(cx + x, cy + y, pal.m);
          }
        }
      }
    }
    // star emblem when facing (w >= 5)
    if (w >= 5) {
      put(cx, cy - 2, pal.d);
      put(cx - 1, cy, pal.d); put(cx, cy, pal.d); put(cx + 1, cy, pal.d);
      put(cx - 2, cy + 1, pal.d); put(cx + 2, cy + 1, pal.d);
      put(cx, cy + 2, pal.d);
    }
  };
}

// ==================================================================
//  EFFECTS (32x32)
// ==================================================================
function drawHitSpark(frame: 0|1|2) {
  return (put: Put) => {
    const cx = 16, cy = 16;
    const r = 3 + frame * 2;
    disc(put, cx, cy, Math.max(1, 3 - frame), frame === 0 ? P.white : P.sparkL);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + frame * 0.25;
      const d = r;
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      put(x, y, P.sparkL);
      put(Math.round(cx + Math.cos(a) * (d - 1)), Math.round(cy + Math.sin(a) * (d - 1)), P.spark);
      put(Math.round(cx + Math.cos(a) * (d + 1)), Math.round(cy + Math.sin(a) * (d + 1)), P.white);
    }
  };
}
function drawDeathBurst(frame: 0|1|2|3|4) {
  return (put: Put) => {
    const cx = 16, cy = 16;
    const r = 3 + frame * 2;
    if (frame < 3) disc(put, cx, cy, r, P.sparkL);
    disc(put, cx, cy, Math.max(0, r - 2), frame < 2 ? P.white : P.spark);
    // shrapnel ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + frame * 0.2;
      const d = r + 3;
      const px = Math.round(cx + Math.cos(a) * d);
      const py = Math.round(cy + Math.sin(a) * d);
      put(px, py, P.red);
      put(px + 1, py, P.redD);
    }
  };
}
function drawCoinPop(frame: 0|1|2) {
  return (put: Put) => {
    const cx = 16, cy = 16;
    const r = 3 + frame * 2;
    ring(put, cx, cy, r, P.goldL);
    ring(put, cx, cy, r - 1, P.gold);
    if (frame === 0) disc(put, cx, cy, 2, P.white);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + frame * 0.3;
      const d = r + 1;
      put(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), P.goldL);
    }
  };
}

// ==================================================================
//  GROUND TILE (32x32) — noise speckle
// ==================================================================
// Dirt/earth colors
const E = {
  dirt:  '#6b5030',
  dirtD: '#4a3420',
  dirtM: '#5a4228',
  dirtL: '#8a6840',
  sand:  '#b8a070',
  sandD: '#8a7850',
};

// Multi-octave value noise to avoid banding artifacts
function wnoise(wx: number, wy: number, scale: number): number {
  const hash = (a: number, b: number) => {
    const n = ((a * 12289 + b * 51749 + 71) * 2654435761) >>> 0;
    return (n & 0xffff) / 0xffff;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  const oneOctave = (x: number, y: number, s: number) => {
    const sx = Math.floor(x / s), sy = Math.floor(y / s);
    const fx = x / s - sx, fy = y / s - sy;
    const tl = hash(sx, sy), tr = hash(sx + 1, sy);
    const bl = hash(sx, sy + 1), br = hash(sx + 1, sy + 1);
    const u = sm(fx), v = sm(fy);
    return tl * (1 - u) * (1 - v) + tr * u * (1 - v) + bl * (1 - u) * v + br * u * v;
  };
  // 3 octaves with different offsets to break patterns
  return oneOctave(wx, wy, scale) * 0.6
       + oneOctave(wx + 7777, wy + 3333, scale * 0.5) * 0.25
       + oneOctave(wx + 1234, wy + 8765, scale * 0.25) * 0.15;
}

/**
 * Precompute noise at reduced resolution and return a bilinear sampler.
 * step=4 means compute every 4th pixel → 16x fewer wnoise calls.
 */
function precomputeNoise(tileX: number, tileY: number, offsetX: number, offsetY: number, scale: number, step = 4): (px: number, py: number) => number {
  const size = 32;
  const gridW = Math.ceil(size / step) + 2; // +2 for interpolation margin
  const grid = new Float32Array(gridW * gridW);
  const baseWx = tileX * 32 + offsetX;
  const baseWy = tileY * 32 + offsetY;
  for (let gy = 0; gy < gridW; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      grid[gy * gridW + gx] = wnoise(baseWx + gx * step, baseWy + gy * step, scale);
    }
  }
  return (px: number, py: number) => {
    const fx = px / step, fy = py / step;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const ix1 = Math.min(ix + 1, gridW - 1), iy1 = Math.min(iy + 1, gridW - 1);
    const tl = grid[iy * gridW + ix], tr = grid[iy * gridW + ix1];
    const bl = grid[iy1 * gridW + ix], br = grid[iy1 * gridW + ix1];
    return tl * (1 - tx) * (1 - ty) + tr * tx * (1 - ty) + bl * (1 - tx) * ty + br * tx * ty;
  };
}

// Grasslands ground — gradient transitions between green shades like Bounty of One
// Dark green → medium green → light green → yellow-green in large smooth zones
function drawGroundWorld(tileX: number, tileY: number) {
  return (put: Put) => {
    // 4 grass shades from dark to light
    const shades = [
      [0x2a, 0x48, 0x26],
      [0x32, 0x52, 0x2e],
      [0x3c, 0x5e, 0x36],
      [0x48, 0x6a, 0x3e],
    ];
    // Pre-compute hex strings for the 4 base shades
    const shadeHex = shades.map(([r, g, b]) =>
      '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
    );
    // Lerp helper for transition bands
    const lerpCol = (a: number[], b: number[], t: number): string => {
      const r = Math.round(a[0] + (b[0] - a[0]) * t);
      const g = Math.round(a[1] + (b[1] - a[1]) * t);
      const bl = Math.round(a[2] + (b[2] - a[2]) * t);
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + bl.toString(16).padStart(2, '0');
    };

    // Per-tile RNG for small detail placement
    let s = ((tileX * 73856093 + tileY * 19349669) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    // Transition: fade-out, solid mid band, fade-in (each as fraction of shade range)
    const fadeW = 0.06;  // fade from current shade to midpoint
    const midW  = 0.03;  // thin solid band of the midpoint color
    const totalW = fadeW + midW + fadeW; // full transition zone width

    // Precompute noise at 1/4 resolution for performance
    const sampleN = precomputeNoise(tileX, tileY, 8000, 1000, 400);

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const n = sampleN(px, py);

        // Continuous position within shade space (0..4 mapped to 4 shades)
        const pos = Math.min(3.999, n * 4);
        const idx = Math.floor(pos);
        const frac = pos - idx; // 0..1 within this shade

        // Two-layer transition at boundaries between shades
        // Layout: [solid shade] [fade→mid] [solid mid] [fade→next] [solid next shade]
        const bandStart = 1 - totalW;
        if (idx < 3 && frac > bandStart) {
          const mid = shades[idx].map((c, i) => Math.round((c + shades[idx + 1][i]) / 2));
          const t = frac - bandStart; // 0..totalW
          if (t < fadeW) {
            // Fade from current shade toward midpoint
            put(px, py, lerpCol(shades[idx], mid, t / fadeW));
          } else if (t < fadeW + midW) {
            // Thin solid midpoint band
            put(px, py, lerpCol(mid, mid, 0)); // just mid color
          } else {
            // Fade from midpoint toward next shade
            put(px, py, lerpCol(mid, shades[idx + 1], (t - fadeW - midW) / fadeW));
          }
        } else {
          put(px, py, shadeHex[idx]);
        }
      }
    }

    // Scattered single flowers (0-2 per tile, ~15% of tiles)
    const flowerCount = rnd() < 0.15 ? (rnd() < 0.5 ? 1 : 2) : 0;
    const flowerColors = ['#e84060', '#e8d040', '#d070e0', '#70a0e8', '#e8a040'];
    for (let i = 0; i < flowerCount; i++) {
      const fx = 2 + Math.floor(rnd() * 28);
      const fy = 2 + Math.floor(rnd() * 28);
      const col = flowerColors[Math.floor(rnd() * flowerColors.length)];
      put(fx, fy, col);
      put(fx, fy + 1, '#1a3a18');
    }

    // Scattered single rock (0-1, ~10% of tiles)
    if (rnd() < 0.1) {
      const rx = 2 + Math.floor(rnd() * 28);
      const ry = 2 + Math.floor(rnd() * 28);
      put(rx, ry, '#7a8290');
      put(rx + 1, ry, '#6a7280');
      put(rx, ry + 1, '#5a6270');
    }

    // Rare grass tuft (~20% of tiles)
    if (rnd() < 0.2) {
      const tx = 3 + Math.floor(rnd() * 26);
      const ty = 3 + Math.floor(rnd() * 26);
      put(tx, ty, '#4a7a42');
      put(tx + 1, ty, '#4a7a42');
      put(tx, ty - 1, '#4a7a42');
    }
  };
}

// Forest ground — darker greens with brown dirt patches, leaf litter, mushrooms, moss
function drawGroundForest(tileX: number, tileY: number) {
  return (put: Put) => {
    // Forest green shades — tighter range so transitions are subtle
    const greenHex = ['#2a4626', '#2e4c2c', '#324f30', '#365434'];

    // Dirt shades — earthy browns
    const dirtHex = ['#4a3828', '#3e2e20', '#32261a'];

    let s = ((tileX * 73856093 + tileY * 19349669) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    // Per-pixel hash for dithering — use two rounds to break diagonal patterns
    const pxHash = (x: number, y: number) => {
      let h = ((x * 374761393 + y * 668265263 + 1274126177) >>> 0);
      h = ((h ^ (h >> 13)) * 1103515245 + 12345) >>> 0;
      return (h & 0xffff) / 0xffff;
    };

    // Dither zone width (fraction of shade range where mixing occurs)
    const ditherW = 0.06;

    // Precompute both noise layers at 1/4 resolution
    const sampleN = precomputeNoise(tileX, tileY, 8000, 1000, 400);
    const sampleDirt = precomputeNoise(tileX, tileY, 5000, 2000, 300);

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const wx = tileX * 32 + px;
        const wy = tileY * 32 + py;

        const n = sampleN(px, py);
        const dirtN = sampleDirt(px, py);
        const h = pxHash(wx, wy); // 0..1 random per pixel

        // Jitter the dirt threshold per-pixel for ragged edges
        const dirtThresh = 0.62 + (h - 0.5) * 0.03;

        if (dirtN > dirtThresh) {
          // Green-to-dirt edge dithering
          const edgeDither = 0.025;
          if (dirtN < dirtThresh + edgeDither) {
            // Mix green and dirt pixels randomly at the border
            const mixChance = (dirtN - dirtThresh) / edgeDither;
            if (h > mixChance) {
              // Green pixel
              const gPos = Math.min(3.999, n * 4);
              put(px, py, greenHex[Math.floor(gPos)]);
            } else {
              put(px, py, dirtHex[0]); // lightest dirt
            }
          } else {
            // Inner dirt — dithered shade transitions
            const inner = (dirtN - dirtThresh - edgeDither) / (1.0 - dirtThresh - edgeDither);
            const dPos = Math.min(2.999, Math.max(0, inner * 3));
            const dIdx = Math.floor(dPos);
            const dFrac = dPos - dIdx;
            // Dither near boundaries
            if (dIdx < 2 && dFrac > (1 - ditherW) && h > (dFrac - (1 - ditherW)) / ditherW) {
              put(px, py, dirtHex[dIdx]);
            } else if (dIdx < 2 && dFrac > (1 - ditherW)) {
              put(px, py, dirtHex[dIdx + 1]);
            } else {
              put(px, py, dirtHex[dIdx]);
            }
          }
        } else {
          // Green shades — dithered transitions
          const gPos = Math.min(3.999, n * 4);
          const gIdx = Math.floor(gPos);
          const gFrac = gPos - gIdx;
          // Dither near shade boundaries
          if (gIdx < 3 && gFrac > (1 - ditherW) && h > (gFrac - (1 - ditherW)) / ditherW) {
            put(px, py, greenHex[gIdx]);
          } else if (gIdx < 3 && gFrac > (1 - ditherW)) {
            put(px, py, greenHex[gIdx + 1]);
          } else {
            put(px, py, greenHex[gIdx]);
          }
        }
      }
    }

    // Scattered leaf litter (~12% of tiles, 1-2 leaves)
    if (rnd() < 0.12) {
      const leafColors = ['#c07030', '#8a5020', '#b09040', '#a06828', '#7a4018'];
      const count = 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < count; i++) {
        const lx = 1 + Math.floor(rnd() * 30);
        const ly = 1 + Math.floor(rnd() * 30);
        put(lx, ly, leafColors[Math.floor(rnd() * leafColors.length)]);
      }
    }

    // Scattered mushrooms (~2.5% of tiles)
    if (rnd() < 0.025) {
      const mx = 2 + Math.floor(rnd() * 28);
      const my = 2 + Math.floor(rnd() * 28);
      put(mx, my - 1, '#d04040');    // red cap
      put(mx + 1, my - 1, '#b03030');
      put(mx, my, '#e8e0d0');        // white stem
    }

    // Moss patches (~6% of tiles)
    if (rnd() < 0.06) {
      const mx = 3 + Math.floor(rnd() * 26);
      const my = 3 + Math.floor(rnd() * 26);
      put(mx, my, '#4a8a30');
      put(mx + 1, my, '#3a7a28');
      put(mx, my + 1, '#4a8a30');
    }

    // Rare rock (~4%) on any ground
    if (rnd() < 0.04) {
      const rx = 2 + Math.floor(rnd() * 28);
      const ry = 2 + Math.floor(rnd() * 28);
      put(rx, ry, '#5a6270');
      put(rx + 1, ry, '#4a5260');
      put(rx, ry + 1, '#3e4654');
    }

    // Small rocks/pebbles in dirt patches (~30% of tiles, placed only if in dirt)
    if (rnd() < 0.30) {
      const rockColors = ['#6a6260', '#5a5450', '#7a7068', '#4e4844'];
      const count = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < count; i++) {
        const rx = 2 + Math.floor(rnd() * 28);
        const ry = 2 + Math.floor(rnd() * 28);
        // Only place if this pixel is in a dirt region
        const wx = tileX * 32 + rx;
        const wy = tileY * 32 + ry;
        const dn = wnoise(wx + 5000, wy + 2000, 300);
        if (dn > 0.68) {
          const col = rockColors[Math.floor(rnd() * rockColors.length)];
          put(rx, ry, col);
          if (rnd() > 0.5) put(rx + 1, ry, col); // sometimes 2px wide
        }
      }
    }

    // Rare grass tuft (~8%)
    if (rnd() < 0.08) {
      const tx = 3 + Math.floor(rnd() * 26);
      const ty = 3 + Math.floor(rnd() * 26);
      put(tx, ty, '#2a5a20');
      put(tx + 1, ty, '#2a5a20');
      put(tx, ty - 1, '#3a6a28');
    }
  };
}

// Infected riverside ground — dark purples with toxic green patches, sickly vegetation
function drawGroundInfected(tileX: number, tileY: number) {
  return (put: Put) => {
    // Base shades: dark purples to sickly greens
    const shades = [
      [0x22, 0x18, 0x30],  // deep purple
      [0x2a, 0x20, 0x38],  // medium purple
      [0x28, 0x30, 0x22],  // dark infected green
      [0x30, 0x3a, 0x28],  // sickly green
    ];
    const shadeHex = shades.map(([r, g, b]) =>
      '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
    );
    const lerpCol = (a: number[], b: number[], t: number): string => {
      const r = Math.round(a[0] + (b[0] - a[0]) * t);
      const g = Math.round(a[1] + (b[1] - a[1]) * t);
      const bl = Math.round(a[2] + (b[2] - a[2]) * t);
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + bl.toString(16).padStart(2, '0');
    };

    let s = ((tileX * 73856093 + tileY * 19349669) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    const fadeW = 0.06;
    const midW  = 0.03;
    const totalW = fadeW + midW + fadeW;

    const sampleN = precomputeNoise(tileX, tileY, 6000, 800, 350);

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const n = sampleN(px, py);
        const pos = Math.min(3.999, n * 4);
        const idx = Math.floor(pos);
        const frac = pos - idx;

        const bandStart = 1 - totalW;
        if (idx < 3 && frac > bandStart) {
          const mid = shades[idx].map((c, i) => Math.round((c + shades[idx + 1][i]) / 2));
          const t = frac - bandStart;
          if (t < fadeW) {
            put(px, py, lerpCol(shades[idx], mid, t / fadeW));
          } else if (t < fadeW + midW) {
            put(px, py, lerpCol(mid, mid, 0));
          } else {
            put(px, py, lerpCol(mid, shades[idx + 1], (t - fadeW - midW) / fadeW));
          }
        } else {
          put(px, py, shadeHex[idx]);
        }
      }
    }

    // Toxic puddle (~3% of tiles)
    if (rnd() < 0.03) {
      const px0 = 4 + Math.floor(rnd() * 24);
      const py0 = 4 + Math.floor(rnd() * 24);
      const sz = 2 + Math.floor(rnd() * 2);
      for (let dy = 0; dy < sz; dy++) {
        for (let dx = 0; dx < sz; dx++) {
          if (rnd() > 0.4) put(px0 + dx, py0 + dy, rnd() > 0.5 ? '#40e060' : '#30b848');
        }
      }
    }

    // Infected moss (~4% of tiles)
    if (rnd() < 0.04) {
      const mx = 2 + Math.floor(rnd() * 26);
      const my = 2 + Math.floor(rnd() * 26);
      put(mx, my, '#6040a0');
      put(mx + 1, my, '#5a38a0');
    }
  };
}

// Tree cluster patterns — each defines which tiles are occupied
// Coordinates are relative (dx, dy) from the top-left of the cluster
export const TREE_PATTERNS: { tiles: { dx: number; dy: number }[]; w: number; h: number }[] = [
  // All convex shapes — no internal pockets that enemies can get stuck in
  // Small (2-3 tiles)
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }], w: 2, h: 1 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }], w: 1, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }], w: 1, h: 3 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }], w: 3, h: 1 },
  // Medium (4 tiles)
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }], w: 2, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }], w: 2, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }], w: 2, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }], w: 4, h: 1 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }, { dx: 0, dy: 3 }], w: 1, h: 4 },
  // Large (5-6 tiles) — wide/tall rectangles
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }], w: 3, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }], w: 2, h: 3 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }], w: 3, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }], w: 2, h: 3 },
  // Large (6-8 tiles) — big blocks
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 3, dy: 1 }], w: 4, h: 2 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }, { dx: 2, dy: 2 }], w: 3, h: 3 },
];

// Draw a WC2-style conifer tree cluster — triangular tiered pine trees packed tightly
function drawTreeClusterCanvas(patternIdx: number): HTMLCanvasElement {
  const pattern = TREE_PATTERNS[patternIdx];
  const T = 32; // tile size in pixels (world space)
  // Large padding — trees are much taller than a single tile
  const pad = 40;
  const cw = pattern.w * T + pad * 2;
  const ch = pattern.h * T + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Seeded RNG per pattern
  let seed = (patternIdx * 73856093 + 54321) >>> 0;
  const rnd = () => { seed = (seed * 16807 + 1) % 2147483647; return seed / 2147483647; };

  // Place 2-3 trees per tile, tightly packed with jitter for dense clumps
  type TreeDef = { cx: number; cy: number; h: number; baseW: number; shade: number };
  const trees: TreeDef[] = [];

  for (const t of pattern.tiles) {
    const tileCx = t.dx * T + T / 2 + pad;
    const tileCy = t.dy * T + T * 0.85 + pad;
    const treesPerTile = 2 + (rnd() > 0.5 ? 1 : 0); // 2-3 trees per tile
    for (let i = 0; i < treesPerTile; i++) {
      const cx = tileCx + (rnd() - 0.5) * T * 0.7;
      const cy = tileCy + (rnd() - 0.5) * T * 0.4;
      const treeH = 48 + Math.floor(rnd() * 14); // much taller: 48-62px
      trees.push({
        cx, cy, h: treeH,
        baseW: 26 + Math.floor(rnd() * 8), // wider: 26-34px
        shade: Math.floor(rnd() * 3)
      });
    }
  }

  // Sort back-to-front (higher cy = closer to camera = drawn later)
  trees.sort((a, b) => a.cy - b.cy);

  // Color palettes — 3 shade variants
  const palettes = [
    { dark: '#0e2408', mid: '#1a3a12', light: '#28521e', highlight: '#38682c', bright: '#4a7e3a' },
    { dark: '#102608', mid: '#1c3e14', light: '#2a5420', highlight: '#3a6a2e', bright: '#4c823c' },
    { dark: '#0c2206', mid: '#183810', light: '#26501c', highlight: '#36642a', bright: '#488038' },
  ];

  for (const tree of trees) {
    const p = palettes[tree.shade];
    const { cx, cy, h, baseW } = tree;
    const topY = cy - h;

    // Trunk — short, visible below the lowest branches
    const trunkW = 4;
    const trunkH = 7;
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(Math.floor(cx - trunkW / 2) - 1, Math.floor(cy - trunkH), trunkW + 2, trunkH + 1);
    ctx.fillStyle = '#4a2e14';
    ctx.fillRect(Math.floor(cx - trunkW / 2), Math.floor(cy - trunkH), trunkW, trunkH);

    // 3 tiers of triangular branch layers, bottom to top
    const tiers = 3;
    for (let tier = 0; tier < tiers; tier++) {
      const t0 = tier / tiers;
      const t1 = (tier + 1) / tiers;
      const tierBot = cy - h * t0 * 0.75 - 3;
      const tierTop = cy - h * (t0 + (t1 - t0) * 0.85) - 3;
      const tierMid = (tierBot + tierTop) / 2;
      const tierW = baseW * (1 - t0 * 0.55);

      // Dark shadow triangle (slightly offset)
      ctx.fillStyle = p.dark;
      ctx.beginPath();
      ctx.moveTo(cx, tierTop - 1);
      ctx.lineTo(cx - tierW / 2 - 1, tierBot + 1);
      ctx.lineTo(cx + tierW / 2 + 1, tierBot + 1);
      ctx.closePath();
      ctx.fill();

      // Main body triangle
      ctx.fillStyle = p.mid;
      ctx.beginPath();
      ctx.moveTo(cx, tierTop);
      ctx.lineTo(cx - tierW / 2, tierBot);
      ctx.lineTo(cx + tierW / 2, tierBot);
      ctx.closePath();
      ctx.fill();

      // Left-side highlight (light from top-left)
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.moveTo(cx - 1, tierTop + 1);
      ctx.lineTo(cx - tierW / 2 + 1, tierBot);
      ctx.lineTo(cx - tierW * 0.15, tierBot);
      ctx.lineTo(cx - 1, tierMid);
      ctx.closePath();
      ctx.fill();

      // Bright highlight near top-left
      ctx.fillStyle = p.highlight;
      ctx.beginPath();
      ctx.moveTo(cx - 1, tierTop + 2);
      ctx.lineTo(cx - tierW * 0.3, tierMid + 1);
      ctx.lineTo(cx - 1, tierMid - 1);
      ctx.closePath();
      ctx.fill();

      // Branch edge detail — jagged pixels along edges
      const steps = Math.floor(tierBot - tierTop);
      for (let i = 0; i < steps; i += 2) {
        const fy = tierTop + i;
        const frac = i / steps;
        const edgeW = tierW / 2 * frac;
        if (rnd() > 0.3) {
          const jx = cx - edgeW - 1 + rnd() * 2;
          ctx.fillStyle = rnd() > 0.5 ? p.dark : p.mid;
          ctx.fillRect(Math.floor(jx), Math.floor(fy), 1, 1);
        }
        if (rnd() > 0.3) {
          const jx = cx + edgeW - 1 + rnd() * 2;
          ctx.fillStyle = rnd() > 0.5 ? p.dark : p.mid;
          ctx.fillRect(Math.floor(jx), Math.floor(fy), 1, 1);
        }
      }
    }

    // Pointed tip
    ctx.fillStyle = p.bright;
    ctx.fillRect(Math.floor(cx), Math.floor(topY - 2), 1, 3);
    ctx.fillStyle = p.highlight;
    ctx.fillRect(Math.floor(cx - 1), Math.floor(topY - 1), 1, 1);

    // Scattered bright needle highlights
    for (let i = 0; i < 10; i++) {
      const hx = cx + (rnd() - 0.5) * baseW * 0.6;
      const hy = cy - rnd() * h * 0.8 - 3;
      ctx.fillStyle = rnd() > 0.5 ? p.bright : p.highlight;
      ctx.fillRect(Math.floor(hx), Math.floor(hy), 1, 1);
    }
  }

  return canvas;
}

// Draw infected plant cluster — bulbous, sickly purple/green growths
function drawInfectedPlantCanvas(patternIdx: number): HTMLCanvasElement {
  const pattern = TREE_PATTERNS[patternIdx];
  const T = 32;
  const pad = 30;
  const cw = pattern.w * T + pad * 2;
  const ch = pattern.h * T + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  let seed = (patternIdx * 48271 + 99991) >>> 0;
  const rnd = () => { seed = (seed * 16807 + 1) % 2147483647; return seed / 2147483647; };

  type PlantDef = { cx: number; cy: number; h: number; w: number; variant: number };
  const plants: PlantDef[] = [];

  for (const t of pattern.tiles) {
    const tileCx = t.dx * T + T / 2 + pad;
    const tileCy = t.dy * T + T * 0.85 + pad;
    const plantsPerTile = 2 + (rnd() > 0.6 ? 1 : 0);
    for (let i = 0; i < plantsPerTile; i++) {
      plants.push({
        cx: tileCx + (rnd() - 0.5) * T * 0.6,
        cy: tileCy + (rnd() - 0.5) * T * 0.3,
        h: 30 + Math.floor(rnd() * 20),
        w: 18 + Math.floor(rnd() * 10),
        variant: Math.floor(rnd() * 3)
      });
    }
  }

  plants.sort((a, b) => a.cy - b.cy);

  const palettes = [
    { stem: '#2a1040', dark: '#4a2070', mid: '#6a30a0', light: '#8a48c0', glow: '#50e070' },
    { stem: '#1a2030', dark: '#2a4038', mid: '#3a6050', light: '#4a8068', glow: '#80ff90' },
    { stem: '#2a1838', dark: '#5a2880', mid: '#7a38b0', light: '#9a50d0', glow: '#60e880' },
  ];

  for (const plant of plants) {
    const p = palettes[plant.variant];
    const { cx, cy, h, w } = plant;

    // Thick stem
    const stemW = 3 + Math.floor(rnd() * 2);
    ctx.fillStyle = p.stem;
    ctx.fillRect(Math.floor(cx - stemW / 2), Math.floor(cy - h * 0.4), stemW, Math.floor(h * 0.4));

    // Bulbous infected growth — stacked ovals
    const layers = 2 + Math.floor(rnd() * 2);
    for (let l = 0; l < layers; l++) {
      const ly = cy - h * 0.3 - l * h * 0.2;
      const lw = w * (1 - l * 0.2) / 2;
      const lh = h * 0.25;

      // Dark outline
      ctx.fillStyle = p.dark;
      ctx.beginPath();
      ctx.ellipse(cx, ly, lw + 1, lh / 2 + 1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main body
      ctx.fillStyle = p.mid;
      ctx.beginPath();
      ctx.ellipse(cx, ly, lw, lh / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.ellipse(cx - lw * 0.2, ly - lh * 0.15, lw * 0.5, lh * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing spore tips
    const sporeCount = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < sporeCount; i++) {
      const sx = cx + (rnd() - 0.5) * w * 0.8;
      const sy = cy - h * 0.5 - rnd() * h * 0.4;
      ctx.fillStyle = p.glow;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
      // Subtle glow around spore
      ctx.globalAlpha = 0.3;
      ctx.fillRect(Math.floor(sx) - 1, Math.floor(sy) - 1, 4, 4);
      ctx.globalAlpha = 1;
    }

    // Dripping tendrils from bottom
    const tendrils = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < tendrils; i++) {
      const tx = cx + (rnd() - 0.5) * w * 0.5;
      const tLen = 4 + Math.floor(rnd() * 8);
      ctx.fillStyle = rnd() > 0.5 ? '#40c060' : '#6030a0';
      for (let j = 0; j < tLen; j++) {
        ctx.fillRect(Math.floor(tx + (rnd() - 0.5) * 2), Math.floor(cy + j), 1, 1);
      }
    }
  }

  return canvas;
}

function drawFoundation(put: Put) {
  // Organic dirt patch for 2x2 tower footprint (64x64, rendered at 0.5 scale = 32x32 = 2 tiles)
  // Stays within bounds but with rounded/noisy corners
  const S = 64;

  // Seeded RNG for deterministic noise
  let seed = 42;
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

  // Dirt palette
  const dirts = ['#6b4e32', '#7a5a3a', '#5e4228', '#8b6841', '#6f5030', '#544020', '#7e6238'];

  // Corner rounding radius in pixels
  const cornerR = 8;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Distance from nearest corner (only matters in corner regions)
      let skip = false;
      // Check each corner
      for (const [cx, cy] of [[cornerR, cornerR], [S - 1 - cornerR, cornerR], [cornerR, S - 1 - cornerR], [S - 1 - cornerR, S - 1 - cornerR]]) {
        const inCornerX = (cx <= cornerR && x < cornerR) || (cx >= S - 1 - cornerR && x > S - 1 - cornerR);
        const inCornerY = (cy <= cornerR && y < cornerR) || (cy >= S - 1 - cornerR && y > S - 1 - cornerR);
        if (inCornerX && inCornerY) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Wobbly corner edge
          const angle = Math.atan2(dy, dx);
          const wobble = Math.sin(angle * 6) * 2 + Math.cos(angle * 4) * 1.5;
          if (dist > cornerR + wobble) {
            skip = true;
            break;
          }
          // Fade at corner edges
          if (dist > cornerR + wobble - 4) {
            const fade = (cornerR + wobble - dist) / 4;
            if (rng() > fade * 0.7) { skip = true; break; }
          }
        }
      }
      if (skip) continue;

      // Fade along straight edges too (1-2px scatter)
      const edgeDist = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (edgeDist < 3) {
        const fade = edgeDist / 3;
        if (rng() > fade * 0.8) continue;
      }

      // Pick dirt color with noise
      const ci = Math.floor(rng() * dirts.length);
      put(x, y, dirts[ci]);
    }
  }

  // Scatter some darker speckles for texture
  for (let i = 0; i < 80; i++) {
    const x = 2 + Math.floor(rng() * (S - 4));
    const y = 2 + Math.floor(rng() * (S - 4));
    const dark = ['#3d2a16', '#4a3420', '#33210f'];
    put(x, y, dark[Math.floor(rng() * dark.length)]);
  }
  // A few lighter pebble highlights
  for (let i = 0; i < 20; i++) {
    const x = 3 + Math.floor(rng() * (S - 6));
    const y = 3 + Math.floor(rng() * (S - 6));
    put(x, y, '#a08060');
  }
}

// ==================================================================
//  BOSS — The Brood Mother (64x64, 2x2 tile footprint)
// ==================================================================
interface BossOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number; // 0..4 for birth animation stages, undefined = no pockets
  rearUp?: boolean; // slam windup pose
  legStep?: number; // -1 | 0 | 1
}

function drawBossBody(put: Put, opts: BossOpts) {
  const cx = 32;
  const baseCy = 34 + (opts.bob ?? 0) + (opts.rearUp ? -2 : 0);

  const col = {
    out: opts.flash ? P.white : P.outline,
    d:   opts.flash ? P.white : P.heavyD,
    m:   opts.flash ? P.white : P.heavyM,
    b:   opts.flash ? P.white : P.heavy,
    l:   opts.flash ? P.white : P.heavyL
  };

  // drop shadow
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -26; dx <= 26; dx++)
      if ((dx * dx) / 676 + (dy * dy) / 5 <= 1) put(cx + dx, 59 + dy, P.shadow);

  // stubby legs (4)
  const legStep = opts.legStep ?? 0;
  rect(put, cx - 22, baseCy + 12 + legStep, 4, 6, col.d);
  rect(put, cx - 14, baseCy + 17 - legStep, 4, 5, col.d);
  rect(put, cx + 10, baseCy + 17 - legStep, 4, 5, col.d);
  rect(put, cx + 18, baseCy + 12 + legStep, 4, 6, col.d);
  // feet
  put(cx - 22, baseCy + 17 + legStep, P.outline);
  put(cx - 14, baseCy + 21 - legStep, P.outline);
  put(cx + 13, baseCy + 21 - legStep, P.outline);
  put(cx + 21, baseCy + 17 + legStep, P.outline);

  // main bulbous body
  disc(put, cx, baseCy, 24, col.out);
  disc(put, cx, baseCy, 23, col.d);
  disc(put, cx, baseCy, 22, col.b);

  // upper back (darker, textured)
  for (let y = -22; y <= -3; y++)
    for (let x = -22; x <= 22; x++)
      if (x * x + y * y <= 484) put(cx + x, baseCy + y, col.d);
  for (let y = -20; y <= -5; y++)
    for (let x = -20; x <= 20; x++)
      if (x * x + y * y <= 400) put(cx + x, baseCy + y, col.b);
  // highlight arc upper-left
  for (let y = -20; y <= -10; y++)
    for (let x = -18; x <= -2; x++)
      if (x * x + y * y <= 324) put(cx + x, baseCy + y, col.m);
  for (let y = -18; y <= -14; y++)
    for (let x = -10; x <= -4; x++)
      if (x * x + y * y <= 256) put(cx + x, baseCy + y, col.l);

  // pale swollen underbelly (lower half)
  for (let y = 4; y <= 22; y++)
    for (let x = -20; x <= 20; x++)
      if (x * x + y * y <= 476) put(cx + x, baseCy + y, P.belly);
  for (let y = 10; y <= 22; y++)
    for (let x = -17; x <= 17; x++)
      if (x * x + y * y <= 400) put(cx + x, baseCy + y, P.bellyM);
  // segmentation lines
  for (let x = -17; x <= 17; x++) {
    if (Math.abs(x) < 16) put(cx + x, baseCy + 8, P.bellyD);
    if (Math.abs(x) < 14) put(cx + x, baseCy + 14, P.bellyD);
    if (Math.abs(x) < 10) put(cx + x, baseCy + 19, P.bellyD);
  }

  // back spines (row along top of upper body)
  const spinePositions: Array<[number, number]> = [
    [-16, -16], [-10, -19], [-4, -21], [2, -21], [8, -20], [14, -17]
  ];
  for (const [sx, sy] of spinePositions) {
    put(cx + sx, baseCy + sy + 1, col.d);
    put(cx + sx, baseCy + sy, col.out);
    put(cx + sx, baseCy + sy - 1, col.out);
  }

  // eye cluster (5 glowing eyes, center-top)
  const eyes: Array<[number, number]> = [
    [-12, -4], [-6, -8], [0, -10], [6, -8], [12, -4]
  ];
  for (const [ex, ey] of eyes) {
    const glow = opts.chargeGlow ? P.sparkL : P.redL;
    put(cx + ex - 1, baseCy + ey, P.outline);
    put(cx + ex,     baseCy + ey, glow);
    put(cx + ex + 1, baseCy + ey, opts.chargeGlow ? P.spark : P.white);
    put(cx + ex,     baseCy + ey + 1, P.redD);
  }

  // mouth (hidden behind under-bulge, slit)
  rect(put, cx - 5, baseCy + 1, 10, 1, P.outline);
  put(cx - 6, baseCy + 1, P.redD);
  put(cx + 5, baseCy + 1, P.redD);

  // ----- birth pockets on back -----
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [
      [-10, -13], [-2, -15], [6, -14]
    ];
    for (const [px, py] of pockets) {
      const ox = cx + px, oy = baseCy + py;
      if (stage === 0) {
        // smooth bumps forming
        disc(put, ox, oy, 3, col.l);
        disc(put, ox, oy, 2, col.b);
      } else if (stage === 1) {
        // dark pockets split open
        disc(put, ox, oy, 3, col.d);
        disc(put, ox, oy, 2, P.outline);
        put(ox, oy, P.redD);
      } else if (stage === 2) {
        // little heads visible inside
        disc(put, ox, oy, 3, col.d);
        disc(put, ox, oy, 2, P.red);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
        put(ox, oy + 1, P.outline);
      } else if (stage === 3) {
        // heads pushing out, bulging higher
        disc(put, ox, oy - 1, 4, col.d);
        disc(put, ox, oy - 1, 3, P.red);
        disc(put, ox, oy - 2, 2, P.redL);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
        put(ox, oy, P.outline);
      } else if (stage === 4) {
        // empty crater just after pop
        disc(put, ox, oy, 3, P.outline);
        disc(put, ox, oy, 2, col.d);
      }
    }
  }
}

type BossFrame =
  | 'idle0' | 'idle1'
  | 'move0' | 'move1' | 'move2' | 'move3'
  | 'atk0' | 'atk1'
  | 'chargeWind'
  | 'hit'
  | 'birth0' | 'birth1' | 'birth2' | 'birth3' | 'birth4'
  | 'die0' | 'die1' | 'die2' | 'die3' | 'die4';

function drawBoss(frame: BossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawBossBody(put, { bob: 0 });
      case 'idle1':      return drawBossBody(put, { bob: 1 });
      case 'move0':      return drawBossBody(put, { bob: 0, legStep: 1 });
      case 'move1':      return drawBossBody(put, { bob: 1, legStep: 0 });
      case 'move2':      return drawBossBody(put, { bob: 0, legStep: -1 });
      case 'move3':      return drawBossBody(put, { bob: 1, legStep: 0 });
      case 'atk0':       return drawBossBody(put, { rearUp: true, bob: -1 });
      case 'atk1':       return drawBossBody(put, { bob: 2 });
      case 'chargeWind': return drawBossBody(put, { chargeGlow: true, bob: 0 });
      case 'hit':        return drawBossBody(put, { flash: true });
      case 'birth0':     return drawBossBody(put, { pockets: 0 });
      case 'birth1':     return drawBossBody(put, { pockets: 1 });
      case 'birth2':     return drawBossBody(put, { pockets: 2 });
      case 'birth3':     return drawBossBody(put, { pockets: 3 });
      case 'birth4':     return drawBossBody(put, { pockets: 4 });
      case 'die0':       return drawBossDie(put, 0);
      case 'die1':       return drawBossDie(put, 1);
      case 'die2':       return drawBossDie(put, 2);
      case 'die3':       return drawBossDie(put, 3);
      case 'die4':       return drawBossDie(put, 4);
    }
  };
}

function drawBossDie(put: Put, step: number) {
  const cx = 32, cy = 36;
  const r = Math.max(0, 24 - step * 5);
  if (r > 0) {
    disc(put, cx, cy, r, P.heavyD);
    disc(put, cx, cy, Math.max(0, r - 1), P.heavy);
    disc(put, cx, cy, Math.max(0, r - 3), P.heavyL);
  }
  // shrapnel + belly chunks flying out
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 6 + 6;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, P.heavyD);
    put(x + 1, y, P.red);
    if (i % 3 === 0) put(x, y + 1, P.belly);
  }
  // central flash
  if (step < 2) disc(put, cx, cy, 6, P.sparkL);
}

// ==================================================================
//  INFECTED BOSS — The Blighted One (purple/orange/yellow)
// ==================================================================
function drawInfectedBossBody(put: Put, opts: BossOpts) {
  const cx = 32;
  const baseCy = 34 + (opts.bob ?? 0) + (opts.rearUp ? -2 : 0);

  const col = {
    out: opts.flash ? P.white : P.outline,
    d:   opts.flash ? P.white : P.infectD,
    m:   opts.flash ? P.white : P.infectM,
    b:   opts.flash ? P.white : P.infect,
    l:   opts.flash ? P.white : P.infectL
  };

  // drop shadow
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -26; dx <= 26; dx++)
      if ((dx * dx) / 676 + (dy * dy) / 5 <= 1) put(cx + dx, 59 + dy, P.shadow);

  // stubby legs (4)
  const legStep = opts.legStep ?? 0;
  rect(put, cx - 22, baseCy + 12 + legStep, 4, 6, col.d);
  rect(put, cx - 14, baseCy + 17 - legStep, 4, 5, col.d);
  rect(put, cx + 10, baseCy + 17 - legStep, 4, 5, col.d);
  rect(put, cx + 18, baseCy + 12 + legStep, 4, 6, col.d);
  put(cx - 22, baseCy + 17 + legStep, P.outline);
  put(cx - 14, baseCy + 21 - legStep, P.outline);
  put(cx + 13, baseCy + 21 - legStep, P.outline);
  put(cx + 21, baseCy + 17 + legStep, P.outline);

  // main bulbous body
  disc(put, cx, baseCy, 24, col.out);
  disc(put, cx, baseCy, 23, col.d);
  disc(put, cx, baseCy, 22, col.b);

  // upper back (darker, textured)
  for (let y = -22; y <= -3; y++)
    for (let x = -22; x <= 22; x++)
      if (x * x + y * y <= 484) put(cx + x, baseCy + y, col.d);
  for (let y = -20; y <= -5; y++)
    for (let x = -20; x <= 20; x++)
      if (x * x + y * y <= 400) put(cx + x, baseCy + y, col.b);
  // highlight arc upper-left
  for (let y = -20; y <= -10; y++)
    for (let x = -18; x <= -2; x++)
      if (x * x + y * y <= 324) put(cx + x, baseCy + y, col.m);
  for (let y = -18; y <= -14; y++)
    for (let x = -10; x <= -4; x++)
      if (x * x + y * y <= 256) put(cx + x, baseCy + y, col.l);

  // orange/yellow infected underbelly
  const bellyCol  = opts.flash ? P.white : '#d08020';
  const bellyColM = opts.flash ? P.white : '#a06018';
  const bellyColD = opts.flash ? P.white : '#6a3808';
  for (let y = 4; y <= 22; y++)
    for (let x = -20; x <= 20; x++)
      if (x * x + y * y <= 476) put(cx + x, baseCy + y, bellyCol);
  for (let y = 10; y <= 22; y++)
    for (let x = -17; x <= 17; x++)
      if (x * x + y * y <= 400) put(cx + x, baseCy + y, bellyColM);
  // segmentation lines
  for (let x = -17; x <= 17; x++) {
    if (Math.abs(x) < 16) put(cx + x, baseCy + 8, bellyColD);
    if (Math.abs(x) < 14) put(cx + x, baseCy + 14, bellyColD);
    if (Math.abs(x) < 10) put(cx + x, baseCy + 19, bellyColD);
  }

  // glowing green pustule spines along top
  const spinePositions: Array<[number, number]> = [
    [-16, -16], [-10, -19], [-4, -21], [2, -21], [8, -20], [14, -17]
  ];
  for (const [sx, sy] of spinePositions) {
    put(cx + sx, baseCy + sy + 1, '#40e060');
    put(cx + sx, baseCy + sy, '#40e060');
    put(cx + sx, baseCy + sy - 1, col.out);
  }

  // eye cluster — glowing yellow eyes
  const eyes: Array<[number, number]> = [
    [-12, -4], [-6, -8], [0, -10], [6, -8], [12, -4]
  ];
  for (const [ex, ey] of eyes) {
    const glow = opts.chargeGlow ? P.sparkL : '#e0ff40';
    put(cx + ex - 1, baseCy + ey, P.outline);
    put(cx + ex,     baseCy + ey, glow);
    put(cx + ex + 1, baseCy + ey, opts.chargeGlow ? P.spark : '#ffff80');
    put(cx + ex,     baseCy + ey + 1, P.infectD);
  }

  // mouth — green ooze drip
  rect(put, cx - 5, baseCy + 1, 10, 1, P.outline);
  put(cx - 6, baseCy + 1, '#40e060');
  put(cx + 5, baseCy + 1, '#40e060');
  put(cx - 3, baseCy + 2, '#40e060');
  put(cx + 2, baseCy + 2, '#40e060');

  // birth pockets
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [
      [-10, -13], [-2, -15], [6, -14]
    ];
    for (const [px, py] of pockets) {
      const ox = cx + px, oy = baseCy + py;
      if (stage === 0) {
        disc(put, ox, oy, 3, col.l);
        disc(put, ox, oy, 2, col.b);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, col.d);
        disc(put, ox, oy, 2, P.outline);
        put(ox, oy, '#40e060');
      } else if (stage === 2) {
        disc(put, ox, oy, 3, col.d);
        disc(put, ox, oy, 2, P.infect);
        put(ox - 1, oy, '#e0ff40');
        put(ox + 1, oy, '#e0ff40');
        put(ox, oy + 1, P.outline);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, col.d);
        disc(put, ox, oy - 1, 3, P.infect);
        disc(put, ox, oy - 2, 2, P.infectL);
        put(ox - 1, oy - 1, '#e0ff40');
        put(ox + 1, oy - 1, '#e0ff40');
        put(ox, oy, P.outline);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, P.outline);
        disc(put, ox, oy, 2, col.d);
      }
    }
  }
}

function drawInfectedBossDie(put: Put, step: number) {
  const cx = 32, cy = 36;
  const r = Math.max(0, 24 - step * 5);
  if (r > 0) {
    disc(put, cx, cy, r, P.infectD);
    disc(put, cx, cy, Math.max(0, r - 1), P.infect);
    disc(put, cx, cy, Math.max(0, r - 3), P.infectL);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 6 + 6;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, P.infectD);
    put(x + 1, y, '#d08020');
    if (i % 3 === 0) put(x, y + 1, '#40e060');
  }
  if (step < 2) disc(put, cx, cy, 6, P.sparkL);
}

function drawInfectedBoss(frame: BossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawInfectedBossBody(put, { bob: 0 });
      case 'idle1':      return drawInfectedBossBody(put, { bob: 1 });
      case 'move0':      return drawInfectedBossBody(put, { bob: 0, legStep: 1 });
      case 'move1':      return drawInfectedBossBody(put, { bob: 1, legStep: 0 });
      case 'move2':      return drawInfectedBossBody(put, { bob: 0, legStep: -1 });
      case 'move3':      return drawInfectedBossBody(put, { bob: 1, legStep: 0 });
      case 'atk0':       return drawInfectedBossBody(put, { rearUp: true, bob: -1 });
      case 'atk1':       return drawInfectedBossBody(put, { bob: 2 });
      case 'chargeWind': return drawInfectedBossBody(put, { chargeGlow: true, bob: 0 });
      case 'hit':        return drawInfectedBossBody(put, { flash: true });
      case 'birth0':     return drawInfectedBossBody(put, { pockets: 0 });
      case 'birth1':     return drawInfectedBossBody(put, { pockets: 1 });
      case 'birth2':     return drawInfectedBossBody(put, { pockets: 2 });
      case 'birth3':     return drawInfectedBossBody(put, { pockets: 3 });
      case 'birth4':     return drawInfectedBossBody(put, { pockets: 4 });
      case 'die0':       return drawInfectedBossDie(put, 0);
      case 'die1':       return drawInfectedBossDie(put, 1);
      case 'die2':       return drawInfectedBossDie(put, 2);
      case 'die3':       return drawInfectedBossDie(put, 3);
      case 'die4':       return drawInfectedBossDie(put, 4);
    }
  };
}

// ==================================================================
//  FOREST BOSS — Ent / Tree Guardian
// ==================================================================
interface EntOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  rearUp?: boolean;
  legStep?: number;
  armSwing?: number; // -1 to 1 for arm pose
}

function drawEntBody(put: Put, opts: EntOpts) {
  const cx = 32;
  const baseCy = 34 + (opts.bob ?? 0) + (opts.rearUp ? -2 : 0);
  const armSwing = opts.armSwing ?? 0;

  const col = {
    out:  opts.flash ? P.white : P.outline,
    d:    opts.flash ? P.white : P.barkD,
    m:    opts.flash ? P.white : P.barkM,
    b:    opts.flash ? P.white : P.bark,
    l:    opts.flash ? P.white : P.barkL,
    lfD:  opts.flash ? P.white : P.leafD,
    lf:   opts.flash ? P.white : P.leaf,
    lfM:  opts.flash ? P.white : P.leafM,
    lfL:  opts.flash ? P.white : P.leafL,
    lfB:  opts.flash ? P.white : P.leafB,
  };

  // Drop shadow — oval
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -20; dx <= 20; dx++)
      if ((dx * dx) / 400 + (dy * dy) / 5 <= 1) put(cx + dx, 59 + dy, P.shadow);

  // Root-legs (2 thick roots)
  const legStep = opts.legStep ?? 0;
  // Left root
  rect(put, cx - 14, baseCy + 14 + legStep, 6, 8, col.d);
  rect(put, cx - 13, baseCy + 15 + legStep, 4, 6, col.b);
  put(cx - 16, baseCy + 21 + legStep, col.d); // root tip
  put(cx - 15, baseCy + 21 + legStep, col.m);
  // Right root
  rect(put, cx + 8, baseCy + 14 - legStep, 6, 8, col.d);
  rect(put, cx + 9, baseCy + 15 - legStep, 4, 6, col.b);
  put(cx + 15, baseCy + 21 - legStep, col.d);
  put(cx + 14, baseCy + 21 - legStep, col.m);

  // Main trunk body — tall rectangular with rounded top
  // Outer bark
  rect(put, cx - 12, baseCy - 14, 24, 30, col.out);
  rect(put, cx - 11, baseCy - 13, 22, 28, col.d);
  rect(put, cx - 10, baseCy - 12, 20, 26, col.b);
  // Lighter left highlight
  rect(put, cx - 10, baseCy - 12, 8, 24, col.m);
  rect(put, cx - 9, baseCy - 10, 4, 18, col.l);

  // Bark texture lines (horizontal grooves)
  for (let y = -8; y <= 12; y += 4) {
    for (let x = -8; x <= 8; x++) {
      put(cx + x, baseCy + y, col.d);
    }
  }
  // Vertical bark cracks
  for (let y = -10; y <= 10; y++) {
    if (y % 2 === 0) {
      put(cx - 4, baseCy + y, col.d);
      put(cx + 5, baseCy + y, col.d);
    }
  }

  // Branch arms
  const lArmOff = Math.floor(armSwing * 3);
  const rArmOff = Math.floor(-armSwing * 3);
  // Left arm
  rect(put, cx - 20, baseCy - 6 + lArmOff, 9, 5, col.out);
  rect(put, cx - 19, baseCy - 5 + lArmOff, 7, 3, col.b);
  rect(put, cx - 18, baseCy - 5 + lArmOff, 3, 3, col.l);
  // Left arm twigs
  put(cx - 22, baseCy - 8 + lArmOff, col.lfM);
  put(cx - 21, baseCy - 9 + lArmOff, col.lf);
  put(cx - 23, baseCy - 7 + lArmOff, col.lfD);
  put(cx - 20, baseCy - 8 + lArmOff, col.lfL);
  // Right arm
  rect(put, cx + 11, baseCy - 6 + rArmOff, 9, 5, col.out);
  rect(put, cx + 12, baseCy - 5 + rArmOff, 7, 3, col.b);
  rect(put, cx + 16, baseCy - 5 + rArmOff, 3, 3, col.l);
  // Right arm twigs
  put(cx + 21, baseCy - 8 + rArmOff, col.lfM);
  put(cx + 22, baseCy - 9 + rArmOff, col.lf);
  put(cx + 23, baseCy - 7 + rArmOff, col.lfD);
  put(cx + 20, baseCy - 8 + rArmOff, col.lfL);

  // Leafy crown (canopy on top of the trunk)
  // Large circle of leaves on top
  const crownY = baseCy - 20;
  disc(put, cx, crownY, 16, col.out);
  disc(put, cx, crownY, 15, col.lfD);
  disc(put, cx, crownY, 14, col.lf);
  disc(put, cx, crownY, 12, col.lfM);
  // Highlight on upper-left
  disc(put, cx - 3, crownY - 3, 8, col.lfL);
  disc(put, cx - 4, crownY - 4, 5, col.lfB);
  // Dark underside
  for (let x = -12; x <= 12; x++)
    for (let y = 2; y <= 6; y++)
      if (x * x + y * y <= 144) put(cx + x, crownY + y, col.lfD);

  // Leaf edge detail — scattered bright/dark pixels around crown edge
  for (let a = 0; a < 20; a++) {
    const angle = (a / 20) * Math.PI * 2;
    const r = 14 + (a % 3);
    const lx = Math.round(cx + Math.cos(angle) * r);
    const ly = Math.round(crownY + Math.sin(angle) * r);
    put(lx, ly, a % 2 === 0 ? col.lfM : col.lfD);
  }

  // Eyes — two glowing green eyes in the trunk face area
  const eyeY = baseCy - 4;
  const glow = opts.chargeGlow ? P.sparkL : P.entEye;
  const glowD = opts.chargeGlow ? P.spark : P.entEyeD;
  // Left eye
  put(cx - 6, eyeY - 1, col.out);
  put(cx - 5, eyeY - 1, col.out);
  put(cx - 4, eyeY - 1, col.out);
  put(cx - 6, eyeY, col.out);
  put(cx - 5, eyeY, glow);
  put(cx - 4, eyeY, opts.chargeGlow ? P.white : glow);
  put(cx - 6, eyeY + 1, col.out);
  put(cx - 5, eyeY + 1, glowD);
  put(cx - 4, eyeY + 1, col.out);
  // Right eye
  put(cx + 4, eyeY - 1, col.out);
  put(cx + 5, eyeY - 1, col.out);
  put(cx + 6, eyeY - 1, col.out);
  put(cx + 4, eyeY, opts.chargeGlow ? P.white : glow);
  put(cx + 5, eyeY, glow);
  put(cx + 6, eyeY, col.out);
  put(cx + 4, eyeY + 1, col.out);
  put(cx + 5, eyeY + 1, glowD);
  put(cx + 6, eyeY + 1, col.out);

  // Mouth — dark hollow in the bark
  rect(put, cx - 3, baseCy + 2, 6, 2, col.out);
  put(cx - 2, baseCy + 2, col.d);
  put(cx + 2, baseCy + 2, col.d);

  // Birth pockets — mossy bulges on trunk
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [
      [-6, -10], [0, -12], [6, -10]
    ];
    for (const [px, py] of pockets) {
      const ox = cx + px, oy = baseCy + py;
      if (stage === 0) {
        disc(put, ox, oy, 3, col.lfM);
        disc(put, ox, oy, 2, col.lf);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, col.lfD);
        disc(put, ox, oy, 2, col.out);
        put(ox, oy, col.lfL);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, col.lfD);
        disc(put, ox, oy, 2, P.wolfL);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, col.lfD);
        disc(put, ox, oy - 1, 3, P.wolfL);
        disc(put, ox, oy - 2, 2, P.wolf);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, col.out);
        disc(put, ox, oy, 2, col.d);
      }
    }
  }
}

type ForestBossFrame =
  | 'idle0' | 'idle1'
  | 'move0' | 'move1' | 'move2' | 'move3'
  | 'atk0' | 'atk1'
  | 'chargeWind'
  | 'hit'
  | 'birth0' | 'birth1' | 'birth2' | 'birth3' | 'birth4'
  | 'die0' | 'die1' | 'die2' | 'die3' | 'die4';

const forestBossFrames: ForestBossFrame[] = [
  'idle0','idle1',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind','hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

function drawForestBoss(frame: ForestBossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawEntBody(put, { bob: 0 });
      case 'idle1':      return drawEntBody(put, { bob: 1 });
      case 'move0':      return drawEntBody(put, { bob: 0, legStep: 1, armSwing: 0.5 });
      case 'move1':      return drawEntBody(put, { bob: 1, legStep: 0, armSwing: 0 });
      case 'move2':      return drawEntBody(put, { bob: 0, legStep: -1, armSwing: -0.5 });
      case 'move3':      return drawEntBody(put, { bob: 1, legStep: 0, armSwing: 0 });
      case 'atk0':       return drawEntBody(put, { rearUp: true, bob: -1, armSwing: 1 });
      case 'atk1':       return drawEntBody(put, { bob: 2, armSwing: -1 });
      case 'chargeWind': return drawEntBody(put, { chargeGlow: true, bob: 0 });
      case 'hit':        return drawEntBody(put, { flash: true });
      case 'birth0':     return drawEntBody(put, { pockets: 0 });
      case 'birth1':     return drawEntBody(put, { pockets: 1 });
      case 'birth2':     return drawEntBody(put, { pockets: 2 });
      case 'birth3':     return drawEntBody(put, { pockets: 3 });
      case 'birth4':     return drawEntBody(put, { pockets: 4 });
      case 'die0':       return drawForestBossDie(put, 0);
      case 'die1':       return drawForestBossDie(put, 1);
      case 'die2':       return drawForestBossDie(put, 2);
      case 'die3':       return drawForestBossDie(put, 3);
      case 'die4':       return drawForestBossDie(put, 4);
    }
  };
}

function drawForestBossDie(put: Put, step: number) {
  const cx = 32, cy = 36;
  const r = Math.max(0, 24 - step * 5);
  if (r > 0) {
    disc(put, cx, cy, r, P.barkD);
    disc(put, cx, cy, Math.max(0, r - 1), P.bark);
    disc(put, cx, cy, Math.max(0, r - 3), P.barkL);
  }
  // Leaves and bark chunks flying out
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 6 + 6;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, i % 2 === 0 ? P.barkD : P.leafD);
    put(x + 1, y, i % 2 === 0 ? P.leaf : P.leafM);
    if (i % 3 === 0) put(x, y + 1, P.barkL);
  }
  // Green flash instead of white
  if (step < 2) disc(put, cx, cy, 6, P.entEye);
}

function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// ==================================================================
//  OFF-SCREEN TOWER INDICATORS (32x32 logical → 64 physical)
// ==================================================================
function drawIndicatorArrow() {
  return (put: Put) => {
    const cx = 16, cy = 16;
    // Dark circle background
    disc(put, cx, cy, 13, P.outline);
    disc(put, cx, cy, 12, P.blueD);
    disc(put, cx, cy, 11, P.blueM);
    // Arrow icon in center
    // shaft
    rect(put, cx - 5, cy - 1, 10, 2, P.arrow);
    rect(put, cx - 5, cy, 10, 1, P.arrowD);
    // arrowhead
    put(cx + 5, cy - 3, P.stone); put(cx + 6, cy - 2, P.stone);
    put(cx + 7, cy - 1, P.stoneL); put(cx + 7, cy, P.stoneL);
    put(cx + 6, cy + 1, P.stone); put(cx + 5, cy + 2, P.stone);
    // fletching
    put(cx - 5, cy - 2, P.white); put(cx - 6, cy - 3, P.white);
    put(cx - 5, cy + 1, P.white); put(cx - 6, cy + 2, P.white);
  };
}

function drawIndicatorCannon() {
  return (put: Put) => {
    const cx = 16, cy = 16;
    // Dark circle background
    disc(put, cx, cy, 13, P.outline);
    disc(put, cx, cy, 12, '#2a1a0e');
    disc(put, cx, cy, 11, '#3e2a18');
    // Cannonball icon
    disc(put, cx, cy, 5, P.outline);
    disc(put, cx, cy, 4, P.stoneD);
    disc(put, cx, cy, 3, P.stoneM);
    // highlight
    put(cx - 1, cy - 2, P.stone);
    put(cx, cy - 2, P.stoneL);
    put(cx - 2, cy - 1, P.stone);
  };
}

function drawIndicatorBoss() {
  return (put: Put) => {
    const cx = 16, cy = 16;
    // Red circle background
    disc(put, cx, cy, 13, P.outline);
    disc(put, cx, cy, 12, '#4a0a0a');
    disc(put, cx, cy, 11, '#6a1a1a');
    // Skull icon: cranium
    disc(put, cx, cy - 1, 5, '#e8d8c8');
    disc(put, cx, cy - 2, 4, '#f0e4d4');
    // Eye sockets
    put(cx - 2, cy - 2, P.outline); put(cx - 2, cy - 1, P.outline);
    put(cx + 2, cy - 2, P.outline); put(cx + 2, cy - 1, P.outline);
    // Red eye glow
    put(cx - 2, cy - 2, '#ff3333'); put(cx + 2, cy - 2, '#ff3333');
    // Nose
    put(cx, cy, P.outline);
    // Jaw
    rect(put, cx - 3, cy + 2, 7, 2, '#d8c8b8');
    // Teeth
    put(cx - 2, cy + 2, P.outline); put(cx, cy + 2, P.outline); put(cx + 2, cy + 2, P.outline);
    put(cx - 2, cy + 3, P.outline); put(cx, cy + 3, P.outline); put(cx + 2, cy + 3, P.outline);
  };
}

function drawIndicatorPointer() {
  return (put: Put) => {
    // 16x16 — small triangle/chevron pointing right
    // Will be rotated at runtime to point toward the tower
    const cx = 8, cy = 8;
    // Triangle pointing right
    for (let row = 0; row < 7; row++) {
      const w = 7 - row;
      for (let col = 0; col < w; col++) {
        const px = cx + col;
        const py = cy - 3 + row;
        if (row === 0 || row === 6 || col >= w - 1) {
          put(px, py, P.outline);
        } else {
          put(px, py, P.white);
        }
      }
    }
  };
}

/** Create and register a ground chunk texture covering chunkSize×chunkSize tiles */
// Parse a hex color string to [r, g, b]
const _colorCache = new Map<string, [number, number, number]>();
function hexToRgb(hex: string): [number, number, number] {
  let c = _colorCache.get(hex);
  if (c) return c;
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _colorCache.set(hex, c);
  return c;
}

export function createGroundChunk(scene: Phaser.Scene, chunkX: number, chunkY: number, chunkSize: number, tileSize: number, biome = 'grasslands'): string {
  const key = `gnd_chunk_${chunkX}_${chunkY}`;
  if (scene.textures.exists(key)) return key;
  const pxSize = chunkSize * tileSize; // e.g. 16 * 32 = 512
  const canvas = document.createElement('canvas');
  canvas.width = pxSize; canvas.height = pxSize;
  const ctx = canvas.getContext('2d')!;
  // Use ImageData for bulk pixel writes — orders of magnitude faster than fillRect
  const imageData = ctx.createImageData(pxSize, pxSize);
  const buf = imageData.data;
  const startTX = chunkX * chunkSize;
  const startTY = chunkY * chunkSize;
  for (let ty = 0; ty < chunkSize; ty++) {
    for (let tx = 0; tx < chunkSize; tx++) {
      const worldTX = startTX + tx;
      const worldTY = startTY + ty;
      const draw = biome === 'forest' ? drawGroundForest(worldTX, worldTY)
                 : biome === 'infected' ? drawGroundInfected(worldTX, worldTY)
                 : drawGroundWorld(worldTX, worldTY);
      const ox = tx * tileSize;
      const oy = ty * tileSize;
      const put: Put = (x, y, col) => {
        if (col == null) return;
        const px = Math.floor(x), py = Math.floor(y);
        if (px < 0 || py < 0 || px >= tileSize || py >= tileSize) return;
        const idx = ((oy + py) * pxSize + (ox + px)) * 4;
        const [r, g, b] = hexToRgb(col);
        buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
      };
      draw(put);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}

let artGenerated = false;
export function generateAllArt(scene: Phaser.Scene) {
  if (artGenerated) return;
  artGenerated = true;
  // Player
  const pFrames: { k: string; f: PFrame }[] = [
    { k: 'p_idle_0',  f: 'idle0' },
    { k: 'p_idle_1',  f: 'idle1' },
    { k: 'p_move_0',  f: 'move0' },
    { k: 'p_move_1',  f: 'move1' },
    { k: 'p_move_2',  f: 'move2' },
    { k: 'p_move_3',  f: 'move3' },
    { k: 'p_shoot_0', f: 'shoot0' },
    { k: 'p_shoot_1', f: 'shoot1' }
  ];
  for (const { k, f } of pFrames) add(scene, k, makeCanvas(32, drawPlayer(f)));
  add(scene, 'p_hit_0', makeCanvas(32, drawPlayer('hit')));

  // Bow (separate rotatable sprite, 32x32, origin will be at ~left-center)
  // Drawn pointing right, pivot near the grip (left side)
  add(scene, 'bow_0', makeCanvas(32, drawBow(false)));
  add(scene, 'bow_1', makeCanvas(32, drawBow(true)));

  // Enemies
  const eFrames: EFrame[] = ['move0','move1','move2','move3','atk0','atk1','hit','die0','die1','die2','die3'];
  for (const f of eFrames) add(scene, `eb_${f}`, makeCanvas(32, drawEnemyBasic(f)));
  for (const f of eFrames) add(scene, `eh_${f}`, makeCanvas(32, drawEnemyHeavy(f)));
  for (const f of eFrames) add(scene, `eib_${f}`, makeCanvas(32, drawEnemyInfectedBasic(f)));
  for (const f of eFrames) add(scene, `eih_${f}`, makeCanvas(32, drawEnemyInfectedHeavy(f)));
  for (const f of eFrames) add(scene, `ew_${f}`, makeCanvas(32, drawEnemyWolf(f)));
  // Bear: extract frames from sprite sheet, strip grey bg, register as textures
  extractBearFrames(scene);
  for (const f of eFrames) add(scene, `es_${f}`, makeCanvas(32, drawEnemySpider(f)));

  // Shared helper to copy a loaded PNG texture to a new key
  const copyTex = (src: string, dst: string) => {
    if (scene.textures.exists(dst)) scene.textures.remove(dst);
    const srcTex = scene.textures.get(src);
    const srcImg = srcTex.getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = srcImg.width; c.height = srcImg.height;
    c.getContext('2d')!.drawImage(srcImg, 0, 0);
    scene.textures.addCanvas(dst, c);
  };

  // Tower — PNG base + procedural ballista top
  if (scene.textures.exists('t_base_png')) {
    copyTex('t_base_png', 't_base');
  } else {
    add(scene, 't_base',  makeCanvas(64, drawTowerBase));
  }
  // Arrow tower upgrade bases (level 1 = sprite #7, level 2 = sprite #0)
  if (scene.textures.exists('t_base_1_png')) {
    copyTex('t_base_1_png', 't_base_1');
  }
  if (scene.textures.exists('t_base_2_png')) {
    copyTex('t_base_2_png', 't_base_2');
  }
  // Cannon tower — PNG base (sprite #29)
  if (scene.textures.exists('c_base_png')) {
    const cleanAndCopy = (src: string, dst: string) => {
      if (scene.textures.exists(dst)) scene.textures.remove(dst);
      const srcTex = scene.textures.get(src);
      const srcImg = srcTex.getSourceImage() as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = srcImg.width; c.height = srcImg.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(srcImg, 0, 0);
      // Strip magenta fringe: any pixel where R and B are high but G is low
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > 180 && b > 180 && g < 100) {
          d[i + 3] = 0; // make transparent
        }
      }
      ctx.putImageData(id, 0, 0);
      scene.textures.addCanvas(dst, c);
    };
    cleanAndCopy('c_base_png', 'c_base');
  } else {
    add(scene, 'c_base', makeCanvas(64, drawTowerBase));
  }
  // Cannon tower upgrade bases (level 1 = sprite #11, level 2 = sprite #32)
  if (scene.textures.exists('c_base_1_png')) {
    copyTex('c_base_1_png', 'c_base_1');
  }
  if (scene.textures.exists('c_base_2_png')) {
    copyTex('c_base_2_png', 'c_base_2');
  }
  // Arrow tower: static archer body + rotatable bow (same system as player)
  add(scene, 't_archer', makeCanvas(32, drawTowerArcher));
  add(scene, 't_top_0', makeCanvas(32, drawTowerBow(false)));
  add(scene, 't_top_1', makeCanvas(32, drawTowerBow(true)));
  add(scene, 'c_mount', makeCanvas(64, drawCannonMount()));
  add(scene, 'c_top_0', makeCanvas(64, drawCannonTop(false)));
  add(scene, 'c_top_1', makeCanvas(64, drawCannonTop(true)));

  // Off-screen tower indicators
  add(scene, 'ind_arrow',  makeCanvas(32, drawIndicatorArrow()));
  add(scene, 'ind_cannon', makeCanvas(32, drawIndicatorCannon()));
  add(scene, 'ind_boss',   makeCanvas(32, drawIndicatorBoss()));
  add(scene, 'ind_ptr',    makeCanvas(16, drawIndicatorPointer()));

  // Green checkmark for level select
  {
    const s = 20;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const x = c.getContext('2d')!;
    // Black outline
    x.strokeStyle = '#000';
    x.lineWidth = 4;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(3, 10);
    x.lineTo(8, 16);
    x.lineTo(17, 4);
    x.stroke();
    // Green fill
    x.strokeStyle = '#4ad96a';
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(3, 10);
    x.lineTo(8, 16);
    x.lineTo(17, 4);
    x.stroke();
    add(scene, 'ui_check', c);
  }

  // Wall
  // Walls — 16 autotile variants (N=1, E=2, S=4, W=8) × normal/damaged
  for (let mask = 0; mask < 16; mask++) {
    add(scene, `wall_${mask}`,     makeCanvas(32, drawWall(mask, false)));
    add(scene, `wall_${mask}_dmg`, makeCanvas(32, drawWall(mask, true)));
  }
  // Legacy keys for ghost preview and default
  add(scene, 'wall',     makeCanvas(32, drawWall(0, false)));
  add(scene, 'wall_dmg', makeCanvas(32, drawWall(0, true)));

  // Arrow
  add(scene, 'arrow_0', makeCanvas(32, drawArrow(0)));
  add(scene, 'arrow_1', makeCanvas(32, drawArrow(1)));

  // Cannonball
  add(scene, 'cball_0', makeCanvas(32, drawCannonball(0)));
  add(scene, 'cball_1', makeCanvas(32, drawCannonball(1)));
  add(scene, 'cball_shadow', makeCanvas(32, drawCannonballShadow()));

  // Coin (bronze / silver / gold tiers)
  for (let i = 0; i < 6; i++) add(scene, `coin_${i}`, makeCanvas(32, drawCoin(i as any, 'gold')));
  for (const tier of ['bronze','silver','gold'] as const) {
    for (let i = 0; i < 6; i++) add(scene, `coin_${tier}_${i}`, makeCanvas(32, drawCoin(i as any, tier)));
  }

  // Effects
  for (let i = 0; i < 3; i++) add(scene, `fx_hit_${i}`,   makeCanvas(32, drawHitSpark(i as any)));
  for (let i = 0; i < 5; i++) add(scene, `fx_death_${i}`, makeCanvas(32, drawDeathBurst(i as any)));
  for (let i = 0; i < 3; i++) add(scene, `fx_pop_${i}`,   makeCanvas(32, drawCoinPop(i as any)));

  // Ground tile variations
  // Ground tiles are generated per-tile in GameScene.generateChunksAround()
  add(scene, 'foundation', makeCanvas(64, drawFoundation));

  // Tree cluster sprites (one per pattern)
  for (let i = 0; i < TREE_PATTERNS.length; i++) add(scene, `tree_cluster_${i}`, drawTreeClusterCanvas(i));

  // Infected plant cluster sprites (one per pattern)
  for (let i = 0; i < TREE_PATTERNS.length; i++) add(scene, `infected_plant_${i}`, drawInfectedPlantCanvas(i));

  // Firefly particle (tiny yellow-green glow, 4x4 logical)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#80c040';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#b0ff60';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'firefly', c);
  }

  // Infection spore particle (4x4 — purple/green glow)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#6030a0';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#a060e0';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'infection_spore', c);
  }

  // Infection spore green variant (4x4)
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d')!;
    x.fillStyle = '#208040';
    x.fillRect(0, 0, 4, 4);
    x.fillStyle = '#40e060';
    x.fillRect(1, 1, 2, 2);
    add(scene, 'infection_spore_green', c);
  }

  // Spider web texture (16x16 semi-transparent white circle)
  {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d')!;
    x.globalAlpha = 0.4;
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill();
    // Cross lines for web look
    x.globalAlpha = 0.5;
    x.strokeStyle = '#ffffff';
    x.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      x.beginPath();
      x.moveTo(16, 16);
      x.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13);
      x.stroke();
    }
    // Concentric rings
    x.globalAlpha = 0.3;
    for (const r of [5, 9, 12]) {
      x.beginPath(); x.arc(16, 16, r, 0, Math.PI * 2); x.stroke();
    }
    add(scene, 'spider_web', c);
  }

  // Boss (64x64 native — 2x2 tile footprint)
  const bossFrames: BossFrame[] = [
    'idle0','idle1',
    'move0','move1','move2','move3',
    'atk0','atk1',
    'chargeWind','hit',
    'birth0','birth1','birth2','birth3','birth4',
    'die0','die1','die2','die3','die4'
  ];
  for (const f of bossFrames) add(scene, `boss_${f}`, makeCanvas(64, drawBoss(f)));
  for (const f of bossFrames) add(scene, `iboss_${f}`, makeCanvas(64, drawInfectedBoss(f)));

  // Forest boss (Ent) textures
  for (const f of forestBossFrames) add(scene, `fboss_${f}`, makeCanvas(64, drawForestBoss(f)));
}

function framesFromKeys(keys: string[]): Phaser.Types.Animations.AnimationFrame[] {
  return keys.map(k => ({ key: k }));
}

export function registerAnimations(scene: Phaser.Scene) {
  const a = scene.anims;
  const mk = (key: string, keys: string[], frameRate: number, repeat: number) => {
    if (a.exists(key)) a.remove(key);
    a.create({ key, frames: framesFromKeys(keys), frameRate, repeat });
  };

  mk('player-idle',  ['p_idle_0', 'p_idle_1'], 3, -1);
  mk('player-move',  ['p_move_0','p_move_1','p_move_2','p_move_3'], 10, -1);
  mk('player-shoot', ['p_shoot_0','p_shoot_1'], 14, 0);
  mk('player-hit',   ['p_hit_0'], 8, 0);
  mk('bow-idle',  ['bow_0'], 1, 0);
  mk('bow-shoot', ['bow_1', 'bow_0'], 10, 0);

  mk('eb-move', ['eb_move0','eb_move1','eb_move2','eb_move3'], 8, -1);
  mk('eb-atk',  ['eb_atk0','eb_atk1'], 8, -1);
  mk('eb-hit',  ['eb_hit'], 10, 0);
  mk('eb-die',  ['eb_die0','eb_die1','eb_die2','eb_die3'], 10, 0);

  mk('eh-move', ['eh_move0','eh_move1','eh_move2','eh_move3'], 6, -1);
  mk('eh-atk',  ['eh_atk0','eh_atk1'], 6, -1);
  mk('eh-hit',  ['eh_hit'], 8, 0);
  mk('eh-die',  ['eh_die0','eh_die1','eh_die2','eh_die3'], 8, 0);

  mk('eib-move', ['eib_move0','eib_move1','eib_move2','eib_move3'], 8, -1);
  mk('eib-atk',  ['eib_atk0','eib_atk1'], 8, -1);
  mk('eib-hit',  ['eib_hit'], 10, 0);
  mk('eib-die',  ['eib_die0','eib_die1','eib_die2','eib_die3'], 10, 0);

  mk('eih-move', ['eih_move0','eih_move1','eih_move2','eih_move3'], 6, -1);
  mk('eih-atk',  ['eih_atk0','eih_atk1'], 6, -1);
  mk('eih-hit',  ['eih_hit'], 8, 0);
  mk('eih-die',  ['eih_die0','eih_die1','eih_die2','eih_die3'], 8, 0);

  mk('ew-move', ['ew_move0','ew_move1','ew_move2','ew_move3'], 10, -1);
  mk('ew-atk',  ['ew_atk0','ew_atk1'], 10, -1);
  mk('ew-hit',  ['ew_hit'], 10, 0);
  mk('ew-die',  ['ew_die0','ew_die1','ew_die2','ew_die3'], 10, 0);

  // Bear: directional animations (right-facing and left-facing)
  mk('ear-move', ['ear_move0','ear_move1','ear_move2','ear_move3','ear_move4','ear_move5','ear_move6','ear_move7'], 10, -1);
  mk('ear-atk',  ['ear_atk0','ear_atk1','ear_atk2','ear_atk3','ear_atk4'], 6, 0);
  mk('ear-hit',  ['ear_hit'], 8, 0);
  mk('ear-die',  ['ear_die0','ear_die1','ear_die2','ear_die3'], 8, 0);
  mk('eal-move', ['eal_move0','eal_move1','eal_move2','eal_move3','eal_move4','eal_move5','eal_move6','eal_move7'], 10, -1);
  mk('eal-atk',  ['eal_atk0','eal_atk1','eal_atk2','eal_atk3','eal_atk4'], 6, 0);
  mk('eal-hit',  ['eal_hit'], 8, 0);
  mk('eal-die',  ['eal_die0','eal_die1','eal_die2','eal_die3'], 8, 0);

  mk('es-move', ['es_move0','es_move1','es_move2','es_move3'], 8, -1);
  mk('es-atk',  ['es_atk0','es_atk1'], 8, -1);
  mk('es-hit',  ['es_hit'], 10, 0);
  mk('es-die',  ['es_die0','es_die1','es_die2','es_die3'], 10, 0);

  mk('tower-top-idle',  ['t_top_0'], 1, 0);
  mk('tower-top-shoot', ['t_top_1','t_top_0'], 14, 0);
  mk('cannon-top-idle',  ['c_top_0'], 1, 0);
  mk('cannon-top-shoot', ['c_top_1','c_top_0'], 10, 0);

  mk('arrow-spin', ['arrow_0','arrow_1'], 20, -1);
  mk('cball-spin', ['cball_0','cball_1'], 8, -1);

  mk('coin-spin',  ['coin_0','coin_1','coin_2','coin_3','coin_4','coin_5'], 10, -1);
  for (const tier of ['bronze','silver','gold'] as const) {
    mk(`coin-${tier}-spin`,
      [`coin_${tier}_0`,`coin_${tier}_1`,`coin_${tier}_2`,`coin_${tier}_3`,`coin_${tier}_4`,`coin_${tier}_5`],
      10, -1);
  }

  mk('fx-hit',    ['fx_hit_0','fx_hit_1','fx_hit_2'], 22, 0);
  mk('fx-death',  ['fx_death_0','fx_death_1','fx_death_2','fx_death_3','fx_death_4'], 18, 0);
  mk('fx-pop',    ['fx_pop_0','fx_pop_1','fx_pop_2'], 20, 0);

  // Boss
  mk('boss-idle',       ['boss_idle0','boss_idle1'], 2, -1);
  mk('boss-move',       ['boss_move0','boss_move1','boss_move2','boss_move3'], 5, -1);
  mk('boss-atk',        ['boss_atk0','boss_atk1'], 4, 0);
  mk('boss-chargewind', ['boss_chargeWind','boss_idle0'], 6, -1);
  mk('boss-hit',        ['boss_hit'], 10, 0);
  mk('boss-birth',      ['boss_birth0','boss_birth1','boss_birth2','boss_birth3','boss_birth4'], 4, 0);
  mk('boss-die',        ['boss_die0','boss_die1','boss_die2','boss_die3','boss_die4'], 6, 0);

  // Infected boss animations
  mk('iboss-idle',       ['iboss_idle0','iboss_idle1'], 2, -1);
  mk('iboss-move',       ['iboss_move0','iboss_move1','iboss_move2','iboss_move3'], 5, -1);
  mk('iboss-atk',        ['iboss_atk0','iboss_atk1'], 4, 0);
  mk('iboss-chargewind', ['iboss_chargeWind','iboss_idle0'], 6, -1);
  mk('iboss-hit',        ['iboss_hit'], 10, 0);
  mk('iboss-birth',      ['iboss_birth0','iboss_birth1','iboss_birth2','iboss_birth3','iboss_birth4'], 4, 0);
  mk('iboss-die',        ['iboss_die0','iboss_die1','iboss_die2','iboss_die3','iboss_die4'], 6, 0);

  // Forest boss (Ent) animations
  mk('fboss-idle',       ['fboss_idle0','fboss_idle1'], 2, -1);
  mk('fboss-move',       ['fboss_move0','fboss_move1','fboss_move2','fboss_move3'], 5, -1);
  mk('fboss-atk',        ['fboss_atk0','fboss_atk1'], 4, 0);
  mk('fboss-chargewind', ['fboss_chargeWind','fboss_idle0'], 6, -1);
  mk('fboss-hit',        ['fboss_hit'], 10, 0);
  mk('fboss-birth',      ['fboss_birth0','fboss_birth1','fboss_birth2','fboss_birth3','fboss_birth4'], 4, 0);
  mk('fboss-die',        ['fboss_die0','fboss_die1','fboss_die2','fboss_die3','fboss_die4'], 6, 0);
}
