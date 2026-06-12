// All boss art lives here. Each biome has its own 64×64 boss with shared phase
// types (BossFrame for the standard boss anims, ForestBossFrame for the wendigo).

import { Put, P, mirrorX, strokeOutline, rect, disc, ring, line, ellipse } from './canvas';

// ==================================================================
//  BOSS — The Brood Mother (64x64, 2x2 tile footprint)
// ==================================================================
export interface BossOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number; // 0..4 for birth animation stages, undefined = no pockets
  rearUp?: boolean; // slam windup pose
  legStep?: number; // -1 | 0 | 1
}

export function drawBossBody(put: Put, opts: BossOpts) {
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

export type BossFrame =
  | 'idle0' | 'idle1'
  | 'move0' | 'move1' | 'move2' | 'move3'
  | 'atk0' | 'atk1'
  | 'chargeWind'
  | 'hit'
  | 'birth0' | 'birth1' | 'birth2' | 'birth3' | 'birth4'
  | 'die0' | 'die1' | 'die2' | 'die3' | 'die4';

export function drawBoss(frame: BossFrame) {
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

export function drawBossDie(put: Put, step: number) {
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
//  RIVER BOSS — The Fog Phantom (64x64, flying ghostly mist entity)
// ==================================================================

export interface FogOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;   // birth animation — tendrils extend
  rearUp?: boolean;    // atk windup
  phase?: number;      // movement animation phase 0-3
}

export function drawFogPhantomBody(put: Put, opts: FogOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const baseCy = 30 + bob;

  const col = {
    d:   opts.flash ? P.white : P.fogD,
    m:   opts.flash ? P.white : P.fogM,
    b:   opts.flash ? P.white : P.fog,
    l:   opts.flash ? P.white : P.fogL,
    core:opts.flash ? P.white : P.fogCore,
    glow:opts.flash ? P.white : P.fogGlow,
    glowD:opts.flash? P.white : P.fogGlowD,
    wisp:opts.flash ? P.white : P.fogWisp,
  };
  const phase = opts.phase ?? 0;

  // Shadow (faint, ethereal)
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -14; dx <= 14; dx++)
      if ((dx * dx) / 196 + (dy * dy) / 5 <= 1) put(cx + dx, 58 + dy, P.shadow);

  // Misty tendrils — flowing wisps extending outward
  for (let t = 0; t < 8; t++) {
    const angle = (t / 8) * Math.PI * 2 + phase * 0.4;
    const tendrilLen = opts.pockets != null ? 8 + opts.pockets * 2 : 10;
    for (let i = 0; i < tendrilLen; i++) {
      const r = 14 + i * 1.5;
      const x = cx + Math.cos(angle + i * 0.12) * r;
      const y = baseCy + Math.sin(angle + i * 0.12) * r * 0.5;
      const fade = Math.max(0, 1 - i / tendrilLen);
      if (fade > 0.3) put(Math.round(x), Math.round(y), col.wisp);
    }
  }

  // Dripping ectoplasm tendrils hanging below
  for (let t = 0; t < 5; t++) {
    const tx = cx - 10 + t * 5 + Math.round(Math.sin(phase * 0.5 + t) * 2);
    for (let dy = 0; dy < 8 + (phase + t) % 3; dy++) {
      const fade = 1 - dy / 12;
      if (fade > 0.2) put(tx, baseCy + 12 + dy, col.d);
    }
  }

  // Core body — large ethereal mass
  disc(put, cx, baseCy, 14, col.d);
  disc(put, cx, baseCy, 12, col.m);
  disc(put, cx, baseCy, 10, col.b);
  disc(put, cx, baseCy - 1, 7, col.l);
  disc(put, cx, baseCy - 2, 4, col.core);

  // Charge glow — body pulses with energy
  if (opts.chargeGlow) {
    disc(put, cx, baseCy, 16, col.glowD);
    disc(put, cx, baseCy, 13, col.glow);
    disc(put, cx, baseCy, 10, col.b);
    disc(put, cx, baseCy, 7, col.l);
  }

  // Attack windup — body contracts upward then expands
  if (opts.rearUp) {
    disc(put, cx, baseCy - 3, 10, col.glow);
    disc(put, cx, baseCy - 3, 8, col.l);
  }

  // Face — hollow dark eye sockets
  // Left eye socket
  disc(put, cx - 7, baseCy - 4, 4, P.outline);
  disc(put, cx - 7, baseCy - 4, 3, col.d);
  // Right eye socket
  disc(put, cx + 7, baseCy - 4, 4, P.outline);
  disc(put, cx + 7, baseCy - 4, 3, col.d);

  // Glowing pupils
  disc(put, cx - 7, baseCy - 4, 2, col.glow);
  put(cx - 7, baseCy - 4, P.white);
  disc(put, cx + 7, baseCy - 4, 2, col.glow);
  put(cx + 7, baseCy - 4, P.white);

  // Glow halo around eyes
  put(cx - 10, baseCy - 4, col.glowD);
  put(cx - 4, baseCy - 4, col.glowD);
  put(cx + 4, baseCy - 4, col.glowD);
  put(cx + 10, baseCy - 4, col.glowD);

  // Mouth — wavering dark slit
  const mw = 5 + phase % 2;
  for (let i = -mw; i <= mw; i++)
    put(cx + i, baseCy + 4, P.outline);
  for (let i = -mw + 1; i <= mw - 1; i++)
    put(cx + i, baseCy + 5, col.d);

  // Birth animation — tendrils actively spawning minions
  if (opts.pockets != null) {
    const p = opts.pockets;
    // Tendrils reach out farther at each stage
    for (let t = 0; t < 4; t++) {
      const a = (t / 4) * Math.PI * 2 + 0.5;
      const len = 6 + p * 4;
      for (let i = 0; i < len; i++) {
        const r = 16 + i * 1.5;
        put(Math.round(cx + Math.cos(a) * r), Math.round(baseCy + Math.sin(a) * r * 0.5), col.glow);
      }
    }
    // At final stages, glow at tips
    if (p >= 3) {
      for (let t = 0; t < 4; t++) {
        const a = (t / 4) * Math.PI * 2 + 0.5;
        const r = 16 + (6 + p * 4) * 1.5;
        disc(put, Math.round(cx + Math.cos(a) * r), Math.round(baseCy + Math.sin(a) * r * 0.5), 2, col.glow);
      }
    }
  }
}

export function drawFogPhantomDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  const r = Math.max(0, 14 - step * 3);
  if (r > 0) {
    disc(put, cx, cy, r, P.fogD);
    disc(put, cx, cy, Math.max(0, r - 2), P.fog);
    disc(put, cx, cy, Math.max(0, r - 4), P.fogL);
  }
  // Wisps dispersing outward
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + step * 0.4;
    const d = step * 7 + 5;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.6);
    const fade = Math.max(0, 1 - step / 5);
    if (fade > 0) {
      put(x, y, P.fogM);
      put(x + 1, y, P.fogD);
      if (i % 3 === 0) put(x, y - 1, P.fogGlow);
    }
  }
}

export function drawFogPhantom(frame: BossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawFogPhantomBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawFogPhantomBody(put, { bob: -1, phase: 1 });
      case 'move0':      return drawFogPhantomBody(put, { bob: 0, phase: 0 });
      case 'move1':      return drawFogPhantomBody(put, { bob: -1, phase: 1 });
      case 'move2':      return drawFogPhantomBody(put, { bob: -2, phase: 2 });
      case 'move3':      return drawFogPhantomBody(put, { bob: -1, phase: 3 });
      case 'atk0':       return drawFogPhantomBody(put, { rearUp: true, bob: -3, phase: 0 });
      case 'atk1':       return drawFogPhantomBody(put, { bob: 2, phase: 2 });
      case 'chargeWind': return drawFogPhantomBody(put, { chargeGlow: true, bob: 0, phase: 0 });
      case 'hit':        return drawFogPhantomBody(put, { flash: true, phase: 0 });
      case 'birth0':     return drawFogPhantomBody(put, { pockets: 0, phase: 0 });
      case 'birth1':     return drawFogPhantomBody(put, { pockets: 1, phase: 1 });
      case 'birth2':     return drawFogPhantomBody(put, { pockets: 2, phase: 2 });
      case 'birth3':     return drawFogPhantomBody(put, { pockets: 3, phase: 3 });
      case 'birth4':     return drawFogPhantomBody(put, { pockets: 4, phase: 0 });
      case 'die0':       return drawFogPhantomDie(put, 0);
      case 'die1':       return drawFogPhantomDie(put, 1);
      case 'die2':       return drawFogPhantomDie(put, 2);
      case 'die3':       return drawFogPhantomDie(put, 3);
      case 'die4':       return drawFogPhantomDie(put, 4);
    }
  };
}


// ==================================================================
//  MEADOW BOSS — The Ancient Ram (64x64)
// ==================================================================

export interface RamOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  rearUp?: boolean;
  legStep?: number;
  headDown?: number;  // px the head is lowered (atk windup → slam)
  earFlick?: boolean; // idle fidget — ear swivels up
  tailWag?: number;   // -1 | 0 | 1 vertical tail offset
  breath?: boolean;   // snort puff ahead of the nose
}

