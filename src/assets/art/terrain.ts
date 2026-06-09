// All terrain art: ground tiles per biome, river/rocks, tree clusters,
// castle spikes, infected-plant clusters, and the tower foundation pad.
// Also exports the TREE/SPIKE pattern arrays consumed by ChunkSystem.

import Phaser from 'phaser';
import {
  Put, PutRGB, P, S,
  pxIdx, pxEq, scale2x, makeCanvas, mirrorX,
  rect, disc, ring, line, hexToRgb, add,
} from './canvas';

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

// ---- River geometry (pixel-level, smooth curves) ----
// River 0: runs north-south (vertical), center X varies with Y
// River 1: runs east-west (horizontal), center Y varies with X
export const RIVER_HALF_W = 40;  // half-width of water in pixels
const ROCK_W = 14;        // rock border width in pixels

// Vertical river: returns center X for a given world-pixel Y
function riverVerticalCenterX(worldPy: number): number {
  return -4 * 32
    + Math.sin(worldPy * 0.0025) * 120
    + Math.sin(worldPy * 0.007 + 2.0) * 40
    + Math.sin(worldPy * 0.018 + 5.0) * 15;
}

// Horizontal river: returns center Y for a given world-pixel X
export function riverHorizontalCenterY(worldPx: number): number {
  return -6 * 32
    + Math.sin(worldPx * 0.003) * 100
    + Math.sin(worldPx * 0.008 + 1.5) * 35
    + Math.sin(worldPx * 0.02 + 4.0) * 12;
}

// For squiggle spawning — riverIdx 0 = vertical, 1 = horizontal
export function riverCenterPx(riverIdx: number, worldPy: number): number {
  if (riverIdx === 0) return riverVerticalCenterX(worldPy);
  // For horizontal river, return the X where the river crosses this Y
  // (not perfectly accurate but good enough for squiggle placement)
  return 0; // squiggles will use a different approach for horizontal
}

/** Pixel-level river classification for a world-pixel coordinate. */
function riverPixelKind(worldPx: number, worldPy: number): 'water' | 'rock' | null {
  // Vertical river: distance from center X
  const vcx = riverVerticalCenterX(worldPy);
  const vdist = Math.abs(worldPx - vcx);
  if (vdist <= RIVER_HALF_W + ROCK_W) {
    if (vdist < RIVER_HALF_W) return 'water';
    return 'rock';
  }
  // Horizontal river: distance from center Y
  const hcy = riverHorizontalCenterY(worldPx);
  const hdist = Math.abs(worldPy - hcy);
  if (hdist <= RIVER_HALF_W + ROCK_W) {
    if (hdist < RIVER_HALF_W) return 'water';
    return 'rock';
  }
  return null;
}

/**
 * Determines the dominant type for a grid tile by sampling its pixels.
 * Returns the grid value: 4 = water/rock (impassable), 5 = bridge (walkable, unbuildable), 0 = grass.
 */
export function getRiverTileGrid(tileX: number, tileY: number): number {
  const basePx = tileX * 32;
  const basePy = tileY * 32;
  let riverCount = 0;
  // Sample a 4x4 grid within the tile for speed
  for (let sy = 4; sy < 32; sy += 8) {
    for (let sx = 4; sx < 32; sx += 8) {
      const k = riverPixelKind(basePx + sx, basePy + sy);
      if (k === 'water' || k === 'rock') riverCount++;
    }
  }
  // Majority rules — need at least 4/16 samples to count
  if (riverCount >= 4) return 4;
  return 0;
}

// Deterministic rock positions along the river edges.
function getRocksNear(basePx: number, basePy: number): { wx: number; wy: number; r: number; shade: number }[] {
  const rocks: { wx: number; wy: number; r: number; shade: number }[] = [];
  const margin = 12;

  // Helper: is a point inside either river's water?
  const inWater = (px: number, py: number) => {
    const vd = Math.abs(px - riverVerticalCenterX(py));
    if (vd < RIVER_HALF_W) return true;
    const hd = Math.abs(py - riverHorizontalCenterY(px));
    if (hd < RIVER_HALF_W) return true;
    return false;
  };

  // Vertical river rocks — scan along Y
  for (let wy = basePy - margin; wy < basePy + 32 + margin; wy += 5) {
    const cx = riverVerticalCenterX(wy);
    const h = ((wy * 73856093 + 19349669) >>> 0) % 2147483647;
    const jx = (h % 11) - 5;
    const jy = ((h >> 8) % 7) - 3;
    const radius = 4 + (h >> 16) % 4;
    const shade = (h >> 20) % 4;
    const lx = Math.round(cx - RIVER_HALF_W - 3 + jx), ly = wy + jy;
    const rx = Math.round(cx + RIVER_HALF_W + 3 - jx), ry = wy + jy;
    if (!inWater(lx, ly)) rocks.push({ wx: lx, wy: ly, r: radius, shade });
    if (!inWater(rx, ry)) rocks.push({ wx: rx, wy: ry, r: radius, shade });
  }

  // Horizontal river rocks — scan along X
  for (let wx = basePx - margin; wx < basePx + 32 + margin; wx += 5) {
    const cy = riverHorizontalCenterY(wx);
    const h = ((wx * 73856093 + 48271 * 19349669) >>> 0) % 2147483647;
    const jy = (h % 11) - 5;
    const jx = ((h >> 8) % 7) - 3;
    const radius = 4 + (h >> 16) % 4;
    const shade = (h >> 20) % 4;
    const tx = wx + jx, ty = Math.round(cy - RIVER_HALF_W - 3 + jy);
    const bx = wx + jx, by = Math.round(cy + RIVER_HALF_W + 3 - jy);
    if (!inWater(tx, ty)) rocks.push({ wx: tx, wy: ty, r: radius, shade });
    if (!inWater(bx, by)) rocks.push({ wx: bx, wy: by, r: radius, shade });
  }

  return rocks;
}