export function drawRamBody(rawPut: Put, opts: RamOpts) {
  const bob = opts.bob ?? 0;
  const frontLift = opts.rearUp ? 3 : 0;  // windup: front end rears off the ground
  const headDown = opts.headDown ?? 0;
  const ls = opts.legStep ?? 0;

  // Demonic palette: charcoal hide, near-black fleece, soot horns, ember glow
  const col = {
    out: opts.flash ? P.white : P.outline,
    d:   opts.flash ? P.white : P.dramD,
    m:   opts.flash ? P.white : P.dramM,
    b:   opts.flash ? P.white : P.dram,
    l:   opts.flash ? P.white : P.dramL
  };
  const wc = {
    d: opts.flash ? P.white : P.dmaneD,
    b: opts.flash ? P.white : P.dmane,
    l: opts.flash ? P.white : P.dmaneL
  };
  const hc = {
    d: opts.flash ? P.white : P.dhornD,
    m: opts.flash ? P.white : P.dhornM,
    b: opts.flash ? P.white : P.dhorn,
    l: opts.flash ? P.white : P.dhornL
  };
  const ec = {
    d: opts.flash ? P.white : P.emberD,
    b: opts.flash ? P.white : P.ember,
    l: opts.flash ? P.white : P.emberL
  };
  const fc = (c: string) => opts.flash ? P.white : c;

  // Record body pixels for the silhouette outline (matches the ranger look).
  // Shadow + breath stay on rawPut so they aren't outlined.
  const px = new Set<number>();
  const put: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    px.add(y * 64 + x);
    rawPut(x, y, c);
  };

  // Drop shadow
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -24; dx <= 24; dx++)
      if ((dx * dx) / 576 + (dy * dy) / 5 <= 1) rawPut(32 + dx, 59 + dy, P.shadow);

  // --- proportions: side-profile quadruped facing right ---
  // rump x~10 → chest x~46, barrel centre (26, bodyCy), skull out front at
  // (50, headY) on a wool neck. headDown drives the slam; rearUp the windup.
  const bodyCy = 36 + bob;
  const headY = bodyCy - 12 - frontLift + headDown;

  // Trot gait: diagonal leg pairs swing in opposition, swinging pair lifts.
  const liftA = Math.max(0, ls);   // near-front + far-rear
  const liftB = Math.max(0, -ls);  // far-front + near-rear
  const leg = (x: number, dx: number, lift: number, near: boolean, front: boolean) => {
    const fl = front ? frontLift * 2 : 0;
    const hoofY = 54 - lift - fl;
    const topY = bodyCy + 4 - (front ? frontLift : 0);
    const lx = x + dx;
    rect(put, x, topY, 4, 6, near ? col.b : col.d);                                  // thigh
    rect(put, lx, topY + 6, 3, Math.max(0, hoofY - topY - 6), near ? col.m : col.d); // shin
    if (near) rect(put, lx + 2, topY + 6, 1, Math.max(0, hoofY - topY - 6), col.l);
    // molten crack running down the shin, brightening toward the hoof
    for (let yy = topY + 7; yy < hoofY - 1; yy++)
      put(lx + (yy % 2), yy, yy >= hoofY - 4 ? ec.b : ec.d);
    // fetlock glow band above the dark hoof
    rect(put, lx, hoofY - 1, 3, 1, ec.d);
    put(lx + 1, hoofY - 1, ec.b);
    rect(put, lx, hoofY, 3, 2, col.out);                                             // hoof
    put(lx + 1, hoofY, ec.b);                                                        // burning split
  };

  // far-side legs first — the body overlaps them
  leg(35, -ls, liftB, false, true);
  leg(18, ls, liftA, false, false);

  // --- woolly tail (wags) ---
  const tw = opts.tailWag ?? 0;
  disc(put, 9, bodyCy - 3 + tw, 3, wc.d);
  disc(put, 9, bodyCy - 3 + tw, 2, wc.b);
  put(8, bodyCy - 5 + tw, wc.l);

  // --- fleece barrel + haunch + shoulder masses ---
  ellipse(put, 26, bodyCy, 17, 10, wc.d);
  ellipse(put, 26, bodyCy, 16, 9, wc.b);
  disc(put, 15, bodyCy + 1, 8, wc.d);   // rear haunch
  disc(put, 15, bodyCy + 1, 7, wc.b);
  // hunched shoulder hump — the silhouette looms over the lowered skull
  disc(put, 36, bodyCy - 4 - frontLift, 9, wc.d);
  disc(put, 36, bodyCy - 4 - frontLift, 8, wc.b);
  disc(put, 36, bodyCy - 10 - frontLift, 5, wc.d);
  disc(put, 35, bodyCy - 10 - frontLift, 3, wc.b);

  // lumpy back line with crevices between the lumps
  const lumps: ReadonlyArray<readonly [number, number, number]> =
    [[14, -8, 3], [20, -10, 4], [27, -11, 4], [34, -10, 4]];
  for (const [lx, ly, r] of lumps) {
    disc(put, lx, bodyCy + ly, r, wc.b);
    for (let a = 0.5; a < 2.6; a += 0.4)
      put(lx + Math.round(Math.cos(a) * (r + 1)), bodyCy + ly + Math.round(Math.sin(a) * (r + 1)), wc.d);
  }
  // matted, filth-streaked fleece — dark speckling dominates the highlight
  ellipse(put, 20, bodyCy - 5, 7, 3, wc.l);
  for (let y = -10; y <= 9; y++)
    for (let x = -16; x <= 16; x++) {
      if ((x * x) / 289 + (y * y) / 100 > 1) continue;
      if ((x * 3 + y * 7 + 64) % 17 === 0) put(26 + x, bodyCy + y, wc.l);
      else if ((x * 5 + y * 3 + 64) % 9 === 0) put(26 + x, bodyCy + y, wc.d);
    }
  // soot-black spurs breaking through the fleece, tips smouldering
  for (const [sx, sy] of [[17, -11], [24, -13], [31, -13], [38, -12]] as const) {
    put(sx, bodyCy + sy, hc.d);
    put(sx, bodyCy + sy - 1, hc.b);
    put(sx, bodyCy + sy - 2, ec.d);
  }
  // demonic runes seared into the hide (per the reference art):
  // spiral on the haunch...
  for (let t = 0; t <= 1; t += 0.03) {
    const a = t * 10.5;            // ~1.7 turns
    const r = 0.5 + t * 4;
    put(15 + Math.round(Math.cos(a) * r), bodyCy + 1 + Math.round(Math.sin(a) * r), t < 0.75 ? ec.b : ec.d);
  }
  // ...circle-and-dot on the barrel with a tail streaking down...
  ring(put, 27, bodyCy - 2, 3, ec.d);
  put(27, bodyCy - 2, ec.b);
  put(27, bodyCy + 2, ec.d);
  put(26, bodyCy + 4, ec.d);
  put(26, bodyCy + 5, ec.b);
  // ...and a hooked flick on the shoulder hump
  put(34, bodyCy - 7, ec.d);
  put(35, bodyCy - 8, ec.b);
  put(36, bodyCy - 7, ec.d);
  // shaded belly with long matted clumps dangling off it
  ellipse(put, 26, bodyCy + 7, 13, 3, wc.d);
  for (let x = 14; x <= 39; x += 3) {
    put(x, bodyCy + 10, wc.d);
    put(x + 1, bodyCy + 11, wc.d);
  }

  // chest wool + hanging tuft
  disc(put, 42, bodyCy + 1 - frontLift, 5, wc.b);
  put(43, bodyCy + 6 - frontLift, wc.d);
  put(44, bodyCy + 5 - frontLift, wc.b);

  // near-side legs (over the body)
  leg(40, ls, liftA, true, true);
  leg(12, -ls, liftB, true, false);

  // --- wool neck stepping up to the skull ---
  const neckPts: ReadonlyArray<readonly [number, number]> = [
    [40, bodyCy - 7 - frontLift],
    [44, Math.round((bodyCy - 9 - frontLift + headY + 4) / 2)],
    [47, headY + 4],
  ];
  for (const [nx, ny] of neckPts) {
    disc(put, nx, ny, 4, wc.d);
    disc(put, nx, ny, 3, wc.b);
  }

  // --- far horn: heavy curl behind the head ---
  for (let t = 0; t <= 0.7; t += 0.02) {
    const a = (-90 - 310 * t) * (Math.PI / 180);
    const r = 8 - 4.8 * t;
    disc(put, Math.round(42 + Math.cos(a) * r), Math.round(headY + Math.sin(a) * r), 1, t < 0.4 ? hc.m : hc.d);
  }
  // faint sigils on the far curl
  put(38, headY - 6, ec.d);
  put(36, headY + 2, ec.d);

  // --- ear (torn and notched; swivels up on the idle flick) ---
  if (opts.earFlick) {
    rect(put, 43, headY - 7, 2, 3, col.d);
    put(43, headY - 6, fc('#4a2018'));
  } else {
    rect(put, 43, headY - 4, 3, 2, col.d);
    put(44, headY - 4, fc('#4a2018'));
    put(44, headY - 5, col.d);            // ragged tip
  }

  // --- head: gaunt skull, jutting brow, roman-nose profile ---
  disc(put, 50, headY, 5, col.d);
  disc(put, 50, headY, 4, col.b);
  put(49, headY + 2, col.m);              // sunken cheek
  put(50, headY + 2, col.m);
  rect(put, 46, headY - 6, 8, 2, col.d);  // bony forehead plate
  rect(put, 49, headY - 4, 5, 1, col.d);  // brow juts out, casting the eye in shadow
  put(53, headY - 3, col.d);
  put(48, headY - 3, col.m);
  // demonic mark seared down the brow (reference: red streak above the eye)
  put(50, headY - 5, ec.d);
  put(51, headY - 6, ec.b);
  put(52, headY - 5, ec.d);
  put(53, headY - 2, ec.d);
  put(54, headY - 1, ec.b);
  put(55, headY, ec.d);
  // muzzle slopes down and forward, snout wrinkled mid-snarl
  rect(put, 53, headY + 1, 4, 4, col.b);
  rect(put, 55, headY + 3, 3, 4, col.m);
  rect(put, 56, headY + 5, 3, 3, col.b);
  put(55, headY + 4, col.d);              // snarl wrinkle
  put(56, headY + 3, col.d);
  put(58, headY + 6, col.out);            // flared nostril
  put(57, headY + 5, ec.d);               // nostril rim glowing
  // snarling jaw — lips pulled back over bared teeth
  rect(put, 55, headY + 8, 4, 1, P.white);  // teeth
  rect(put, 55, headY + 9, 4, 1, col.out);  // open jaw shadow
  put(54, headY + 8, col.d);                // lip curl
  put(54, headY + 7, col.m);
  // eye — burning ember with a white-hot core, sunk deep under the brow
  put(51, headY - 1, ec.b);
  put(52, headY - 1, ec.l);               // hot core
  put(51, headY, ec.d);
  put(52, headY, col.out);                // pupil
  put(50, headY - 1, ec.d);               // ember bleed at the socket
  put(53, headY - 1, ec.d);
  if (opts.chargeGlow) {                  // eye flares while winding up
    put(50, headY, P.ember);
    put(53, headY, P.ember);
    rawPut(49, headY - 1, P.emberL);      // heat shimmer off the socket
  }

  // --- the signature horn: massive, battle-worn curling spiral ---
  // top of skull → back over the ear → down the jaw → tip snapped off mid-curl
  const hornCx = 46, hornCy = headY + 1;
  const hornPt = (t: number, rOff = 0) => {
    const a = (-90 - 310 * t) * (Math.PI / 180);
    const r = 10 - 6.6 * t + rOff;
    return [Math.round(hornCx + Math.cos(a) * r), Math.round(hornCy + Math.sin(a) * r)] as const;
  };
  for (let t = 0; t <= 0.93; t += 0.015) {
    const [hx, hy] = hornPt(t);
    disc(put, hx, hy, t < 0.5 ? 2 : 1, t < 0.45 ? hc.b : t < 0.8 ? hc.m : hc.d);
  }
  // growth-ring ridges along the outer edge
  for (let t = 0.04; t < 0.85; t += 0.08) {
    const [hx, hy] = hornPt(t, 1.6);
    put(hx, hy, hc.d);
  }
  // ember sigils branded into each horn segment (reference: red marks
  // running the length of the curl)
  let sig = 0;
  for (let t = 0.06; t < 0.88; t += 0.09, sig++) {
    const [hx, hy] = hornPt(t, 0.4);
    put(hx, hy, sig % 2 === 0 ? ec.b : ec.d);
  }
  // deep cracks gouged across the curl
  for (const t of [0.18, 0.42, 0.63]) {
    const [hx, hy] = hornPt(t);
    put(hx, hy, col.out);
    const [ox, oy] = hornPt(t, 1.4);
    put(ox, oy, col.out);
  }
  // jagged snapped-off tip with a molten core
  {
    const [bx, by] = hornPt(0.93);
    put(bx, by, hc.d);
    put(bx + 1, by - 1, col.out);
    put(bx, by - 1, ec.b);          // molten marrow
    put(bx + 1, by, hc.m);
  }
  // dull edge light — worn, not polished
  for (let t = 0; t < 0.25; t += 0.05) {
    const [hx, hy] = hornPt(t, -1.2);
    put(hx, hy, hc.l);
  }
  if (opts.chargeGlow) { // horn crackles with heat
    for (const t of [0, 0.3, 0.55, 0.8]) {
      const [hx, hy] = hornPt(t, 2);
      rawPut(hx, hy, P.emberL);
    }
    rawPut(hornCx, hornCy - 13, P.ember);
  }

  // --- birth pockets along the back ---
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [
      [16, bodyCy - 10], [25, bodyCy - 12], [34, bodyCy - 11]
    ];
    for (const [ox, oy] of pockets) {
      if (stage === 0) {
        disc(put, ox, oy, 3, wc.l);
        disc(put, ox, oy, 2, wc.b);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, wc.d);
        disc(put, ox, oy, 2, col.out);
        put(ox, oy, P.emberD);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, wc.d);
        disc(put, ox, oy, 2, P.ember);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
        put(ox, oy + 1, col.out);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, wc.d);
        disc(put, ox, oy - 1, 3, P.ember);
        disc(put, ox, oy - 2, 2, P.emberL);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
        put(ox, oy, col.out);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, col.out);
        disc(put, ox, oy, 2, wc.d);
      }
    }
  }

  // --- snort puff (unrecorded — sooty smoke with embers in it) ---
  if (opts.breath) {
    rawPut(60, headY + 5, P.stoneM);
    rawPut(61, headY + 6, P.emberL);
    rawPut(60, headY + 7, P.stoneM);
    rawPut(62, headY + 4, P.stoneM);
    rawPut(59, headY + 6, P.stoneM);
    rawPut(62, headY + 6, P.ember);   // ember carried on the breath
  }

  // Crisp 1px silhouette outline (matches the ranger + meadow enemies)
  strokeOutline(px, rawPut, 64);
}