// River ground drawing — pixel-level with natural water and round rock borders
// Uses PutRGB for water pixels to avoid hex string encode/decode overhead.
function drawGroundRiver(tileX: number, tileY: number) {
  return (put: Put, putRGB?: PutRGB) => {
    const basePx = tileX * 32;
    const basePy = tileY * 32;
    let s = ((tileX * 73856093 + tileY * 19349669) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    // Precompute grass noise
    const sampleGrass = precomputeNoise(tileX, tileY, 8000, 1000, 400);
    const grassShades = ['#2a4826', '#325230', '#3c5e36', '#486a3e'];

    // Precompute vertical river center X for each row
    const vcx = new Float32Array(32);
    for (let py = 0; py < 32; py++) {
      vcx[py] = riverVerticalCenterX(basePy + py);
    }
    // Precompute horizontal river center Y for each column
    const hcy = new Float32Array(32);
    for (let px = 0; px < 32; px++) {
      hcy[px] = riverHorizontalCenterY(basePx + px);
    }

    // Collect rocks near this tile
    const rocks = getRocksNear(basePx, basePy);

    // Rock color palettes as RGB arrays: [outline, dark, base, highlight]
    const rockRGB = [
      [[0x2a,0x24,0x20],[0x4a,0x44,0x40],[0x6a,0x64,0x60],[0x8a,0x84,0x7a]],
      [[0x2a,0x22,0x18],[0x4a,0x3e,0x38],[0x6a,0x5e,0x54],[0x8a,0x7e,0x70]],
      [[0x28,0x26,0x1e],[0x48,0x44,0x38],[0x68,0x62,0x58],[0x88,0x7e,0x72]],
      [[0x2e,0x2a,0x24],[0x50,0x4a,0x44],[0x70,0x6a,0x62],[0x90,0x88,0x80]],
    ];

    const writeRGB = putRGB ?? ((x: number, y: number, r: number, g: number, b: number) => {
      put(x, y, '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0'));
    });

    // First pass: draw base layer (grass, water)
    for (let py = 0; py < 32; py++) {
      const wpyBase = basePy + py;
      const vc = vcx[py];
      for (let px = 0; px < 32; px++) {
        const wpx = basePx + px;
        const hc = hcy[px];

        // Check vertical river
        const vd = Math.abs(wpx - vc);
        // Check horizontal river
        const hd = Math.abs(wpyBase - hc);

        // Determine kind: pick the closer river
        let kind = 0; // 0=none, 1=water, 2=rock
        let depth = 0;
        const vTotal = RIVER_HALF_W + ROCK_W;
        if (vd <= vTotal || hd <= vTotal) {
          // Water if within HALF_W of either river
          const vWater = vd < RIVER_HALF_W;
          const hWater = hd < RIVER_HALF_W;
          if (vWater || hWater) {
            kind = 1;
            // Depth from whichever river is closer (or merge at intersection)
            if (vWater) {
              const t = 1 - vd / RIVER_HALF_W;
              depth = t * t * (3 - 2 * t);
            }
            if (hWater) {
              const t = 1 - hd / RIVER_HALF_W;
              const dd = t * t * (3 - 2 * t);
              if (dd > depth) depth = dd;
            }
          } else {
            kind = 2; // rock border
          }
        }

        if (kind === 1) {
          // Base color: blend from shore blue to deep center blue
          let br = 0x1e + (0x14 - 0x1e) * depth;
          let bg = 0x40 + (0x30 - 0x40) * depth;
          let bb = 0x72 + (0x6a - 0x72) * depth;

          // Layer 1: large slow noise
          const n1 = Math.sin(wpx * 0.02 + wpyBase * 0.015);
          br += n1 * 5; bg += n1 * 4; bb += n1 * 6;

          // Layer 2: flowing current
          const flow = Math.sin(wpx * 0.08 + wpyBase * 0.04) * Math.sin(wpyBase * 0.06 + wpx * 0.01);
          br += flow * 4 * depth; bg += flow * 5 * depth; bb += flow * 3 * depth;

          // Layer 3: fine ripple texture
          const ripple = Math.sin(wpx * 0.18 + wpyBase * 0.06) * Math.cos(wpyBase * 0.12 - wpx * 0.04);
          br += ripple * 4; bg += ripple * 3; bb += ripple * 5;

          writeRGB(px, py,
            br < 0 ? 0 : br > 255 ? 255 : (br + 0.5) | 0,
            bg < 0 ? 0 : bg > 255 ? 255 : (bg + 0.5) | 0,
            bb < 0 ? 0 : bb > 255 ? 255 : (bb + 0.5) | 0);
        } else if (kind === 2) {
          const gn = sampleGrass(px, py);
          const gi = Math.min(3, Math.floor(gn * 4));
          put(px, py, grassShades[gi]);
        } else {
          const gn = sampleGrass(px, py);
          const gi = Math.min(3, Math.floor(gn * 4));
          put(px, py, grassShades[gi]);
        }
      }
    }

    // Second pass: stamp round rocks on top
    for (const rock of rocks) {
      const pal = rockRGB[rock.shade];
      const rx = rock.wx - basePx;
      const ry = rock.wy - basePy;
      const rr = rock.r;
      const rr2 = rr * rr;
      const rr1 = (rr + 1) * (rr + 1);
      for (let dy = -rr - 1; dy <= rr + 1; dy++) {
        for (let dx = -rr - 1; dx <= rr + 1; dx++) {
          const lx = rx + dx, ly = ry + dy;
          if (lx < 0 || lx >= 32 || ly < 0 || ly >= 32) continue;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > rr1) continue;
          if (dist2 > rr2) {
            writeRGB(lx, ly, pal[0][0], pal[0][1], pal[0][2]);
          } else {
            const shade = (dx + dy) / (rr * 2);
            const ci = shade < -0.3 ? 3 : shade < 0.2 ? 2 : 1;
            writeRGB(lx, ly, pal[ci][0], pal[ci][1], pal[ci][2]);
          }
        }
      }
    }

    // Scattered flowers on grass
    const flowerColors = ['#e84060', '#e8d040', '#d070e0', '#70a0e8', '#e8a040'];
    if (rnd() < 0.15) {
      for (let i = 0; i < 2; i++) {
        const fx = 2 + Math.floor(rnd() * 28);
        const fy = 2 + Math.floor(rnd() * 28);
        const wfx = basePx + fx, wfy = basePy + fy;
        const onRiver = Math.abs(wfx - vcx[fy]) <= RIVER_HALF_W + ROCK_W
                     || Math.abs(wfy - hcy[fx]) <= RIVER_HALF_W + ROCK_W;
        if (!onRiver) {
          put(fx, fy, flowerColors[Math.floor(rnd() * flowerColors.length)]);
          put(fx, fy + 1, '#1a3a18');
        }
      }
    }
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

// Castle ground — smooth flagstone and courtyard dirt with decorations
function drawGroundCastle(tileX: number, tileY: number) {
  return (put: Put) => {
    let s = ((tileX * 73856093 + tileY * 19349669) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

    // Use noise to decide flagstone vs dirt zones
    const sampleN = precomputeNoise(tileX, tileY, 5000, 3000, 600);

    // Flagstone shades
    const stoneShades = ['#4e5864', '#5a6270', '#525c68', '#636d7a'];
    // Dirt shades
    const dirtShades = ['#4a3a28', '#5a4a38', '#6a5a46', '#524232'];
    // Mortar color
    const mortar = '#3e4654';

    // Per-pixel hash for dithering at transitions
    const pxHash = (x: number, y: number) => {
      let h = ((x * 374761393 + y * 668265263 + 1274126177) >>> 0);
      h = ((h ^ (h >> 13)) * 1103515245 + 12345) >>> 0;
      return (h & 0xffff) / 0xffff;
    };
    const transitionW = 0.06; // noise range over which we dither

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const n = sampleN(px, py);
        const worldPx = tileX * 32 + px;
        const worldPy = tileY * 32 + py;

        // Transition dithering: in the band around 0.45, randomly mix both textures
        const threshold = 0.45;
        let useStone: boolean;
        if (n > threshold + transitionW) {
          useStone = true;
        } else if (n < threshold - transitionW) {
          useStone = false;
        } else {
          // Dither zone: probability ramps from 0 to 1 across the band
          const t = (n - (threshold - transitionW)) / (2 * transitionW);
          useStone = pxHash(worldPx, worldPy) < t;
        }

        if (useStone) {
          // Flagstone zone
          // Grid pattern for stone slabs (16x16 slabs with offset rows)
          const slabRow = Math.floor(worldPy / 16);
          const slabOff = (slabRow % 2) * 8;
          const localX = (worldPx + slabOff) % 16;
          const localY = worldPy % 16;
          // Mortar lines
          if (localX === 0 || localY === 0) {
            put(px, py, mortar);
          } else {
            // Shade variation per slab
            const slabSeed = ((Math.floor((worldPx + slabOff) / 16) * 7919 + slabRow * 104729) >>> 0) % 4;
            put(px, py, stoneShades[slabSeed]);
          }
        } else {
          // Dirt zone
          const di = Math.floor(rnd() * dirtShades.length);
          put(px, py, dirtShades[di < dirtShades.length ? di : 0]);
        }
      }
    }

    // Subtle stone speckles in flagstone areas
    for (let i = 0; i < 20; i++) {
      const sx = Math.floor(rnd() * 32), sy = Math.floor(rnd() * 32);
      const n = sampleN(sx, sy);
      if (n > 0.45) put(sx, sy, rnd() > 0.5 ? '#6a747e' : '#4a5462');
    }

    // Pebbles in dirt areas
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(rnd() * 32), sy = Math.floor(rnd() * 32);
      const n = sampleN(sx, sy);
      if (n <= 0.45) put(sx, sy, '#7a7060');
    }

    // --- Decorations (deterministic per tile) ---

    // Crack pattern (~12% of tiles)
    if (rnd() < 0.12) {
      const cx = 4 + Math.floor(rnd() * 24);
      const cy = 4 + Math.floor(rnd() * 24);
      const len = 4 + Math.floor(rnd() * 8);
      const dx = rnd() > 0.5 ? 1 : 0;
      const dy = rnd() > 0.5 ? 1 : (dx === 0 ? 1 : 0);
      for (let i = 0; i < len; i++) {
        put(cx + i * dx + Math.floor(rnd() * 2 - 0.5), cy + i * dy + Math.floor(rnd() * 2 - 0.5), '#3a4250');
      }
    }

    // Scorch mark (~2% of tiles)
    if (rnd() < 0.02) {
      const sx = 8 + Math.floor(rnd() * 16);
      const sy = 8 + Math.floor(rnd() * 16);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy <= 9) {
            const px2 = sx + dx, py2 = sy + dy;
            if (px2 >= 0 && px2 < 32 && py2 >= 0 && py2 < 32) {
              put(px2, py2, dx * dx + dy * dy <= 4 ? '#1a1a22' : '#2a2a30');
            }
          }
        }
      }
    }

    // Moss patch (~10% of tiles)
    if (rnd() < 0.10) {
      const mx = 8 + Math.floor(rnd() * 16);
      const my = 8 + Math.floor(rnd() * 16);
      for (let i = 0; i < 8; i++) {
        put(mx + Math.floor(rnd() * 6 - 3), my + Math.floor(rnd() * 6 - 3), rnd() > 0.5 ? '#2e4a2a' : '#3e5f38');
      }
    }

    // Bones (~6% of tiles) — varied patterns
    if (rnd() < 0.06) {
      const bx = 6 + Math.floor(rnd() * 20);
      const by = 8 + Math.floor(rnd() * 16);
      const bone = '#c8c0b0';
      const boneHi = '#d8d0c0';
      const boneLo = '#a8a090';
      const pattern = Math.floor(rnd() * 5);
      if (pattern === 0) {
        // Femur — diagonal with knobs
        put(bx, by, boneHi); put(bx + 1, by, bone);
        put(bx + 1, by + 1, bone); put(bx + 2, by + 1, bone);
        put(bx + 2, by + 2, bone); put(bx + 3, by + 2, boneHi);
        put(bx - 1, by, boneLo); put(bx + 4, by + 2, boneLo);
      } else if (pattern === 1) {
        // Skull fragment — small circle
        put(bx, by, bone); put(bx + 1, by, boneHi); put(bx + 2, by, bone);
        put(bx, by + 1, boneHi); put(bx + 1, by + 1, '#2a2228'); put(bx + 2, by + 1, boneHi);
        put(bx, by + 2, boneLo); put(bx + 1, by + 2, boneLo); put(bx + 2, by + 2, boneLo);
      } else if (pattern === 2) {
        // Ribcage — curved lines
        put(bx, by, bone); put(bx + 1, by - 1, bone); put(bx + 2, by - 1, boneHi); put(bx + 3, by, bone);
        put(bx, by + 2, boneLo); put(bx + 1, by + 1, boneLo); put(bx + 2, by + 1, bone); put(bx + 3, by + 2, boneLo);
      } else if (pattern === 3) {
        // Crossed bones — X shape
        put(bx, by, boneHi); put(bx + 3, by, boneHi);
        put(bx + 1, by + 1, bone); put(bx + 2, by + 1, bone);
        put(bx + 1, by + 2, bone); put(bx + 2, by + 2, bone);
        put(bx, by + 3, boneLo); put(bx + 3, by + 3, boneLo);
      } else {
        // Scattered small bones — 2-3 fragments
        put(bx, by, bone); put(bx + 1, by, boneHi);
        put(bx + 3, by + 2, bone); put(bx + 4, by + 2, boneLo);
        if (rnd() > 0.4) { put(bx + 1, by + 3, boneLo); put(bx + 2, by + 3, bone); }
      }
    }

    // Fallen leaves (~10% of tiles)
    if (rnd() < 0.10) {
      const leafColors = ['#6a4a20', '#8a5a20', '#5a3a10', '#9a6a30'];
      for (let i = 0; i < 3; i++) {
        const lx = 4 + Math.floor(rnd() * 24);
        const ly = 4 + Math.floor(rnd() * 24);
        const col = leafColors[Math.floor(rnd() * leafColors.length)];
        put(lx, ly, col);
        put(lx + 1, ly, col);
      }
    }
  };
}