/** Ram frame set — the shared BossFrame plus extra idle/move/atk in-betweens
 *  for smoother animation (the ram is the tutorial-adjacent boss the player
 *  stares at the longest). */
export type RamFrame = BossFrame | 'idle2' | 'idle3' | 'move4' | 'move5' | 'atk2' | 'atk3';

export function drawRam(frame: RamFrame) {
  return (put: Put) => {
    switch (frame) {
      // breathing bob with an ear flick + tail wag mid-cycle
      case 'idle0':      return drawRamBody(put, { bob: 0 });
      case 'idle1':      return drawRamBody(put, { bob: 1, tailWag: 1 });
      case 'idle2':      return drawRamBody(put, { bob: 1, earFlick: true, tailWag: 1 });
      case 'idle3':      return drawRamBody(put, { bob: 0 });
      // 6-step trot: legs swing through ±2 with the body dipping on contact
      case 'move0':      return drawRamBody(put, { bob: 1, legStep: 2 });
      case 'move1':      return drawRamBody(put, { bob: 0, legStep: 1, tailWag: 1 });
      case 'move2':      return drawRamBody(put, { bob: 0, legStep: -1, tailWag: 1 });
      case 'move3':      return drawRamBody(put, { bob: 1, legStep: -2 });
      case 'move4':      return drawRamBody(put, { bob: 0, legStep: -1, tailWag: -1 });
      case 'move5':      return drawRamBody(put, { bob: 0, legStep: 1, tailWag: -1 });
      // 4-step slam: rear up → drop → full headbutt (with snort) → recover
      case 'atk0':       return drawRamBody(put, { rearUp: true, headDown: 0, bob: -1 });
      case 'atk1':       return drawRamBody(put, { headDown: 2, bob: 1 });
      case 'atk2':       return drawRamBody(put, { headDown: 5, bob: 2, breath: true });
      case 'atk3':       return drawRamBody(put, { headDown: 2, bob: 1 });
      case 'chargeWind': return drawRamBody(put, { chargeGlow: true, headDown: 3, bob: 0, breath: true });
      case 'hit':        return drawRamBody(put, { flash: true });
      case 'birth0':     return drawRamBody(put, { pockets: 0 });
      case 'birth1':     return drawRamBody(put, { pockets: 1 });
      case 'birth2':     return drawRamBody(put, { pockets: 2 });
      case 'birth3':     return drawRamBody(put, { pockets: 3 });
      case 'birth4':     return drawRamBody(put, { pockets: 4 });
      case 'die0':       return drawRamDie(put, 0);
      case 'die1':       return drawRamDie(put, 1);
      case 'die2':       return drawRamDie(put, 2);
      case 'die3':       return drawRamDie(put, 3);
      case 'die4':       return drawRamDie(put, 4);
    }
  };
}

export function drawRamDie(put: Put, step: number) {
  const cx = 32, cy = 36;
  const r = Math.max(0, 24 - step * 5);
  if (r > 0) {
    disc(put, cx, cy, r, P.dmaneD);
    disc(put, cx, cy, Math.max(0, r - 1), P.dmane);
    disc(put, cx, cy, Math.max(0, r - 3), P.ember); // burning core
  }
  // Horn shards + sooty fleece chunks flying out, trailing embers
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 6 + 6;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, P.dmaneD);
    put(x + 1, y, i % 3 === 0 ? P.dhorn : P.dramD);
    if (i % 4 === 0) put(x, y + 1, P.emberD);
  }
  // Central flash
  if (step < 2) disc(put, cx, cy, 6, P.emberL);
}