function drawGroundDesert(tileX: number, tileY: number, levelId = 6) {
  return (put: Put) => {
    let s = ((tileX * 73856093 + tileY * 19349669 + levelId * 83492791) >>> 0) % 2147483647;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const sampleN = precomputeNoise(tileX, tileY, 7000 + levelId * 300, 4000, levelId === 8 ? 180 : 360);
    const sampleBands = precomputeNoise(tileX, tileY, 2000, 9000 + levelId * 500, levelId === 7 ? 420 : 520);
    const pxHash = (x: number, y: number) => {
      let h = ((x * 374761393 + y * 668265263 + levelId * 1442695041) >>> 0);
      h = ((h ^ (h >> 13)) * 1103515245 + 12345) >>> 0;
      return (h & 0xffff) / 0xffff;
    };

    const fissureSand = ['#9f7b46', '#aa854f', '#b28e59', '#92703f'];
    const duneSand = ['#b89356', '#bd995d', '#c5a366', '#ae8950'];
    const templeStone = ['#8f6e42', '#9a7849', '#a88654', '#7d603a'];
    const palette = levelId === 8 ? templeStone : levelId === 7 ? duneSand : fissureSand;

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < 32; px++) {
        const wx = tileX * 32 + px;
        const wy = tileY * 32 + py;
        const n = sampleN(px, py);
        const b = sampleBands(px, py);
        let idx = Math.min(3, Math.floor(n * 4));
        if (levelId === 7) {
          const wave = Math.sin((wx + wy * 0.35) * 0.024) * 0.5 + 0.5;
          const duneTone = 0.18 + (wave * 0.5 + b * 0.3) * 0.68;
          idx = Math.min(3, Math.floor(duneTone * 4));
        }
        put(px, py, palette[idx]);

        if (levelId === 8) {
          const slabX = ((wx % 32) + 32) % 32;
          const slabY = ((wy % 32) + 32) % 32;
          if (slabX === 0 || slabY === 0) put(px, py, '#5e462a');
          else if (slabX === 1 || slabY === 1) put(px, py, '#b99662');
          if ((slabX === 14 || slabX === 15) && pxHash(wx, wy) < 0.18) put(px, py, '#6c5030');
        }
      }
    }

    if (levelId === 7 && rnd() < 0.24) {
      const y = 4 + Math.floor(rnd() * 24);
      for (let x = 2; x < 30; x++) {
        if (Math.sin((tileX * 32 + x) * 0.11 + y * 0.16) > 0.45) {
          put(x, y + Math.floor(Math.sin(x * 0.14) * 2), '#d9bc7c');
        }
      }
    }

    if (levelId === 8 && rnd() < 0.22) {
      const cx = 5 + Math.floor(rnd() * 22);
      const cy = 5 + Math.floor(rnd() * 22);
      for (let i = 0; i < 8; i++) {
        put(cx + Math.floor(rnd() * 7 - 3), cy + Math.floor(rnd() * 7 - 3), rnd() < 0.5 ? '#594126' : '#c7a36a');
      }
    }

    if (rnd() < 0.2) {
      const rx = 2 + Math.floor(rnd() * 28);
      const ry = 2 + Math.floor(rnd() * 28);
      put(rx, ry, '#6d5942');
      if (rnd() < 0.6) put(rx + 1, ry, '#4f3f30');
    }
  };
}

function drawWorldFissures(ctx: CanvasRenderingContext2D, chunkX: number, chunkY: number, chunkSize: number, tileSize: number) {
  const pxSize = chunkSize * tileSize;
  const worldX0 = chunkX * chunkSize * tileSize;
  const worldY0 = chunkY * chunkSize * tileSize;
  const cellPx = tileSize * 1.48;
  const rowPx = cellPx * 0.96;
  const cellX0 = Math.floor(worldX0 / cellPx) - 1;
  const cellX1 = Math.floor((worldX0 + pxSize) / cellPx) + 1;
  const cellY0 = Math.floor(worldY0 / rowPx) - 1;
  const cellY1 = Math.floor((worldY0 + pxSize) / rowPx) + 1;

  const hash01 = (a: number, b: number, salt: number) => {
    let h = ((a * 374761393 + b * 668265263 + salt * 2246822519) >>> 0);
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h & 0xffff) / 0xffff;
  };

  const crackPoint = (cx: number, cy: number) => ({
    x: cx * cellPx + (hash01(cx, cy, 2001) - 0.5) * cellPx * 0.48,
    y: cy * rowPx + (hash01(cx, cy, 3001) - 0.5) * rowPx * 0.48,
  });

  const strokePath = (pts: { x: number; y: number }[], width: number, color: string, alpha: number, close = false) => {
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x - worldX0, pts[0].y - worldY0);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - worldX0, pts[i].y - worldY0);
    if (close) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  const drawCrack = (from: { x: number; y: number }, to: { x: number; y: number }, seedA: number, seedB: number, salt: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const invLen = 1 / Math.max(1, Math.hypot(dx, dy));
    const nx = -dy * invLen;
    const ny = dx * invLen;
    const pts = [from];
    const segments = 2 + Math.floor(hash01(seedA, seedB, salt + 11) * 3);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const wobble = (hash01(seedA + i * 17, seedB - i * 23, salt + 101) - 0.5) * cellPx * 0.18;
      pts.push({
        x: from.x + dx * t + nx * wobble,
        y: from.y + dy * t + ny * wobble,
      });
    }
    pts.push(to);
    const strength = 0.7 + hash01(seedA, seedB, salt + 211) * 0.24;
    strokePath(pts, 2.5, '#6d4a2b', 0.07 * strength);
    strokePath(pts, 1.25, '#9a7044', 0.09 * strength);
    strokePath(pts, 0.75, '#59402a', 0.1 * strength);
  };

  for (let cy = cellY0; cy <= cellY1 + 1; cy++) {
    for (let cx = cellX0; cx <= cellX1 + 1; cx++) {
      const p = crackPoint(cx, cy);
      if (cx <= cellX1 && hash01(cx, cy, 7001) < 0.96) {
        drawCrack(p, crackPoint(cx + 1, cy), cx, cy, 7001);
      }
      if (cy <= cellY1 && hash01(cx, cy, 8001) < 0.92) {
        drawCrack(p, crackPoint(cx, cy + 1), cx, cy, 8001);
      }
      if (hash01(cx, cy, 10001) < 0.1) {
        const target = crackPoint(cx + (hash01(cx, cy, 11001) < 0.5 ? -1 : 1), cy + 1);
        drawCrack(p, {
          x: p.x + (target.x - p.x) * 0.45,
          y: p.y + (target.y - p.y) * 0.45,
        }, cx, cy, 10001);
      }
    }
  }
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