// ==================================================================
//  INFECTED BOSS — The Blighted One (purple/orange/yellow)
// ==================================================================
export function drawInfectedBossBody(put: Put, opts: BossOpts) {
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

export function drawInfectedBossDie(put: Put, step: number) {
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

export function drawInfectedBoss(frame: BossFrame) {
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
//  FOREST BOSS — The Wendigo (Corrupted Stag Spirit)
// ==================================================================
export interface WendigoOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  phase?: number;      // 0-3 for mist animation
  armSway?: number;    // -1 to 1
}

export function drawWendigoBody(put: Put, opts: WendigoOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const cy = 30 + bob;
  const phase = opts.phase ?? 0;
  const armSway = opts.armSway ?? 0;
  const flash = opts.flash ?? false;
  const chargeGlow = opts.chargeGlow ?? false;

  const bone  = flash ? P.white : P.wBone;
  const boneD = flash ? P.white : P.wBoneD;
  const boneL = flash ? P.white : P.wBoneL;
  const ghost = flash ? P.white : P.wGhost;
  const ghostD= flash ? P.white : P.wGhostD;
  const ghostL= flash ? P.white : P.wGhostL;
  const ghostB= flash ? P.white : P.wGhostB;
  const out   = flash ? P.white : P.outline;

  // Ghostly ground glow instead of shadow
  for (let dx = -16; dx <= 16; dx++)
    for (let dy = -1; dy <= 1; dy++)
      if ((dx * dx) / 256 + (dy * dy) / 2 <= 1) put(cx + dx, 58 + dy, P.wGhostD);

  // Spectral mist body — wispy lower body (no legs, it floats)
  for (let y = 8; y <= 26; y++) {
    const spread = Math.floor(14 - (y - 8) * 0.4);
    const sway = Math.round(Math.sin((y * 0.3) + phase * 1.2) * 2);
    for (let x = -spread; x <= spread; x++) {
      const dist = Math.abs(x) / (spread || 1);
      // Dithered mist: skip some edge pixels based on position + phase
      if (dist > 0.8 && ((x + y + phase) % 3 === 0)) continue;
      put(cx + x + sway, cy + y, dist > 0.7 ? ghostD : dist > 0.4 ? ghost : ghostL);
    }
  }

  // Wisp tendrils trailing down
  for (let t = 0; t < 5; t++) {
    const tx = cx - 8 + t * 4;
    const sway = Math.round(Math.sin((t + phase) * 1.5) * 2);
    for (let j = 0; j < 4 + (t % 2) * 2; j++)
      put(tx + sway, cy + 26 + j, ghostD);
  }

  // Torso — spine visible through mist
  for (let y = -4; y <= 8; y++)
    put(cx, cy + y, bone);

  // Ribs
  for (let r = 0; r < 4; r++) {
    const ry = cy - 2 + r * 3;
    for (let x = 1; x <= 6 - r; x++) {
      put(cx - x, ry, boneD);
      put(cx + x, ry, boneD);
    }
    put(cx - (6 - r), ry + 1, boneD);
    put(cx + (6 - r), ry + 1, boneD);
  }

  // Shoulder bones
  rect(put, cx - 10, cy - 4, 4, 3, boneD);
  rect(put, cx + 6, cy - 4, 4, 3, boneD);

  // Arms — skeletal, dangling
  const aOff = Math.floor(armSway * 2);
  // Left arm bones
  rect(put, cx - 12, cy - 2 + aOff, 2, 8, boneD);
  put(cx - 13, cy + 6 + aOff, bone);
  put(cx - 12, cy + 7 + aOff, boneD);
  put(cx - 11, cy + 7 + aOff, boneD);
  // Right arm
  rect(put, cx + 10, cy - 2 - aOff, 2, 8, boneD);
  put(cx + 11, cy + 6 - aOff, bone);
  put(cx + 10, cy + 7 - aOff, boneD);
  put(cx + 12, cy + 7 - aOff, boneD);

  // Skull — deer skull
  disc(put, cx, cy - 10, 8, out);
  disc(put, cx, cy - 10, 7, boneD);
  disc(put, cx, cy - 10, 6, bone);
  disc(put, cx, cy - 11, 4, boneL);
  // Snout — elongated
  rect(put, cx - 3, cy - 8, 6, 6, bone);
  rect(put, cx - 2, cy - 6, 4, 5, boneL);
  // Eye sockets — glowing green fire
  const eyeCol = chargeGlow ? P.sparkL : P.entEye;
  const eyeHL = chargeGlow ? P.white : '#a0ffa0';
  const eyeDk = chargeGlow ? P.spark : P.entEyeD;
  disc(put, cx - 3, cy - 12, 2, out);
  put(cx - 3, cy - 12, eyeCol); put(cx - 2, cy - 12, eyeHL);
  put(cx - 3, cy - 13, eyeDk);
  disc(put, cx + 3, cy - 12, 2, out);
  put(cx + 3, cy - 12, eyeCol); put(cx + 4, cy - 12, eyeHL);
  put(cx + 3, cy - 13, eyeDk);
  // Nose holes
  put(cx - 1, cy - 6, out); put(cx + 1, cy - 6, out);
  // Teeth
  for (let x = -2; x <= 2; x++) {
    put(cx + x, cy - 3, bone);
    if (x % 2 === 0) put(cx + x, cy - 2, boneD);
  }
  // Jaw line
  rect(put, cx - 3, cy - 3, 6, 1, boneD);

  // ANTLERS — massive bone antlers
  const al = cy - 18;
  // Left antler
  rect(put, cx - 4, al, 2, 6, bone);
  rect(put, cx - 6, al - 6, 2, 6, bone);
  rect(put, cx - 8, al - 10, 2, 4, boneL);
  put(cx - 9, al - 12, boneL);
  rect(put, cx - 2, al - 2, 2, 3, bone);
  put(cx - 1, al - 4, boneD);
  rect(put, cx - 8, al - 4, 2, 3, bone);
  put(cx - 10, al - 4, boneD);
  // Right antler
  rect(put, cx + 2, al, 2, 6, bone);
  rect(put, cx + 4, al - 6, 2, 6, bone);
  rect(put, cx + 6, al - 10, 2, 4, boneL);
  put(cx + 7, al - 12, boneL);
  rect(put, cx, al - 2, 2, 3, bone);
  put(cx - 1, al - 4, boneD);
  rect(put, cx + 6, al - 4, 2, 3, bone);
  put(cx + 8, al - 4, boneD);

  // Spectral glow around antlers
  if (!flash) {
    for (let a = 0; a < 12; a++) {
      const angle = (a / 12) * Math.PI * 2 + phase * 0.5;
      const r = 10 + Math.sin(a * 2) * 3;
      const gx = Math.round(cx + Math.cos(angle) * r);
      const gy = Math.round(cy - 22 + Math.sin(angle) * r);
      put(gx, gy, ghostB);
    }
  }

  // Birth pockets — spectral bulges on torso
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [
      [-4, -6], [0, -8], [4, -6]
    ];
    for (const [px, py] of pockets) {
      const ox = cx + px, oy = cy + py;
      if (stage === 0) {
        disc(put, ox, oy, 3, ghostL);
        disc(put, ox, oy, 2, ghost);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, ghostL);
        disc(put, ox, oy, 2, out);
        put(ox, oy, P.entEye);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, ghostL);
        disc(put, ox, oy, 2, P.wolfM);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, ghostD);
        disc(put, ox, oy - 1, 3, P.wolfM);
        disc(put, ox, oy - 2, 2, P.wolf);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, out);
        disc(put, ox, oy, 2, ghostD);
      }
    }
  }
}

export type ForestBossFrame =
  | 'idle0' | 'idle1'
  | 'move0' | 'move1' | 'move2' | 'move3'
  | 'atk0' | 'atk1'
  | 'chargeWind'
  | 'hit'
  | 'birth0' | 'birth1' | 'birth2' | 'birth3' | 'birth4'
  | 'die0' | 'die1' | 'die2' | 'die3' | 'die4';

export const forestBossFrames: ForestBossFrame[] = [
  'idle0','idle1',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind','hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

export function drawForestBoss(frame: ForestBossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawWendigoBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawWendigoBody(put, { bob: -2, phase: 1 });
      case 'move0':      return drawWendigoBody(put, { bob: 0, phase: 0, armSway: 0.5 });
      case 'move1':      return drawWendigoBody(put, { bob: -2, phase: 1, armSway: 0 });
      case 'move2':      return drawWendigoBody(put, { bob: 0, phase: 2, armSway: -0.5 });
      case 'move3':      return drawWendigoBody(put, { bob: -2, phase: 3, armSway: 0 });
      case 'atk0':       return drawWendigoBody(put, { bob: -2, armSway: 1, phase: 0 });
      case 'atk1':       return drawWendigoBody(put, { bob: 2, armSway: -1, phase: 1 });
      case 'chargeWind': return drawWendigoBody(put, { chargeGlow: true, bob: 0, phase: 0 });
      case 'hit':        return drawWendigoBody(put, { flash: true });
      case 'birth0':     return drawWendigoBody(put, { pockets: 0, phase: 0 });
      case 'birth1':     return drawWendigoBody(put, { pockets: 1, phase: 1 });
      case 'birth2':     return drawWendigoBody(put, { pockets: 2, phase: 2 });
      case 'birth3':     return drawWendigoBody(put, { pockets: 3, phase: 3 });
      case 'birth4':     return drawWendigoBody(put, { pockets: 4, phase: 0 });
      case 'die0':       return drawWendigoDie(put, 0);
      case 'die1':       return drawWendigoDie(put, 1);
      case 'die2':       return drawWendigoDie(put, 2);
      case 'die3':       return drawWendigoDie(put, 3);
      case 'die4':       return drawWendigoDie(put, 4);
    }
  };
}