// Castle floor spike cluster patterns. Same convex-shape rule the trees
// use so enemies don't path-stick on internal pockets. Each tile within
// a pattern is rendered with a randomly chosen variant texture so even
// long rows don't look stamped.
export const SPIKE_PATTERNS: { tiles: { dx: number; dy: number }[]; w: number; h: number }[] = [
  // Singles (still want some lone spikes mixed in)
  { tiles: [{ dx: 0, dy: 0 }], w: 1, h: 1 },
  // Pairs
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }], w: 2, h: 1 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }], w: 1, h: 2 },
  // Rows of 3
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }], w: 3, h: 1 },
  { tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }], w: 1, h: 3 },
  // 2x2 square
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }], w: 2, h: 2 },
  // 3x2 wide strip
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }], w: 3, h: 2 },
  // 2x3 tall strip
  { tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: 2 }], w: 2, h: 3 },
];

// Number of visual jitter variants registered as castle_spikes_0..N-1.
// Independent from SPIKE_PATTERNS so the cluster shape and the per-tile
// art aren't tangled.
export const SPIKE_VARIANT_COUNT = 3;
export const CACTUS_VARIANT_COUNT = 3;
export const QUICKSAND_VARIANT_COUNT = 4;
export const TEMPLE_BLOCK_VARIANT_COUNT = 3;

/** SMB-style staggered spike patch — 3 small back spikes + 2 larger
 *  front spikes for depth. variantIdx jitters x positions so nearby
 *  spike tiles don't all look identical. */
export function drawCastleSpikesCanvas(variantIdx: number): HTMLCanvasElement {
  const T = 32;
  const canvas = document.createElement('canvas');
  canvas.width = T; canvas.height = T;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Steel-blue palette (matches castle-spikes-options.html previews).
  const PAL = {
    outline: '#1d2027',
    dark:    '#2f3640',
    mid:     '#5a606c',
    light:   '#8e95a3',
    shine:   '#c8cdd6',
  };

  // Soft ground shadow under the cluster
  (function shadow(cx: number, cy: number, rx: number, ry: number) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#0e0e16';
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) ctx.fillRect(cx + xx, cy + yy, 1, 1);
    }
    ctx.restore();
  })(16, 28, 12, 2);

  // Triangle spike: lit-left / shaded-right with a dark outline + tip shine.
  function drawSpike(cx: number, baseY: number, halfBaseW: number, height: number) {
    for (let i = 0; i <= height; i++) {
      const y = baseY - i;
      const t = i / height;
      const w = Math.max(0, halfBaseW * (1 - t));
      const xL = Math.round(cx - w);
      const xR = Math.round(cx + w);
      ctx.fillStyle = PAL.mid;
      if (xR > xL) ctx.fillRect(xL, y, xR - xL, 1);
      ctx.fillStyle = PAL.dark;
      ctx.fillRect(cx, y, xR - cx + 1, 1);
      ctx.fillStyle = PAL.light;
      ctx.fillRect(xL, y, 1, 1);
      if (xR > xL) {
        ctx.fillStyle = PAL.outline;
        ctx.fillRect(xR, y, 1, 1);
      }
    }
    const tipY = baseY - height;
    ctx.fillStyle = PAL.shine;
    ctx.fillRect(cx - 1, tipY, 1, 1);
    ctx.fillRect(cx - 1, tipY + 1, 1, 1);
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(Math.round(cx - halfBaseW), baseY + 1, halfBaseW * 2 + 1, 1);
  }

  // Per-variant x jitter so consecutive spike tiles don't look stamped.
  const j = [-2, 0, 2][variantIdx % 3];

  // Back row (smaller, drawn first so the front overlaps them)
  drawSpike( 9 + j, 22, 3, 10);
  drawSpike(16 + j, 22, 3, 12);
  drawSpike(23 + j, 22, 3, 10);
  // Front row (larger)
  drawSpike(12 + j, 27, 4, 13);
  drawSpike(20 + j, 27, 4, 13);

  return canvas;
}