export function drawWendigoDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  const r = Math.max(0, 20 - step * 4);
  if (r > 0) {
    disc(put, cx, cy, r, P.wGhostD);
    disc(put, cx, cy, Math.max(0, r - 1), P.wGhost);
    disc(put, cx, cy, Math.max(0, r - 3), P.wBone);
  }
  // Bone shards + wisps flying out
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + step * 0.35;
    const d = step * 7 + 5;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, i % 3 === 0 ? P.wBoneD : i % 3 === 1 ? P.wBone : P.wGhostL);
    put(x + 1, y, i % 2 === 0 ? P.wBoneL : P.wGhostD);
    if (i % 4 === 0) put(x, y + 1, P.entEye);
  }
  // Green spectral flash
  if (step < 2) disc(put, cx, cy, 5, P.entEye);
}

function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}


// ==================================================================
//  CASTLE BOSS 1 — Phantom Queen (ghostly queen wraith, 64x64)
// ==================================================================
export interface PhantomQueenOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  rearUp?: boolean;
  orbPhase?: number;
  mouthOpen?: boolean;
}

export function drawPhantomQueenBody(put: Put, opts: PhantomQueenOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const baseCy = 30 + bob;
  const phase = opts.orbPhase ?? 0;

  const col = {
    out:  opts.flash ? P.white : P.outline,
    d:    opts.flash ? P.white : '#3a5a7a',
    m:    opts.flash ? P.white : '#4a6a8a',
    b:    opts.flash ? P.white : '#6a8aaa',
    l:    opts.flash ? P.white : '#8abadd',
    glow: opts.flash ? P.white : '#aad0ff',
    hair: opts.flash ? P.white : '#5a7a9a',
    hairL:opts.flash ? P.white : '#8aaac8',
    crown:opts.flash ? P.white : '#8abadd',
    crownL:opts.flash? P.white : '#aad0ff',
    jewel:opts.flash ? P.white : '#4060ff',
    eye:  opts.flash ? P.white : '#ffffff',
    wisp: opts.flash ? P.white : '#6a8aaa',
  };

  // Ground shadow
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -12; dx <= 12; dx++)
      if ((dx * dx) / 144 + (dy * dy) / 5 <= 1) put(cx + dx, 60 + dy, P.shadow);

  // Flowing dress — tapers to wisps at bottom
  // Upper dress (torso region)
  for (let y = baseCy + 2; y < baseCy + 24; y++) {
    const t = (y - (baseCy + 2)) / 22;
    const hw = Math.round(6 + t * 10);
    for (let dx = -hw; dx <= hw; dx++) {
      const edge = Math.abs(dx) / hw;
      // Wispy bottom: skip some pixels for taper effect
      if (t > 0.7 && ((dx + y) % 3 === 0 || Math.abs(dx) > hw - 2)) continue;
      if (t > 0.85 && (dx + y) % 2 === 0) continue;
      let c: string;
      if (edge < 0.3) c = col.l;
      else if (edge < 0.6) c = col.b;
      else if (edge < 0.85) c = col.m;
      else c = col.d;
      put(cx + dx, y, c);
    }
  }
  // Wispy tendrils at dress bottom
  for (let t = 0; t < 5; t++) {
    const tx = cx - 8 + t * 4 + Math.round(Math.sin(phase * 0.5 + t) * 2);
    for (let dy = 0; dy < 6 + (phase + t) % 3; dy++) {
      if ((dy + t) % 2 === 0) put(tx, baseCy + 24 + dy, col.d);
    }
  }

  // Upper body / torso
  ellipse(put, cx, baseCy, 8, 6, col.d);
  ellipse(put, cx, baseCy, 7, 5, col.m);
  ellipse(put, cx, baseCy - 1, 5, 4, col.b);

  // Neck
  rect(put, cx - 1, baseCy - 7, 3, 3, col.b);

  // Head
  disc(put, cx, baseCy - 12, 7, col.d);
  disc(put, cx, baseCy - 12, 6, col.m);
  disc(put, cx, baseCy - 12, 5, col.b);
  disc(put, cx, baseCy - 13, 3, col.l);

  // Flowing hair — long strands down the sides
  for (let side = -1; side <= 1; side += 2) {
    for (let y = baseCy - 16; y < baseCy + 8; y++) {
      const sway = Math.round(Math.sin((y + phase) * 0.3) * 1.5);
      const baseX = cx + side * 7 + sway;
      put(baseX, y, col.hair);
      put(baseX + side, y, col.hairL);
      if (y < baseCy - 8) put(baseX - side, y, col.hair);
    }
  }

  // Crown
  const crownY = baseCy - 19;
  for (let dx = -5; dx <= 5; dx++) put(cx + dx, crownY + 2, col.crown);
  for (let dx = -4; dx <= 4; dx++) put(cx + dx, crownY + 1, col.crownL);
  // Crown points
  put(cx - 4, crownY, col.crown); put(cx - 3, crownY - 1, col.crownL);
  put(cx, crownY, col.crown); put(cx, crownY - 1, col.crownL);
  put(cx + 4, crownY, col.crown); put(cx + 3, crownY - 1, col.crownL);
  // Jewels
  put(cx - 2, crownY + 1, col.jewel);
  put(cx + 2, crownY + 1, col.jewel);
  put(cx, crownY + 2, col.jewel);

  // Eyes — hollow glowing white
  put(cx - 3, baseCy - 13, col.out);
  put(cx - 2, baseCy - 13, col.eye);
  put(cx - 1, baseCy - 13, col.out);
  put(cx + 1, baseCy - 13, col.out);
  put(cx + 2, baseCy - 13, col.eye);
  put(cx + 3, baseCy - 13, col.out);
  // Eye glow
  put(cx - 2, baseCy - 14, col.glow);
  put(cx + 2, baseCy - 14, col.glow);

  // Mouth — wailing
  const mw = opts.mouthOpen ? 4 : 2;
  const mh = opts.mouthOpen ? 3 : 1;
  for (let dx = -mw; dx <= mw; dx++)
    for (let dy = 0; dy < mh; dy++)
      put(cx + dx, baseCy - 9 + dy, col.out);
  if (opts.mouthOpen) {
    for (let dx = -mw + 1; dx <= mw - 1; dx++)
      put(cx + dx, baseCy - 8, col.d);
  }

  // Arms (raised in attack, down normally)
  if (opts.rearUp || opts.mouthOpen) {
    // Arms raised
    for (let dy = -6; dy <= 0; dy++) {
      put(cx - 9 - dy, baseCy + dy, col.b);
      put(cx + 9 + dy, baseCy + dy, col.b);
    }
  } else {
    // Arms at sides
    for (let dy = -2; dy <= 6; dy++) {
      put(cx - 8, baseCy + dy, col.b);
      put(cx + 8, baseCy + dy, col.b);
    }
  }

  // Orbiting ghost orbs (3 orbs at different positions based on phase)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + phase * 0.8;
    const orbR = opts.rearUp ? 8 : 16;
    const orbX = Math.round(cx + Math.cos(angle) * orbR);
    const orbY = Math.round(baseCy - 4 + Math.sin(angle) * orbR * 0.5);
    disc(put, orbX, orbY, 2, col.glow);
    put(orbX, orbY, col.eye);
  }

  // Charge glow — body pulses bright
  if (opts.chargeGlow) {
    disc(put, cx, baseCy, 16, col.glow);
    disc(put, cx, baseCy, 12, col.l);
    disc(put, cx, baseCy - 12, 8, col.glow);
  }

  // Birth animation — summoning spirits
  if (opts.pockets != null) {
    const p = opts.pockets;
    for (let t = 0; t < 4; t++) {
      const a = (t / 4) * Math.PI * 2 + 0.3;
      const len = 5 + p * 3;
      for (let i = 0; i < len; i++) {
        const r = 14 + i * 1.5;
        const px = Math.round(cx + Math.cos(a) * r);
        const py = Math.round(baseCy + Math.sin(a) * r * 0.5);
        if (i % 2 === 0) put(px, py, col.glow);
        else put(px, py, col.wisp);
      }
    }
    if (p >= 3) {
      for (let t = 0; t < 4; t++) {
        const a = (t / 4) * Math.PI * 2 + 0.3;
        const r = 14 + (5 + p * 3) * 1.5;
        disc(put, Math.round(cx + Math.cos(a) * r), Math.round(baseCy + Math.sin(a) * r * 0.5), 2, col.glow);
      }
    }
  }
}

export function drawPhantomQueenDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  // Dissolve from bottom up
  const cutoff = 60 - step * 10;
  const r = Math.max(0, 12 - step * 2);
  if (r > 0) {
    // Draw remaining body above cutoff
    for (let dy = -r; dy <= r; dy++) {
      if (cy + dy > cutoff) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        put(cx + dx, cy + dy, dist < 0.5 ? '#8abadd' : '#4a6a8a');
      }
    }
  }
  // Dispersing wisps
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.5;
    const d = step * 6 + 4;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.6);
    put(x, y, '#6a8aaa');
    put(x + 1, y, '#aad0ff');
    if (i % 3 === 0) put(x, y - 1, '#ffffff');
  }
  if (step < 2) disc(put, cx, cy, 4, '#aad0ff');
}