export function drawCactusCanvas(variantIdx: number): HTMLCanvasElement {
  const T = 32;
  const canvas = document.createElement('canvas');
  canvas.width = T; canvas.height = T;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const px = (x: number, y: number, c: string) => {
    if (x >= 0 && x < T && y >= 0 && y < T) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  };
  const block = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  };
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#1a1208';
  ctx.beginPath(); ctx.ellipse(16, 28, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  const body = variantIdx === 1 ? '#3f8a38' : variantIdx === 2 ? '#557f34' : '#2f7a38';
  const dark = variantIdx === 1 ? '#215a24' : '#204820';
  const light = '#80bd65';
  const flower = variantIdx === 2 ? '#ffd84a' : '#e35a84';
  block(13, 9, 6, 19, dark);
  block(14, 8, 5, 20, body);
  block(16, 8, 1, 19, light);
  block(8, 15, 4, 3, dark);
  block(8, 12, 3, 6, body);
  block(10, 12, 1, 5, light);
  block(20, 18, 5, 3, dark);
  block(22, 15, 3, 6, body);
  block(23, 15, 1, 5, light);
  for (let y = 11; y < 27; y += 4) {
    px(12, y, '#dbe8c8'); px(19, y + 1, '#dbe8c8');
  }
  for (let x = 14; x < 19; x++) px(x, 7, flower);
  px(16, 6, flower);
  return canvas;
}

export function drawQuicksandCanvas(variantIdx: number): HTMLCanvasElement {
  const T = 32;
  const canvas = document.createElement('canvas');
  canvas.width = T; canvas.height = T;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const colors = ['#8b6a3e', '#a07a48', '#c29a5a', '#6a5032'];
  ctx.fillStyle = '#6f5130';
  ctx.beginPath(); ctx.ellipse(16, 17, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9f7a45';
  ctx.beginPath(); ctx.ellipse(16, 16, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const y = 12 + i * 2;
    const phase = variantIdx + i;
    ctx.strokeStyle = colors[(i + variantIdx) % colors.length];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 6; x <= 26; x++) {
      const yy = y + Math.sin((x + phase * 3) * 0.55) * 1.5;
      if (x === 6) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#d8b878';
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.ellipse(12 + variantIdx, 12, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  return canvas;
}

export function drawTempleBlockCanvas(variantIdx: number): HTMLCanvasElement {
  const T = 32;
  const canvas = document.createElement('canvas');
  canvas.width = T; canvas.height = T;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#4f3821';
  ctx.fillRect(2, 4, 28, 24);
  ctx.fillStyle = variantIdx === 1 ? '#7b5a32' : variantIdx === 2 ? '#6d5538' : '#8b683c';
  ctx.fillRect(3, 3, 26, 23);
  ctx.fillStyle = '#b8945a';
  ctx.fillRect(4, 4, 24, 3);
  ctx.fillStyle = '#5f4528';
  ctx.fillRect(4, 14, 24, 2);
  ctx.fillRect(15, 5, 2, 20);
  ctx.fillStyle = '#c7a36a';
  ctx.fillRect(6 + variantIdx * 2, 8, 5, 2);
  ctx.fillRect(19, 19 - variantIdx, 4, 2);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(5, 25, 23, 2);
  return canvas;
}

// Draw a WC2-style conifer tree cluster — triangular tiered pine trees packed tightly
export function drawTreeClusterCanvas(patternIdx: number): HTMLCanvasElement {
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
export function drawInfectedPlantCanvas(patternIdx: number): HTMLCanvasElement {
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

export function drawFoundation(put: Put) {
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
/** Create and register a ground chunk texture covering chunkSize×chunkSize tiles */
export function createGroundChunk(scene: Phaser.Scene, chunkX: number, chunkY: number, chunkSize: number, tileSize: number, biome = 'grasslands'): string {
  const sceneLevelId = (scene as any).levelId ?? 1;
  const terrainKey = biome === 'desert' ? `${biome}_${sceneLevelId}` : biome;
  const key = `gnd_chunk_${terrainKey}_${chunkX}_${chunkY}`;
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
                 : biome === 'river' ? drawGroundRiver(worldTX, worldTY)
                 : biome === 'castle' ? drawGroundCastle(worldTX, worldTY)
                 : biome === 'desert' ? drawGroundDesert(worldTX, worldTY, sceneLevelId)
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
      const putRGB: PutRGB = (x, y, r, g, b) => {
        if (x < 0 || y < 0 || x >= tileSize || y >= tileSize) return;
        const idx = ((oy + y) * pxSize + (ox + x)) * 4;
        buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
      };
      draw(put, putRGB);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  if (biome === 'desert' && sceneLevelId === 6) {
    drawWorldFissures(ctx, chunkX, chunkY, chunkSize, tileSize);
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}