export function drawPhantomQueen(frame: BossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawPhantomQueenBody(put, { bob: 0, orbPhase: 0 });
      case 'idle1':      return drawPhantomQueenBody(put, { bob: -1, orbPhase: 1 });
      case 'move0':      return drawPhantomQueenBody(put, { bob: 0, orbPhase: 0 });
      case 'move1':      return drawPhantomQueenBody(put, { bob: -1, orbPhase: 1 });
      case 'move2':      return drawPhantomQueenBody(put, { bob: -2, orbPhase: 2 });
      case 'move3':      return drawPhantomQueenBody(put, { bob: -1, orbPhase: 3 });
      case 'atk0':       return drawPhantomQueenBody(put, { rearUp: true, mouthOpen: true, bob: -2, orbPhase: 0 });
      case 'atk1':       return drawPhantomQueenBody(put, { bob: 1, mouthOpen: true, orbPhase: 2 });
      case 'chargeWind': return drawPhantomQueenBody(put, { chargeGlow: true, bob: 0, orbPhase: 0 });
      case 'hit':        return drawPhantomQueenBody(put, { flash: true, orbPhase: 0 });
      case 'birth0':     return drawPhantomQueenBody(put, { pockets: 0, orbPhase: 0 });
      case 'birth1':     return drawPhantomQueenBody(put, { pockets: 1, orbPhase: 1 });
      case 'birth2':     return drawPhantomQueenBody(put, { pockets: 2, orbPhase: 2 });
      case 'birth3':     return drawPhantomQueenBody(put, { pockets: 3, orbPhase: 3 });
      case 'birth4':     return drawPhantomQueenBody(put, { pockets: 4, orbPhase: 0 });
      case 'die0':       return drawPhantomQueenDie(put, 0);
      case 'die1':       return drawPhantomQueenDie(put, 1);
      case 'die2':       return drawPhantomQueenDie(put, 2);
      case 'die3':       return drawPhantomQueenDie(put, 3);
      case 'die4':       return drawPhantomQueenDie(put, 4);
    }
  };
}

// ==================================================================
//  CASTLE BOSS 2 — Castle Dragon (massive red dragon, 64x64)
// ==================================================================
export interface CastleDragonOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  rearUp?: boolean;
  legStep?: number;
  mouthOpen?: boolean;
  wingsSpread?: boolean;
}

export function drawCastleDragonBody(put: Put, opts: CastleDragonOpts) {
  const bob = opts.bob ?? 0;
  const by = bob;           // vertical bob offset

  const col = {
    out:    opts.flash ? P.white : P.outline,
    d:      opts.flash ? P.white : '#6a1818',
    m:      opts.flash ? P.white : '#8a2020',
    b:      opts.flash ? P.white : '#a03030',
    l:      opts.flash ? P.white : '#b04040',
    belly:  opts.flash ? P.white : '#b06030',
    bellyL: opts.flash ? P.white : '#c07040',
    bellyM: opts.flash ? P.white : '#d08050',
    horn:   opts.flash ? P.white : '#5a3a18',
    hornD:  opts.flash ? P.white : '#4a2a10',
    hornL:  opts.flash ? P.white : '#6a4a20',
    eye:    opts.flash ? P.white : '#ffa020',
    eyeL:   opts.flash ? P.white : '#ffd040',
    fire:   opts.flash ? P.white : '#ff6020',
    fireL:  opts.flash ? P.white : '#ffa040',
    fireW:  opts.flash ? P.white : '#ffd060',
    fireH:  opts.flash ? P.white : '#ffe880',
    fireD:  opts.flash ? P.white : '#ff2000',
    wingD:  opts.flash ? P.white : '#4a1010',
    wing:   opts.flash ? P.white : '#6a2020',
    wingL:  opts.flash ? P.white : '#8a3030',
    scale:  opts.flash ? P.white : '#905020',
    tooth:  opts.flash ? P.white : '#e8e0d0',
    toothD: opts.flash ? P.white : '#d8d0c0',
    claw:   opts.flash ? P.white : '#4a2a10',
    smoke:  opts.flash ? P.white : '#4a4a4a',
    browD:  opts.flash ? P.white : '#8a1818',
    nostril:opts.flash ? P.white : '#6a2020',
  };

  // Ground shadow
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -16; dx <= 16; dx++)
      if ((dx * dx) / 256 + (dy * dy) / 4 <= 1) put(32 + dx, 59 + dy, P.shadow);

  // === Tail (curving left, wavy) ===
  for (let i = 0; i < 22; i++) {
    const tx = 18 - i;
    const ty = 38 + by + Math.round(Math.sin(i * 0.4) * 4);
    const tr = Math.max(1, 3 - Math.floor(i / 6));
    disc(put, tx, ty, tr, col.m);
    if (tr > 1) disc(put, tx, ty, tr - 1, col.b);
  }
  // Tail spikes
  put(0, 36 + by, col.hornD); put(1, 35 + by, col.horn);
  put(0, 38 + by, col.hornD); put(1, 39 + by, col.horn);

  // === Left wing (behind body) ===
  const wingSpread = opts.wingsSpread ? 4 : 0;
  for (let i = 0; i < 22; i++) {
    const wy = 14 + Math.floor(i * 0.4) - wingSpread + Math.floor(i * wingSpread / 22);
    const wh = 6 + Math.floor(i * 0.3);
    rect(put, 4 + i, wy + by, 2, wh, col.wing);
    if (i % 3 === 0) put(4 + i, wy + by, col.wingL); // membrane veins
  }
  // Wing bone
  line(put, 14, 20 + by - Math.floor(wingSpread / 2), 4, 14 + by - wingSpread, col.wingD);

  // === Right wing (behind body) ===
  for (let i = 0; i < 18; i++) {
    const wy = 14 + Math.floor(i * 0.4) - wingSpread + Math.floor(i * wingSpread / 18);
    const wh = 5 + Math.floor(i * 0.2);
    rect(put, 38 + i, wy + by, 2, wh, col.wing);
    if (i % 3 === 0) put(38 + i, wy + by, col.wingL);
  }
  line(put, 38, 20 + by - Math.floor(wingSpread / 2), 54, 14 + by - wingSpread, col.wingD);

  // === Legs ===
  const ls = opts.legStep ?? 0;
  rect(put, 24, 44 + by + (ls > 0 ? -1 : 0), 6, 12, col.m);
  rect(put, 36, 44 + by + (ls < 0 ? -1 : 0), 6, 12, col.m);
  // Claws
  for (let i = 0; i < 3; i++) {
    put(24 + i * 2, 55 + by + (ls > 0 ? -1 : 0), col.claw);
    put(36 + i * 2, 55 + by + (ls < 0 ? -1 : 0), col.claw);
  }

  // === Body (large round) ===
  disc(put, 32, 34 + by, 14, col.m);
  disc(put, 32, 33 + by, 12, col.b);
  // Belly scales (lighter center)
  disc(put, 32, 36 + by, 8, col.belly);
  disc(put, 32, 36 + by, 6, col.bellyL);
  disc(put, 32, 36 + by, 4, col.bellyM);
  // Scale detail
  for (let y = 30; y < 42; y += 3)
    for (let x = 26; x < 38; x += 4)
      put(x, y + by, col.scale);

  // === Neck (thick, angled right) ===
  rect(put, 34, 18 + by, 10, 14, col.b);
  rect(put, 35, 19 + by, 8, 12, col.l);
  // Neck scales
  for (let y = 20; y < 30; y += 2) put(36, y + by, col.m);

  // === Head (detailed, facing right) ===
  rect(put, 36, 12 + by, 18, 12, col.b);
  rect(put, 38, 13 + by, 16, 10, col.l);
  // Snout
  rect(put, 50, 15 + by, 8, 6, col.l);
  rect(put, 52, 16 + by, 6, 4, '#c05050');
  // Nostrils
  put(57, 17 + by, col.nostril); put(57, 19 + by, col.nostril);
  // Jaw
  rect(put, 40, 22 + by, 16, 3, col.m);
  rect(put, 42, 22 + by, 12, 2, col.b);
  // Teeth
  for (let x = 42; x < 54; x += 3) {
    put(x, 22 + by, col.tooth); put(x, 23 + by, col.toothD);
  }
  // Brow ridge
  rect(put, 38, 12 + by, 14, 2, col.browD);

  // === Horns ===
  rect(put, 40, 6 + by, 3, 8, col.hornD);
  rect(put, 41, 4 + by, 2, 4, col.horn);
  rect(put, 48, 6 + by, 3, 8, col.hornD);
  rect(put, 49, 4 + by, 2, 4, col.horn);
  put(41, 3 + by, col.hornL); put(49, 3 + by, col.hornL);

  // === Eye (glowing orange, menacing) ===
  rect(put, 44, 14 + by, 4, 3, col.out);
  put(45, 14 + by, col.eye);
  put(46, 14 + by, col.eyeL);
  put(45, 15 + by, col.eye);

  // === Mouth open with fire (attack frames) ===
  if (opts.mouthOpen) {
    // Wider open jaw
    rect(put, 50, 21 + by, 8, 4, col.m);
    rect(put, 52, 22 + by, 6, 2, col.b);
    // Fire breath (expanding cone to the right)
    for (let i = 0; i < 6; i++) {
      const spread = Math.floor(i * 0.6);
      for (let s = -spread; s <= spread; s++) {
        const fx = 58 + i;
        const fy = 19 + by + s;
        if (fx < 64 && fy >= 0 && fy < 64) {
          const colors = [col.fireD, col.fire, col.fireL, col.fireW, col.fireH];
          put(fx, fy, colors[Math.min(Math.abs(s), 4)]);
        }
      }
    }
  } else {
    // Smoke from nostrils when not breathing
    put(58, 17 + by, col.smoke);
    put(59, 16 + by, col.smoke);
    put(58, 19 + by, col.smoke);
  }

  // === Back spines along body top ===
  for (let x = 26; x < 38; x += 3) {
    put(x, 24 + by, col.d);
    put(x, 23 + by, col.l);
  }

  // Charge glow — fire aura building
  if (opts.chargeGlow) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 18;
      const gx = Math.round(32 + Math.cos(a) * r);
      const gy = Math.round(34 + by + Math.sin(a) * r * 0.6);
      disc(put, gx, gy, 2, col.fire);
      put(gx, gy, col.fireL);
    }
    disc(put, 56, 18 + by, 3, col.fireL);
  }

  // Rear up pose (attack windup) — wings spread wider
  if (opts.rearUp) {
    for (let i = 0; i < 5; i++) {
      put(4 - i, 10 + by + i, col.wingL);
      put(56 + i, 10 + by + i, col.wingL);
    }
  }

  // Birth animation — roaring/summoning
  if (opts.pockets != null) {
    const p = opts.pockets;
    for (let t = 0; t < 6; t++) {
      const a = (t / 6) * Math.PI * 2;
      const r = 8 + p * 3;
      const fx = Math.round(32 + Math.cos(a) * r);
      const fy = Math.round(34 + by + Math.sin(a) * r * 0.5);
      put(fx, fy, col.fire);
      if (p >= 2) put(fx + 1, fy, col.fireL);
      if (p >= 4) disc(put, fx, fy, 2, col.fireL);
    }
  }
}

export function drawCastleDragonDie(put: Put, step: number) {
  const cx = 32, cy = 34;
  const r = Math.max(0, 14 - step * 3);
  if (r > 0) {
    disc(put, cx, cy, r, '#8a2020');
    disc(put, cx, cy, Math.max(0, r - 2), '#a03030');
    disc(put, cx, cy, Math.max(0, r - 4), '#b04040');
  }
  // Flames dying out — chunks dispersing
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.4;
    const d = step * 5 + 5;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.6);
    put(x, y, '#8a2020');
    put(x + 1, y, i % 3 === 0 ? '#5a3a18' : '#6a1818');
    if (i % 2 === 0) put(x, y - 1, step < 3 ? '#ff6020' : '#c07040');
  }
  // Central flame dying
  if (step < 2) disc(put, cx, cy, 4, '#ff8020');
  if (step < 1) disc(put, cx, cy, 6, '#ffaa40');
}

export function drawCastleDragon(frame: BossFrame) {
  return (put: Put) => {
    switch (frame) {
      case 'idle0':      return drawCastleDragonBody(put, { bob: 0 });
      case 'idle1':      return drawCastleDragonBody(put, { bob: 1 });
      case 'move0':      return drawCastleDragonBody(put, { bob: 0, legStep: 1 });
      case 'move1':      return drawCastleDragonBody(put, { bob: 1, legStep: 0 });
      case 'move2':      return drawCastleDragonBody(put, { bob: 0, legStep: -1 });
      case 'move3':      return drawCastleDragonBody(put, { bob: 1, legStep: 0 });
      case 'atk0':       return drawCastleDragonBody(put, { rearUp: true, mouthOpen: true, bob: -2 });
      case 'atk1':       return drawCastleDragonBody(put, { bob: 1, mouthOpen: true });
      case 'chargeWind': return drawCastleDragonBody(put, { chargeGlow: true, wingsSpread: true, bob: 0 });
      case 'hit':        return drawCastleDragonBody(put, { flash: true });
      case 'birth0':     return drawCastleDragonBody(put, { pockets: 0, mouthOpen: true });
      case 'birth1':     return drawCastleDragonBody(put, { pockets: 1, mouthOpen: true });
      case 'birth2':     return drawCastleDragonBody(put, { pockets: 2, mouthOpen: true });
      case 'birth3':     return drawCastleDragonBody(put, { pockets: 3, mouthOpen: true });
      case 'birth4':     return drawCastleDragonBody(put, { pockets: 4, mouthOpen: true });
      case 'die0':       return drawCastleDragonDie(put, 0);
      case 'die1':       return drawCastleDragonDie(put, 1);
      case 'die2':       return drawCastleDragonDie(put, 2);
      case 'die3':       return drawCastleDragonDie(put, 3);
      case 'die4':       return drawCastleDragonDie(put, 4);
    }
  };
}

// ==================================================================
//  QUEEN ORB projectile (32x32) — blue-white glowing orb
// ==================================================================
export function drawQueenOrb(frame: 0|1) {
  return (put: Put) => {
    const cx = 16, cy = 16, r = 5;
    // Outer glow
    disc(put, cx, cy, r + 1, '#3a5a8a');
    // Main orb body
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        let color: string;
        if (dist < 0.3) color = '#ffffff';
        else if (dist < 0.5) color = '#cce0ff';
        else if (dist < 0.7) color = '#8abadd';
        else color = '#4a6a8a';
        put(cx + dx, cy + dy, color);
      }
    }
    // Specular highlight — shifts per frame for spin
    const hx = frame === 0 ? cx - 2 : cx - 1;
    const hy = frame === 0 ? cy - 2 : cy - 3;
    put(hx, hy, '#ffffff');
    put(hx + 1, hy, '#cce0ff');
    // Wispy trail
    put(cx + 3 + frame, cy + 2, '#6a8aaa');
    put(cx + 4 + frame, cy + 3, '#4a6a8a');
  };
}

// ==================================================================
//  DRAGON FIREBALL projectile (32x32) — round flame ball with flickering wisps
// ==================================================================
export function drawDragonFireball(frame: 0|1|2|3) {
  return (put: Put) => {
    const cx = 16, cy = 16, r = 7;
    const rot = frame * 0.8; // rotation offset per frame

    // Outer fire glow — soft halo
    for (let dy = -(r + 3); dy <= r + 3; dy++) {
      for (let dx = -(r + 3); dx <= r + 3; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + 3) * (r + 3) || d2 <= (r + 1) * (r + 1)) continue;
        put(cx + dx, cy + dy, '#6a1800');
      }
    }

    // Main flame body — layered with color gradient
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const dist = Math.sqrt(dx * dx + dy * dy) / r;
        // Angle-based color variation for flame feel
        const ang = Math.atan2(dy, dx) + rot;
        const flicker = Math.sin(ang * 3) * 0.12;
        const d = dist + flicker;
        let color: string;
        if (d < 0.2) color = '#ffffcc';
        else if (d < 0.35) color = '#ffee60';
        else if (d < 0.5) color = '#ffaa40';
        else if (d < 0.7) color = '#ff6020';
        else color = '#c04010';
        put(cx + dx, cy + dy, color);
      }
    }

    // Outline ring
    for (let dy = -(r + 1); dy <= r + 1; dy++) {
      for (let dx = -(r + 1); dx <= r + 1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + 1) * (r + 1) || d2 <= r * r) continue;
        if (Math.sqrt(d2) > r && Math.sqrt(d2) <= r + 1.2) put(cx + dx, cy + dy, '#8a2010');
      }
    }

    // Flame wisps radiating outward (rotating per frame)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rot;
      for (let d = r; d < r + 3 + (i % 2); d++) {
        const fx = Math.round(cx + Math.cos(a) * d);
        const fy = Math.round(cy + Math.sin(a) * d);
        const colors = ['#ff6020', '#ff8030', '#c04010', '#ff4000'];
        put(fx, fy, colors[(i + frame) % colors.length]);
      }
    }

    // Hot center specular
    const hx = cx + (frame < 2 ? -1 : 0);
    const hy = cy + (frame % 2 === 0 ? -2 : -1);
    put(hx, hy, '#ffffff');
    put(hx + 1, hy, '#ffffcc');
    put(hx, hy + 1, '#ffee60');
  };
}

// ==================================================================
//  DRAGON FIREBALL EXPLOSION (32x32) — fiery burst, 5 frames
// ==================================================================
export function drawDragonFireExplosion(frame: number) {
  return (put: Put) => {
    const cx = 16, cy = 16;
    // Expanding ring of fire
    const outerR = 3 + frame * 3;
    const innerR = Math.max(0, frame * 2 - 1);
    const alpha = 1 - frame * 0.15;

    // Outer fire ring
    for (let dy = -outerR; dy <= outerR; dy++) {
      for (let dx = -outerR; dx <= outerR; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > outerR || d < innerR) continue;
        const norm = (d - innerR) / (outerR - innerR);
        let color: string;
        if (norm < 0.3) color = frame < 2 ? '#ffffcc' : '#ffee60';
        else if (norm < 0.5) color = '#ffaa40';
        else if (norm < 0.7) color = '#ff6020';
        else color = '#c04010';
        if (alpha < 0.6 && norm > 0.5) continue; // fade outer edges
        put(cx + dx, cy + dy, color);
      }
    }

    // Flying ember chunks
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + frame * 0.3;
      const d = outerR + 1 + frame;
      const ex = Math.round(cx + Math.cos(a) * d);
      const ey = Math.round(cy + Math.sin(a) * d);
      if (ex >= 0 && ex < 32 && ey >= 0 && ey < 32) {
        const colors = ['#ff4000', '#ff8030', '#ffaa40', '#c04010'];
        put(ex, ey, colors[i % colors.length]);
        if (frame < 3) put(ex + (i % 2 === 0 ? 1 : -1), ey, '#ff6020');
      }
    }

    // Central bright core (fades out)
    if (frame < 3) {
      const coreR = Math.max(0, 3 - frame);
      disc(put, cx, cy, coreR, frame === 0 ? '#ffffff' : '#ffee60');
    }

    // Smoke wisps (later frames)
    if (frame >= 3) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + frame * 0.5;
        const d = outerR - 2;
        const sx = Math.round(cx + Math.cos(a) * d);
        const sy = Math.round(cy + Math.sin(a) * d);
        if (sx >= 0 && sx < 32 && sy >= 0 && sy < 32) {
          put(sx, sy, '#4a4a4a');
        }
      }
    }
  };
}

export type DesertBossVariant = 'burrower' | 'scorpion' | 'sandstorm' | 'wraith' | 'construct' | 'sun_priest';

export function drawDesertBoss(frame: BossFrame, variant: DesertBossVariant) {
  return (put: Put) => {
    if (frame.startsWith('die')) {
      const step = parseInt(frame.slice(3));
      const r = 24 - step * 4;
      if (r <= 0) return;
      const col = variant === 'sun_priest' ? '#ffd84a'
        : variant === 'construct' ? '#b89052'
        : variant === 'sandstorm' ? '#c8a45a'
        : variant === 'burrower' ? '#8a5830'
        : '#a06028';
      disc(put, 32, 34, r, col);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + step * 0.35;
        const d = step * 7 + 8;
        put(Math.round(32 + Math.cos(a) * d), Math.round(34 + Math.sin(a) * d), '#6a4528');
      }
      return;
    }
    const flash = frame === 'hit';
    const bob = frame === 'idle1' || frame === 'move1' ? -1 : frame === 'move3' ? 1 : 0;
    const wind = frame === 'chargeWind';
    const atk = frame === 'atk0' || frame === 'atk1';
    const pal = variant === 'wraith'
      ? { d: '#4a3c30', m: '#9f875f', l: '#e0d0a0', hi: '#64c8ff' }
      : variant === 'construct'
      ? { d: '#4d3820', m: '#9a7849', l: '#d8b878', hi: '#40e0ff' }
      : variant === 'sun_priest'
      ? { d: '#8a3a10', m: '#e09a28', l: '#ffd84a', hi: '#ffffff' }
      : variant === 'sandstorm'
      ? { d: '#5a421f', m: '#b8893d', l: '#e0c06f', hi: '#fff0b0' }
      : variant === 'burrower'
      ? { d: '#3f2417', m: '#8a5830', l: '#c88a4a', hi: '#ffd090' }
      : { d: '#4a2512', m: '#9a5a24', l: '#d08a3a', hi: '#ffcf70' };
    const d = flash ? P.white : pal.d;
    const m = flash ? P.white : pal.m;
    const l = flash ? P.white : pal.l;
    const hi = flash ? P.white : pal.hi;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -24; dx <= 24; dx++) {
        if ((dx * dx) / 576 + (dy * dy) / 6 <= 1) put(32 + dx, 58 + dy, P.shadow);
      }
    }

    if (variant === 'burrower') {
      const sway = frame === 'move1' ? -2 : frame === 'move3' ? 2 : 0;
      for (let i = 0; i < 7; i++) {
        const x = 15 + i * 5;
        const y = 42 - Math.abs(i - 3) * 4 + bob;
        ellipse(put, x + sway, y, 8, 7, i % 2 ? d : m);
        ellipse(put, x + sway, y - 2, 6, 5, i % 2 ? m : l);
        rect(put, x - 5 + sway, y + 3, 10, 2, d);
      }
      ellipse(put, 45 + sway, 22 + bob, 12, 10, d);
      ellipse(put, 44 + sway, 20 + bob, 10, 8, m);
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.36;
        line(put,
          Math.round(50 + sway + Math.cos(a) * 4),
          Math.round(20 + bob + Math.sin(a) * 4),
          Math.round(57 + sway + Math.cos(a) * (atk ? 10 : 7)),
          Math.round(20 + bob + Math.sin(a) * (atk ? 10 : 7)),
          hi);
      }
      disc(put, 41 + sway, 18 + bob, 2, P.outline);
      disc(put, 48 + sway, 18 + bob, 2, P.outline);
      return;
    }

    if (variant === 'scorpion') {
      ellipse(put, 30, 36 + bob, 20, 13, d);
      ellipse(put, 30, 34 + bob, 18, 11, m);
      ellipse(put, 26, 31 + bob, 10, 6, l);
      for (let i = 0; i < 5; i++) {
        const lx = 14 + i * 5;
        line(put, lx, 44 + bob, lx - 9, 53 + ((i + (frame === 'move1' ? 1 : 0)) % 2), d);
        line(put, lx + 8, 44 + bob, lx + 16, 53 + ((i + (frame === 'move3' ? 1 : 0)) % 2), d);
      }
      rect(put, 43, 18 + bob, 6, 22, d);
      rect(put, 47, 13 + bob, 8, 6, m);
      disc(put, 56, 14 + bob, wind ? 4 : 3, wind ? hi : '#d04020');
      rect(put, 10, 31 + bob, atk ? 12 : 8, 5, d);
      rect(put, 45, 31 + bob, atk ? 12 : 8, 5, d);
      put(24, 29 + bob, '#ffd84a'); put(35, 29 + bob, '#ffd84a');
      return;
    }

    if (variant === 'sandstorm') {
      ellipse(put, 32, 36 + bob, 18, 15, d);
      ellipse(put, 32, 33 + bob, 16, 13, m);
      ellipse(put, 23, 26 + bob, 9, 9, d);
      ellipse(put, 22, 24 + bob, 8, 8, m);
      rect(put, 16, 46 + bob, 10, 8, d);
      rect(put, 38, 46 - bob, 10, 8, d);
      rect(put, 12, 34 + bob, atk ? 16 : 10, 5, d);
      rect(put, 42, 34 + bob, atk ? 16 : 10, 5, d);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + (wind ? 0.4 : 0);
        line(put,
          Math.round(32 + Math.cos(a) * 18),
          Math.round(34 + bob + Math.sin(a) * 12),
          Math.round(32 + Math.cos(a) * 24),
          Math.round(34 + bob + Math.sin(a) * 17),
          i % 2 ? l : hi);
      }
      disc(put, 20, 23 + bob, 2, P.outline);
      if (wind || atk) ring(put, 32, 34 + bob, 20, hi);
      return;
    }

    if (variant === 'wraith') {
      ellipse(put, 32, 30 + bob, 17, 21, d);
      ellipse(put, 32, 28 + bob, 15, 19, m);
      for (let i = 0; i < 9; i++) {
        const x = 17 + i * 4;
        line(put, x, 47 + bob, x - 4 + i, 58, i % 2 ? d : l);
      }
      disc(put, 25, 27 + bob, 2, hi); disc(put, 39, 27 + bob, 2, hi);
      if (atk || wind) ring(put, 32, 31 + bob, wind ? 15 : 11, '#64c8ff');
      return;
    }

    if (variant === 'construct') {
      rect(put, 16, 18 + bob, 32, 33, d);
      rect(put, 18, 16 + bob, 28, 32, m);
      rect(put, 20, 18 + bob, 24, 5, l);
      rect(put, 20, 34 + bob, 24, 4, d);
      rect(put, 10, 42 + bob, 14, 10, d);
      rect(put, 40, 42 - bob, 14, 10, d);
      rect(put, 11, 28 + bob, 8, atk ? 18 : 12, m);
      rect(put, 45, 28 + bob, 8, atk ? 18 : 12, m);
      disc(put, 25, 29 + bob, 2, hi); disc(put, 39, 29 + bob, 2, hi);
      return;
    }

    // Sun Priest
    ellipse(put, 32, 34 + bob, 15, 18, d);
    ellipse(put, 32, 31 + bob, 13, 16, m);
    rect(put, 22, 21 + bob, 20, 5, l);
    disc(put, 32, 18 + bob, wind ? 9 : 7, l);
    disc(put, 32, 18 + bob, wind ? 5 : 4, hi);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + (wind ? 0.25 : 0);
      line(put,
        Math.round(32 + Math.cos(a) * 11),
        Math.round(18 + bob + Math.sin(a) * 11),
        Math.round(32 + Math.cos(a) * 16),
        Math.round(18 + bob + Math.sin(a) * 16),
        l);
    }
    disc(put, 27, 31 + bob, 2, P.outline); disc(put, 37, 31 + bob, 2, P.outline);
    if (atk) ring(put, 32, 35 + bob, 18, '#ffd84a');
  };
}
