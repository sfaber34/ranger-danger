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
  pockets?: number;   // birth animation — spectral bulges
  rearUp?: boolean;    // legacy alias for armRaised
  phase?: number;      // 0-3 flame/vortex animation phase
  flare?: number;      // 0 (calm) … 2 (full dash-windup inferno)
  armRaised?: boolean; // windup pose: claw arm thrown high
}

export function drawFogPhantomBody(rawPut: Put, opts: FogOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const ph = opts.phase ?? 0;
  const flash = opts.flash ?? false;
  const chargeGlow = opts.chargeGlow ?? false;
  const armRaised = (opts.armRaised ?? false) || (opts.rearUp ?? false);
  const flare = opts.flare ?? (chargeGlow ? 0.6 : 0);

  // smoke body ramp
  const sD = flash ? P.white : P.fogD;
  const s  = flash ? P.white : P.fog;
  const sM = flash ? P.white : P.fogM;
  const sL = flash ? P.white : P.fogL;
  // blue-flame ramp
  const bfD = flash ? P.white : P.bfireD;
  const bf  = flash ? P.white : P.bfire;
  const bfL = flash ? P.white : P.bfireL;
  const bfC = flash ? P.white : P.bfireC;
  // stone claws
  const st  = flash ? P.white : P.stone;
  const stD = flash ? P.white : P.stoneD;
  const stL = flash ? P.white : P.stoneL;
  const out = flash ? P.white : P.outline;

  // Record the SMOKE BODY + claws for a crisp outline; flames stay
  // unrecorded so they read as soft light.
  const px = new Set<number>();
  const put: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    px.add(y * 64 + x);
    rawPut(x, y, c);
  };
  const pf: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    rawPut(x, y, c);
  };

  // Ground glow — blue fire pooling where the phantom meets the water
  for (let dx = -16; dx <= 16; dx++)
    for (let dy = -1; dy <= 1; dy++)
      if ((dx * dx) / 256 + (dy * dy) / 2 <= 1) pf(cx + dx, 58 + dy, bfD);
  pf(cx - 13 + ph * 2, 57, bf);
  pf(cx + 14 - ph * 3, 57, bf);

  // ---- ANIMATED BLUE FLAME SKIRT (the phantom rises out of it) ----
  // `flare` (dash windup) surges the skirt into a towering inferno.
  const heatBoost = flare * 0.1 + (chargeGlow ? 0.06 : 0);
  for (let x = -13; x <= 13; x++) {
    const ax = Math.abs(x);
    const base = 16 + flare * 7 - ax * (1.1 - flare * 0.2);
    const lick = Math.sin(x * 1.9 + ph * (Math.PI / 2)) * 3
               + Math.sin(x * 0.7 - ph * (Math.PI / 4)) * 2;
    const h = Math.round(base + lick);
    if (h < 3) continue;
    for (let i = 0; i < h; i++) {
      const y = 58 - i;
      const t = i / h;
      if (t > 0.7 && (x + y + ph) % 3 === 0) continue; // ragged flickering tips
      const heat = (1 - ax / 14) * (1 - t * 0.8) + heatBoost;
      pf(cx + x, y, heat > 0.55 ? bfC : heat > 0.38 ? bfL : heat > 0.2 ? bf : bfD);
    }
  }
  // three defined bright tongues riding in front of the skirt
  for (const [tx2, tallBase, k] of [[-7, 13, 0], [0, 16, 1], [7, 13, 2]] as const) {
    const tall = tallBase + Math.round(flare * 5);
    for (let j = 0; j < tall; j++) {
      const sway = Math.round(Math.sin(j * 0.55 + ph * (Math.PI / 2) + k * 2) * 2);
      const t = j / tall;
      pf(cx + tx2 + sway, 57 - j, t > 0.7 ? bf : t > 0.35 ? bfL : bfC);
    }
  }

  // ---- TORSO: smoke spiraling INTO the chest vortex (front-facing) ----
  // Every torso pixel is shaded by which spiral arm it falls on, and the
  // arms rotate with the phase — the whole chest visibly swirls.
  const vx = cx, vy = 31 + bob;
  for (let y = 23 + bob; y <= 46 + bob; y++) {
    const t = (y - 23 - bob) / 23;                 // 0 shoulders → 1 waist
    const halfW = Math.round(11 - t * 5 + Math.sin(t * 7 + ph) * 0.8);
    for (let dx = -halfW; dx <= halfW; dx++) {
      const edge = Math.abs(dx) / halfW;
      if (edge > 0.82 && (dx + y + ph) % 3 === 0) continue; // smoky ragged edge
      const rx = dx, ry = y - vy;
      const r = Math.sqrt(rx * rx + ry * ry);
      const a = Math.atan2(ry, rx);
      const band = (((Math.round((a * 1.91 + r * 0.55 - ph * 0.45) * 2) % 4) + 4) % 4);
      put(cx + dx, y,
        edge > 0.86 ? sD : band === 0 ? sL : band === 1 ? s : band === 2 ? sM : sD);
    }
  }
  // waist wisps curling off the hips into the fire
  for (const sgn of [-1, 1] as const) {
    put(cx + sgn * 7, 45 + bob, sM);
    put(cx + sgn * 8, 46 + bob, sD);
    put(cx + sgn * 9, 48 + bob, sD);
    pf(cx + sgn * 8, 44 + bob, bfD);
  }

  // ---- chest vortex: blazing spiral core that ROTATES with the phase ----
  disc(pf, vx, vy, 6 + Math.round(flare), bfD);          // glow backdrop
  for (let t2 = 0; t2 <= 1; t2 += 0.02) {
    const a = t2 * 4.2 * Math.PI + ph * (Math.PI / 2);
    const r = 0.5 + t2 * (5.5 + flare * 1.5);
    pf(Math.round(vx + Math.cos(a) * r), Math.round(vy + Math.sin(a) * r * 0.9),
       t2 < 0.3 ? bfC : t2 < 0.65 ? bfL : bf);
  }
  pf(vx, vy, P.white);

  // ---- shoulders: angular smoke masses with curling wisps ----
  for (const sgn of [-1, 1] as const) {
    disc(put, cx + sgn * 10, 25 + bob, 4, sM);
    disc(put, cx + sgn * 9, 24 + bob, 2, sL);            // top highlight
    put(cx + sgn * 13, 26 + bob, sD);                    // squared outer edge
    put(cx + sgn * 13, 27 + bob, sD);
    // smoke curl hooking off the shoulder
    for (let t2 = 0; t2 < 1; t2 += 0.1) {
      const a = t2 * 3.5 + ph * 0.3;
      const r = 3.5 - t2 * 2.5;
      put(Math.round(cx + sgn * (11 + Math.cos(a) * r)),
          Math.round(21 + bob + Math.sin(a) * r), t2 < 0.5 ? sL : sM);
    }
    // flame streamer whipping off each shoulder
    pf(cx + sgn * (12 + (ph % 2)), 20 + bob, bfL);
    pf(cx + sgn * (14 - (ph % 2)), 18 + bob, bf);
    pf(cx + sgn * 15, 16 + bob, bfD);
  }

  // ---- neck + head: front-facing, twin crest horns swept back ----
  const hyy = 16 + bob;
  rect(put, cx - 2, hyy + 5, 5, 3, sM);                  // neck
  put(cx, hyy + 5, sL);
  disc(put, cx, hyy, 5, sM);                             // skull
  disc(put, cx, hyy + 1, 4, sL);                         // pale face plate
  rect(put, cx - 4, hyy - 3, 9, 2, sD);                  // heavy smoke brow
  put(cx, hyy - 2, sM);                                  // brow part
  // crest horns sweeping back-up on BOTH sides
  for (const sgn of [-1, 1] as const) {
    line(put, cx + sgn * 2, hyy - 4, cx + sgn * 8, hyy - 9, sM);
    line(put, cx + sgn * 3, hyy - 4, cx + sgn * 9, hyy - 9, s);
    line(put, cx + sgn * 3, hyy - 3, cx + sgn * 9, hyy - 8, sD);
    put(cx + sgn * 10, hyy - 10, sM);                    // curled tip
    put(cx + sgn * 11, hyy - 9, sD);
    // fire streaming off the crest
    pf(cx + sgn * 5, hyy - 8 - (ph % 2), bfL);
    pf(cx + sgn * 8, hyy - 11 + (ph % 2), bf);
    pf(cx + sgn * 11, hyy - 12, bfD);
  }
  // central crest spike
  put(cx, hyy - 5, sM); put(cx, hyy - 6, sL);
  pf(cx, hyy - 8 + (ph % 2), bfL);
  pf(cx + 1, hyy - 10, bf);
  // eyes — two slanted burning almonds under the brow
  const eyeC = chargeGlow ? P.white : flash ? P.white : P.bfireC;
  for (const sgn of [-1, 1] as const) {
    put(cx + sgn * 2, hyy - 1, eyeC);
    put(cx + sgn * 3, hyy - 1, flash ? P.white : P.fogGlow);
    put(cx + sgn * 4, hyy - 2, sD);                      // angry slant
    if (chargeGlow) pf(cx + sgn * 4, hyy - 1, P.bfireL); // glare bleeding off
  }
  // open mouth — dark maw with firelight behind jagged edges
  rect(put, cx - 2, hyy + 2, 5, 2, out);
  put(cx - 2, hyy + 2, sM);                              // lip corners
  put(cx + 2, hyy + 2, sM);
  pf(cx, hyy + 3, bfD);                                  // glow in the throat
  pf(cx - 1, hyy + 2, bfD);
  put(cx - 1, hyy + 4, sL);                              // under-lit chin
  put(cx, hyy + 4, sL);
  put(cx + 1, hyy + 4, sL);

  // ---- BOTH arms: smoke limbs ending in stone-clawed fists ----
  // armRaised (windup) throws them overhead, talons to the sky.
  const TALON: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[0, 1], [1, 1], [1, 2], [2, 3], [2, 4], [1, 5]],          // outer hook
    [[0, 2], [1, 2], [1, 3], [1, 4], [2, 5], [2, 6], [1, 7]],  // long middle talon
    [[-1, 2], [-1, 3], [0, 4], [0, 5], [-1, 6]],               // inner hook
  ];
  for (const sgn of [-1, 1] as const) {
    const shX = cx + sgn * 11, shY = 26 + bob;
    const elX = cx + sgn * (armRaised ? 15 : 17);
    const elY = armRaised ? 18 + bob : 32 + bob;
    const wrX = cx + sgn * (armRaised ? 18 : 21);
    const wrY = armRaised ? 11 + bob : 38 + bob;
    // upper arm (3px of layered smoke)
    line(put, shX, shY - 1, elX, elY - 1, sL);
    line(put, shX, shY, elX, elY, s);
    line(put, shX, shY + 1, elX, elY + 1, sD);
    // forearm
    line(put, elX, elY - 1, wrX, wrY - 1, sL);
    line(put, elX, elY, wrX, wrY, s);
    line(put, elX, elY + 1, wrX, wrY + 1, sD);
    // smoke wisp trailing from the elbow
    put(elX + sgn, elY + 2, sD);
    pf(elX + sgn * 2, elY + 3, bfD);
    // stone fist — knuckle plates catch the vortex light
    disc(put, wrX, wrY + (armRaised ? -1 : 1), 2, st);
    put(wrX, wrY + (armRaised ? -2 : 0), stL);
    put(wrX - sgn, wrY + (armRaised ? -1 : 1), stD);
    // three hooked talons per hand (skyward when raised)
    const dir = armRaised ? -1 : 1;
    for (let k = 0; k < TALON.length; k++) {
      const path = TALON[k];
      const bx = wrX + sgn * (k * 2 - 2);
      for (let j = 0; j < path.length; j++) {
        const [dx2, dy2] = path[j];
        put(bx + sgn * dx2, wrY + dir * (1 + dy2), j === path.length - 1 ? stL : j < 2 ? stD : st);
      }
    }
    // windup: fire crawls up the raised arms to the claws
    if (flare >= 1 && armRaised) {
      pf(wrX - sgn, wrY - 3, bfL);
      pf(wrX + sgn, wrY - 4 + (ph % 2), bf);
      pf(elX, elY - 2, bf);
      pf(elX - sgn, elY - 3 + (ph % 2), bfD);
    }
  }

  // ---- tall flame tongues climbing both back edges ----
  for (const [tx2, tallBase, k] of [[-11, 14, 0], [-14, 9, 1], [11, 14, 2], [14, 9, 3]] as const) {
    const tall = tallBase + Math.round(flare * 4);
    for (let j = 0; j < tall; j++) {
      const y = 56 - j;
      const sway = Math.round(Math.sin(j * 0.5 + ph * (Math.PI / 2) + k) * 2);
      const t = j / tall;
      pf(cx + tx2 + sway, y, t > 0.75 ? bfD : t > 0.45 ? bf : t > 0.2 ? bfL : bfC);
    }
  }
  // detached sparks drifting upward (the whole swarm rises during a flare)
  const sparks: ReadonlyArray<readonly [number, number]> = [[-10, 30], [8, 26], [-5, 20], [12, 33], [2, 12], [-13, 24]];
  for (let k = 0; k < sparks.length; k++) {
    if (flare < 1 && (k + ph) % 3 === 0) continue;
    const [sx, sy] = sparks[k];
    pf(cx + sx, sy - ((ph * 2 + k * 3) % 6) - Math.round(flare * 4), k % 2 === 0 ? bfL : bf);
  }
  // windup only: embers spiraling high around the whole body
  if (flare >= 1) {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + ph * 0.9;
      pf(Math.round(cx + Math.cos(ang) * (14 + (k % 2) * 3)),
         Math.round(30 + bob + Math.sin(ang) * 13), k % 2 === 0 ? bfL : bf);
    }
  }

  // ---- birth pockets — spectral bulges torn open on the torso ----
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [[-5, 28 + bob], [0, 24 + bob], [5, 28 + bob]];
    for (const [dx2, oy] of pockets) {
      const ox = cx + dx2;
      if (stage === 0) {
        disc(put, ox, oy, 3, sL);
        disc(put, ox, oy, 2, s);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, sL);
        disc(put, ox, oy, 2, out);
        put(ox, oy, P.bfire);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, sL);
        disc(put, ox, oy, 2, sM);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, sD);
        disc(put, ox, oy - 1, 3, sM);
        disc(put, ox, oy - 2, 2, s);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, out);
        disc(put, ox, oy, 2, sD);
      }
    }
  }

  // Crisp 1px outline around the smoke body + claws — flames stay soft
  strokeOutline(px, rawPut, 64);
}

export function drawFogPhantomDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  const r = Math.max(0, 14 - step * 3);
  if (r > 0) {
    disc(put, cx, cy, r, P.fogD);
    disc(put, cx, cy, Math.max(0, r - 1), P.fogM);
    disc(put, cx, cy, Math.max(0, r - 3), P.bfireL);
  }
  // smoke wisps + blue embers scattering
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 5 + 5;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, P.fogM);
    put(x + 1, y, i % 3 === 0 ? P.bfire : P.fogD);
    if (i % 4 === 0) put(x, y + 1, P.bfireD);
  }
  if (step < 2) disc(put, cx, cy, 6, P.bfireC);
}

/** River boss frame set — the shared BossFrame plus extra idle frames (so the
 *  blue fire never sits still) and a 6-frame play-once dash windup. */
export type RiverBossFrame = BossFrame | 'idle2' | 'idle3'
  | 'chargeWind0' | 'chargeWind1' | 'chargeWind2' | 'chargeWind3' | 'chargeWind4' | 'chargeWind5';

export const riverBossFrames: RiverBossFrame[] = [
  'idle0','idle1','idle2','idle3',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind','chargeWind0','chargeWind1','chargeWind2','chargeWind3','chargeWind4','chargeWind5',
  'hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

export function drawFogPhantom(frame: RiverBossFrame) {
  return (put: Put) => {
    switch (frame) {
      // 4 idle frames cycle the flame flicker + vortex rotation
      case 'idle0':      return drawFogPhantomBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawFogPhantomBody(put, { bob: -1, phase: 1 });
      case 'idle2':      return drawFogPhantomBody(put, { bob: -2, phase: 2 });
      case 'idle3':      return drawFogPhantomBody(put, { bob: -1, phase: 3 });
      case 'move0':      return drawFogPhantomBody(put, { bob: 0, phase: 0 });
      case 'move1':      return drawFogPhantomBody(put, { bob: -1, phase: 1 });
      case 'move2':      return drawFogPhantomBody(put, { bob: -2, phase: 2 });
      case 'move3':      return drawFogPhantomBody(put, { bob: -1, phase: 3 });
      case 'atk0':       return drawFogPhantomBody(put, { armRaised: true, flare: 0.8, bob: -2, phase: 0 });
      case 'atk1':       return drawFogPhantomBody(put, { flare: 1, bob: 2, phase: 2 });
      // legacy single windup frame (kept for the shared BossFrame set)
      case 'chargeWind': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 1, phase: 1, bob: -1 });
      // dash windup: ONE arm raise (cw0→cw1), then locked overhead while
      // only the flames pulse (cw2-5 cycle the phase at full flare)
      case 'chargeWind0': return drawFogPhantomBody(put, { chargeGlow: true, flare: 0.6, phase: 0, bob: -1 });
      case 'chargeWind1': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 1.2, phase: 1, bob: -2 });
      case 'chargeWind2': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 2, phase: 0, bob: -2 });
      case 'chargeWind3': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 2, phase: 1, bob: -2 });
      case 'chargeWind4': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 2, phase: 2, bob: -2 });
      case 'chargeWind5': return drawFogPhantomBody(put, { chargeGlow: true, armRaised: true, flare: 2, phase: 3, bob: -2 });
      case 'hit':        return drawFogPhantomBody(put, { flash: true });
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
export interface InfectedOpts {
  bob?: number;
  flash?: boolean;
  chargeGlow?: boolean;
  pockets?: number;
  phase?: number;       // 0-3 tentacle writhe phase
  flare?: number;       // 0 (calm) … 2 (full dash-windup frenzy)
  tentaclesUp?: boolean; // windup pose: tentacles whipped skyward
}

export function drawInfectedBossBody(rawPut: Put, opts: InfectedOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const ph = opts.phase ?? 0;
  const flash = opts.flash ?? false;
  const chargeGlow = opts.chargeGlow ?? false;
  const up = opts.tentaclesUp ?? false;
  const flare = opts.flare ?? (chargeGlow ? 0.6 : 0);

  // putrid purple flesh
  const fl  = flash ? P.white : P.infect;
  const flD = flash ? P.white : P.infectD;
  const flM = flash ? P.white : P.infectM;
  const flL = flash ? P.white : P.infectL;
  // burning orange (eyes, suckers, pustules)
  const o   = flash ? P.white : P.infectH;
  const oD  = flash ? P.white : P.infectHD;
  const oM  = flash ? P.white : P.infectHM;
  const oL  = flash ? P.white : P.infectHL;
  const out = flash ? P.white : P.outline;

  // Record flesh pixels for a crisp outline; glows stay unrecorded.
  const px = new Set<number>();
  const put: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    px.add(y * 64 + x);
    rawPut(x, y, c);
  };
  const pf: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    rawPut(x, y, c);
  };

  // Slime pool shadow it drags itself across
  for (let dx = -17; dx <= 17; dx++)
    for (let dy = -1; dy <= 1; dy++)
      if ((dx * dx) / 289 + (dy * dy) / 2 <= 1) rawPut(cx + dx, 57 + dy, flash ? P.white : P.infectD);
  pf(cx - 14 + ph * 2, 56, flM);
  pf(cx + 15 - ph * 3, 56, flM);

  // ---- tentacle renderer ----
  // Crawls segment by segment; writhes with the phase. `raise` whips the
  // tentacle skyward (windup), otherwise it slithers down and outward.
  const mantleBot = 36 + bob;
  const tent = (bx: number, dir: number, len: number, k: number, raise: boolean, thick: number) => {
    let x = cx + bx, y = mantleBot - 2;
    for (let j = 0; j < len; j++) {
      const t = j / len;
      if (raise) {
        y -= 1;
        x = cx + bx + Math.round(dir * 4 * Math.sin(t * 2.0) + Math.sin(j * 0.8 + ph * 1.57 + k) * 1.5);
      } else {
        y += 1;
        x = cx + bx + Math.round(dir * t * 6 + Math.sin(j * 0.6 + ph * 1.57 + k) * (2.2 - t * 1.5));
      }
      if (y < 2 || y > 57) break;
      const w = t < 0.3 ? thick : t < 0.7 ? Math.max(1, thick - 1) : Math.max(0, thick - 2);
      for (let dx = -w; dx <= w; dx++)
        put(x + dx, y, Math.abs(dx) === w && w > 0 ? flD : t < 0.5 && dx === 0 ? flM : fl);
      put(x - w, y - 1, j % 2 === 0 ? flL : fl); // slick top highlight
      // orange suckers dotted along the flesh
      if (j % 3 === 1 && w >= 1) put(x, y, j % 6 === 1 ? oL : o);
      // curling tip
      if (j === len - 1) {
        put(x + (raise ? -1 : 1), y + (raise ? 1 : -1), flM);
        put(x, y + (raise ? 1 : -1), flD);
      }
    }
  };

  // back row of the tentacle skirt (behind the mantle)
  tent(-11, -1, 19, 0, up, 2);
  tent(-4, -0.4, 21, 1, false, 2);
  tent(4, 0.4, 21, 2, false, 2);
  tent(11, 1, 19, 3, up, 2);

  // ---- the mantle: bulbous dome of mottled flesh (fills the canvas) ----
  const my = 24 + bob;
  ellipse(put, cx, my, 15, 13, flD);
  ellipse(put, cx, my, 14, 12, fl);
  // mottled diseased texture
  for (let y = -12; y <= 12; y++)
    for (let x = -14; x <= 14; x++) {
      if ((x * x) / 196 + (y * y) / 144 > 1) continue;
      if ((x * 3 + y * 7 + 64) % 11 === 0) put(cx + x, my + y, flM);
      else if ((x * 5 + y * 3 + 64) % 13 === 0) put(cx + x, my + y, flD);
    }
  // sickly sheen upper-left
  ellipse(put, cx - 6, my - 6, 6, 4, flL);
  // throbbing veins radiating from the eye
  for (const [vx2, vy2, ex, ey] of [[-3, -2, -11, -8], [3, -3, 10, -9], [-4, 2, -12, 6], [4, 3, 11, 7]] as const) {
    line(put, cx + vx2, my + vy2, cx + ex, my + ey, flD);
  }
  // orange pustule clusters — they brighten as it winds up
  for (const [bx2, by2] of [[-10, -3], [9, -6], [-5, 9], [11, 4]] as const) {
    put(cx + bx2, my + by2, flare >= 1 ? oL : o);
    put(cx + bx2 + 1, my + by2, oD);
    put(cx + bx2, my + by2 - 1, oM);
    if (flare >= 1) pf(cx + bx2 - 1, my + by2 - 1, oL); // festering glow
  }

  // ---- the EYE: one huge burning orb with a slit pupil ----
  const ey = my - 2;
  disc(put, cx, ey, 6, oD);
  disc(put, cx, ey, 5, o);
  disc(put, cx, ey, 4, chargeGlow ? oL : oM);
  rect(put, cx, ey - 3, 1, 7, out);            // vertical slit pupil
  put(cx - 3, ey - 2, P.white);                // wet glint
  put(cx - 2, ey - 3, P.white);
  if (chargeGlow) {                            // blazing glare
    pf(cx - 7, ey, P.infectHL);
    pf(cx + 7, ey, P.infectHL);
    pf(cx, ey - 7, P.infectHL);
  }
  // lesser eyes scattered across the dome, blinking out of sync
  const lesser: ReadonlyArray<readonly [number, number]> = [[-10, -7], [11, -4], [-11, 3], [7, -10]];
  for (let k = 0; k < lesser.length; k++) {
    const [lx2, ly2] = lesser[k];
    if ((k + ph) % 4 === 0) {                  // this one is mid-blink
      put(cx + lx2, my + ly2, flD);
      put(cx + lx2 + 1, my + ly2, flD);
    } else {
      put(cx + lx2, my + ly2, oL);
      put(cx + lx2 + 1, my + ly2, o);
      put(cx + lx2, my + ly2 + 1, oD);
    }
  }

  // ---- the maw: hooked beak parting a glowing gullet ----
  const by = my + 10;
  rect(put, cx - 3, by, 7, 2, out);
  put(cx - 4, by, flD);                        // lip folds
  put(cx + 4, by, flD);
  pf(cx, by + 1, o);                           // orange light in the throat
  pf(cx - 1, by, oD);
  put(cx, by - 1, flash ? P.white : P.wBoneL); // hooked beak tip
  put(cx - 1, by + 2, flash ? P.white : P.wBone);
  put(cx + 1, by + 2, flash ? P.white : P.wBone);

  // front row of the skirt + the two big arm-tentacles (over the mantle)
  tent(-7, -0.6, 17, 4, false, 2);
  tent(0, 0, 16, 5, false, 2);
  tent(7, 0.6, 17, 6, false, 2);
  tent(-15, -1, 20, 7, up, 3);
  tent(15, 1, 20, 8, up, 3);

  // slime dripping off the writhing mass
  pf(cx - 7, 48 + ((ph * 2) % 6), flM);
  pf(cx + 9, 45 + ((ph * 3 + 2) % 8), flM);
  pf(cx - 11, 51 + (ph % 4), flD);

  // windup frenzy: orange embers orbiting the whole horror
  if (flare >= 1) {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + ph * 0.9;
      pf(Math.round(cx + Math.cos(ang) * (15 + (k % 2) * 3)),
         Math.round(28 + bob + Math.sin(ang) * 14), k % 2 === 0 ? oL : o);
    }
    pf(cx - 3 + ph, 10 + bob, oL); // heat shimmer above
  }

  // ---- birth pockets — boils splitting open on the mantle ----
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [[-6, my - 6], [0, my - 9], [6, my - 6]];
    for (const [dx2, oy] of pockets) {
      const ox = cx + dx2;
      if (stage === 0) {
        disc(put, ox, oy, 3, flL);
        disc(put, ox, oy, 2, fl);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, flD);
        disc(put, ox, oy, 2, out);
        put(ox, oy, P.infectHD);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, flD);
        disc(put, ox, oy, 2, P.infectH);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
        put(ox, oy + 1, out);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, flD);
        disc(put, ox, oy - 1, 3, P.infectH);
        disc(put, ox, oy - 2, 2, P.infectHL);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
        put(ox, oy, out);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, out);
        disc(put, ox, oy, 2, flD);
      }
    }
  }

  // Crisp 1px outline around the flesh — glows stay soft
  strokeOutline(px, rawPut, 64);
}

export function drawInfectedBossDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  const r = Math.max(0, 20 - step * 4);
  if (r > 0) {
    disc(put, cx, cy, r, P.infectD);
    disc(put, cx, cy, Math.max(0, r - 1), P.infect);
    disc(put, cx, cy, Math.max(0, r - 3), P.infectL);
  }
  // tentacle chunks + burst pustules flying out
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

/** Infected boss frame set — the shared BossFrame plus extra idle frames (the
 *  tentacles never stop writhing) and a 6-frame play-once dash windup. */
export type InfectedBossFrame = BossFrame | 'idle2' | 'idle3'
  | 'chargeWind0' | 'chargeWind1' | 'chargeWind2' | 'chargeWind3' | 'chargeWind4' | 'chargeWind5';

export const infectedBossFrames: InfectedBossFrame[] = [
  'idle0','idle1','idle2','idle3',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind','chargeWind0','chargeWind1','chargeWind2','chargeWind3','chargeWind4','chargeWind5',
  'hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

export function drawInfectedBoss(frame: InfectedBossFrame) {
  return (put: Put) => {
    switch (frame) {
      // 4 idle frames keep the tentacles writhing + lesser eyes blinking
      case 'idle0':      return drawInfectedBossBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawInfectedBossBody(put, { bob: -1, phase: 1 });
      case 'idle2':      return drawInfectedBossBody(put, { bob: -2, phase: 2 });
      case 'idle3':      return drawInfectedBossBody(put, { bob: -1, phase: 3 });
      case 'move0':      return drawInfectedBossBody(put, { bob: 0, phase: 0 });
      case 'move1':      return drawInfectedBossBody(put, { bob: -1, phase: 1 });
      case 'move2':      return drawInfectedBossBody(put, { bob: -2, phase: 2 });
      case 'move3':      return drawInfectedBossBody(put, { bob: -1, phase: 3 });
      case 'atk0':       return drawInfectedBossBody(put, { tentaclesUp: true, flare: 0.8, bob: -2, phase: 0 });
      case 'atk1':       return drawInfectedBossBody(put, { flare: 1, bob: 2, phase: 2 });
      // legacy single windup frame (kept for the shared BossFrame set)
      case 'chargeWind': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 1, phase: 1, bob: -1 });
      // dash windup: ONE tentacle raise (cw0→cw1), then they stay whipped
      // skyward while the frenzy pulses (cw2-5 cycle the writhe phase)
      case 'chargeWind0': return drawInfectedBossBody(put, { chargeGlow: true, flare: 0.6, phase: 0, bob: -1 });
      case 'chargeWind1': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 1.2, phase: 1, bob: -2 });
      case 'chargeWind2': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 2, phase: 0, bob: -2 });
      case 'chargeWind3': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 2, phase: 1, bob: -2 });
      case 'chargeWind4': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 2, phase: 2, bob: -2 });
      case 'chargeWind5': return drawInfectedBossBody(put, { chargeGlow: true, tentaclesUp: true, flare: 2, phase: 3, bob: -2 });
      case 'hit':        return drawInfectedBossBody(put, { flash: true });
      case 'birth0':     return drawInfectedBossBody(put, { pockets: 0, phase: 0 });
      case 'birth1':     return drawInfectedBossBody(put, { pockets: 1, phase: 1 });
      case 'birth2':     return drawInfectedBossBody(put, { pockets: 2, phase: 2 });
      case 'birth3':     return drawInfectedBossBody(put, { pockets: 3, phase: 3 });
      case 'birth4':     return drawInfectedBossBody(put, { pockets: 4, phase: 0 });
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
  phase?: number;      // 0-3 flame flicker phase
  armSway?: number;    // -1 (slam) … 1 (claws raised)
  flare?: number;      // 0 (calm) … 2 (full dash-windup inferno)
  armsOverhead?: boolean; // windup pose: arms thrown high, talons to the sky
}

export function drawWendigoBody(rawPut: Put, opts: WendigoOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const ph = opts.phase ?? 0;
  const armSway = opts.armSway ?? 0;
  const flash = opts.flash ?? false;
  const chargeGlow = opts.chargeGlow ?? false;

  const bone  = flash ? P.white : P.wBone;
  const boneD = flash ? P.white : P.wBoneD;
  const boneL = flash ? P.white : P.wBoneL;
  const out   = flash ? P.white : P.outline;
  // green-flame ramp
  const fD = flash ? P.white : P.gfireD;
  const fG = flash ? P.white : P.gfire;
  const fL = flash ? P.white : P.gfireL;
  const fC = flash ? P.white : P.gfireC;
  const eyeCol = chargeGlow ? P.gfireC : flash ? P.white : P.entEye;
  const eyeHL  = chargeGlow ? P.white : flash ? P.white : '#b0ffb0';

  // Record SKELETON pixels for a crisp outline; the flames stay unrecorded
  // so they read as soft light rather than an inked shape.
  const px = new Set<number>();
  const put: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    px.add(y * 64 + x);
    rawPut(x, y, c);
  };
  const pf: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    rawPut(x, y, c);
  };

  // Layout anchors. The figure sits low enough that the full antler rack
  // (top tine at hy-12) stays on-canvas even at bob -2.
  const hy = 15 + bob;       // skull centre
  const ty = hy + 11;        // top of the ribcage

  // Ground glow — embers of green fire pooling at the base
  for (let dx = -16; dx <= 16; dx++)
    for (let dy = -1; dy <= 1; dy++)
      if ((dx * dx) / 256 + (dy * dy) / 2 <= 1) pf(cx + dx, 58 + dy, fD);
  pf(cx - 12 + ph * 2, 57, fG);
  pf(cx + 13 - ph * 3, 57, fG);

  // ---- gnarled trunk core rising from the ground into the pelvis ----
  for (let y = ty + 14; y <= 57; y++) {
    const wob = Math.round(Math.sin(y * 0.35) * 2);
    rect(put, cx - 2 + wob, y, 5, 1, y % 5 === 0 ? boneD : bone);
    if (y % 7 === 3) put(cx + wob, y, boneD); // bark crack
  }

  // ---- ANIMATED GREEN FLAME PYRE (lower body) ----
  // Each column is a flame tongue whose height breathes with the phase; the
  // side tongues climb past the pelvis so the fire visibly engulfs the hips.
  // `flare` (dash windup) surges the pyre: taller, wider, hotter — at full
  // flare a wall of fire towers up behind the skeleton.
  const flare = opts.flare ?? (chargeGlow ? 0.6 : 0);
  const heatBoost = flare * 0.1 + (chargeGlow ? 0.06 : 0);
  for (let x = -12; x <= 12; x++) {
    const ax = Math.abs(x);
    const base = 30 + flare * 6 - ax * (1.9 - flare * 0.3);
    const lick = Math.sin(x * 1.9 + ph * (Math.PI / 2)) * 4
               + Math.sin(x * 0.7 - ph * (Math.PI / 4)) * 2;
    const h = Math.round(base + lick);
    if (h < 3) continue;
    for (let i = 0; i < h; i++) {
      const y = 58 - i;
      const t = i / h;
      if (t > 0.72 && (x + y + ph) % 3 === 0) continue; // ragged flickering tips
      const heat = (1 - ax / 11) * (1 - t * 0.8) + heatBoost;
      pf(cx + x, y, heat > 0.55 ? fC : heat > 0.38 ? fL : heat > 0.2 ? fG : fD);
    }
  }
  // white-hot core writhing up the middle (taller while flaring)
  for (let i = 0; i < 13 + Math.round(flare * 5); i++)
    pf(cx + Math.round(Math.sin(i * 0.8 + ph * 1.3) * 1.5), 56 - i, i < 7 ? fC : fL);
  // detached sparks drifting upward (the whole swarm rises during a flare)
  const sparks: ReadonlyArray<readonly [number, number]> = [[-9, 33], [7, 29], [-5, 25], [10, 36], [3, 22]];
  for (let k = 0; k < sparks.length; k++) {
    if (flare < 1 && (k + ph) % 3 === 0) continue;
    const [sx, sy] = sparks[k];
    pf(cx + sx, sy - ((ph * 2 + k * 3) % 6) - Math.round(flare * 4), k % 2 === 0 ? fL : fG);
  }
  // windup only: embers spiraling high around the whole body
  if (flare >= 1) {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + ph * 0.9;
      pf(Math.round(cx + Math.cos(ang) * (13 + (k % 2) * 3)),
         Math.round(34 + bob + Math.sin(ang) * 12), k % 2 === 0 ? fL : fG);
    }
  }

  // ---- torso: hollow chest cavity behind the ribs ----
  ellipse(put, cx, ty + 6, 7, 8, flash ? P.white : '#101a10');
  // green fire glowing inside the cavity
  pf(cx, ty + 5, fG);
  pf(cx - 1, ty + 7, fD);
  pf(cx + 1, ty + 8, fG);
  pf(cx, ty + 9, chargeGlow ? fC : fD);

  // ---- spine + bulky ribcage ----
  for (let y = -3; y <= 12; y++) {
    put(cx, ty + y, y % 2 === 0 ? bone : boneD); // vertebrae
    if (y % 3 === 0) { put(cx - 1, ty + y, boneD); put(cx + 1, ty + y, boneD); } // side nubs
  }
  for (let r = 0; r < 4; r++) {
    const ribY = ty + 1 + r * 3;
    const halfW = 9 - r;
    for (let x = 1; x <= halfW; x++) {
      const drop = Math.round((x / halfW) * (x / halfW) * 3); // ribs curve down hard
      const c = x >= halfW - 1 ? boneD : bone;
      put(cx - x, ribY + drop, c);
      put(cx + x, ribY + drop, c);
      if (r < 2) { // upper ribs are thick
        put(cx - x, ribY + drop + 1, boneD);
        put(cx + x, ribY + drop + 1, boneD);
      }
    }
    put(cx - halfW, ribY + 4, boneD); // hooked rib tips
    put(cx + halfW, ribY + 4, boneD);
    put(cx, ribY, boneL);             // sternum highlight
  }
  // green glow leaking between the upper ribs
  pf(cx - 2, ty + 2, fD);
  pf(cx + 2, ty + 5, fD);
  // pelvis plate fusing the spine into the trunk — no floating torso
  rect(put, cx - 3, ty + 12, 7, 2, boneD);
  put(cx - 4, ty + 13, bone);
  put(cx + 4, ty + 13, bone);
  put(cx, ty + 12, bone);

  // ---- shoulders: heavy bone masses with tall spike crowns ----
  for (const s of [-1, 1] as const) {
    disc(put, cx + s * 10, ty, 4, bone);
    disc(put, cx + s * 10, ty - 1, 2, boneL);
    put(cx + s * 7, ty + 2, boneD);
    // pauldron spikes — jagged, varied heights
    for (let k = 0; k < 4; k++) {
      const sx2 = cx + s * (7 + k * 2);
      const tall = [4, 6, 5, 3][k];
      for (let j = 0; j < tall; j++)
        put(sx2 + (j > 2 ? s : 0), ty - 3 - j, j === tall - 1 ? boneL : j > 1 ? bone : boneD);
    }
  }

  // ---- arms: thick reaching bones ending in hooked talons ----
  // armsOverhead (dash windup) throws the arms high above the shoulders
  // with the talons raking the sky; otherwise armSway tilts the reach.
  const armUp = Math.round(armSway * 3);
  const overhead = !!opts.armsOverhead;
  for (const s of [-1, 1] as const) {
    const shX = cx + s * 11, shY = ty + 1;
    const elX = overhead ? cx + s * 15 : cx + s * 18;
    const elY = overhead ? ty - 5 : ty + 2 - armUp;
    const wrX = overhead ? cx + s * 18 : cx + s * 24;
    const wrY = overhead ? ty - 11 : ty + 5 - armUp * 2;
    // upper arm (3px thick — this thing is strong)
    line(put, shX, shY - 1, elX, elY - 1, boneL);
    line(put, shX, shY, elX, elY, bone);
    line(put, shX, shY + 1, elX, elY + 1, boneD);
    // forearm
    line(put, elX, elY - 1, wrX, wrY - 1, boneL);
    line(put, elX, elY, wrX, wrY, bone);
    line(put, elX, elY + 1, wrX, wrY + 1, boneD);
    if (!overhead) { // jagged elbow spur
      put(elX, elY - 2, bone);
      put(elX - s, elY - 3, boneL);
    }
    // bony palm
    disc(put, wrX, wrY + (overhead ? -1 : 1), 2, bone);
    put(wrX, wrY + (overhead ? -2 : 0), boneL);
    // three huge talons hooking from the palm — downward normally,
    // skyward in the overhead windup pose
    const dir = overhead ? -1 : 1;
    const TALON: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
      [[0, 1], [1, 1], [1, 2], [2, 3], [2, 4], [1, 5]],          // outer hook
      [[0, 2], [1, 2], [1, 3], [1, 4], [2, 5], [2, 6], [1, 7]],  // long middle talon
      [[-1, 2], [-1, 3], [0, 4], [0, 5], [-1, 6]],               // inner hook
    ];
    for (let k = 0; k < TALON.length; k++) {
      const path = TALON[k];
      const bx = wrX + s * (k * 2 - 2);
      for (let j = 0; j < path.length; j++) {
        const [dx2, dy2] = path[j];
        put(bx + s * dx2, wrY + dir * (1 + dy2), j === path.length - 1 ? boneL : j < 2 ? boneD : bone);
      }
    }
  }

  // ---- flame tongues licking up over the lower ribs (drawn over the bone) ----
  for (const s of [-1, 1] as const) {
    const lx2 = cx + s * (3 + (ph % 2));
    const tall = 6 + Math.round(flare * 3);
    for (let j = 0; j < tall; j++)
      pf(lx2 + Math.round(Math.sin(j * 0.9 + ph) * 1.5), ty + 13 - j, j > tall - 3 ? fG : j > 1 ? fL : fC);
  }
  // windup: fire crawls up the raised arms toward the claws
  if (flare >= 1) {
    for (const s of [-1, 1] as const) {
      const wrX = overhead ? cx + s * 18 : cx + s * 24;
      const wrY = overhead ? ty - 11 : ty + 5 - armUp * 2;
      pf(wrX - s, wrY - 2, fL);
      pf(wrX + s, wrY - 3 + (ph % 2), fG);
      pf(wrX, wrY - 4 + ((ph + 1) % 2), fD);
      pf(overhead ? cx + s * 14 : cx + s * 17, overhead ? ty - 3 : ty + 1 - armUp, fG);
    }
  }

  // ---- skull: heavy-browed deer skull, jaw agape ----
  disc(put, cx, hy, 5, bone);
  disc(put, cx, hy - 2, 3, boneL);         // crown dome
  rect(put, cx - 5, hy - 1, 11, 2, boneD); // massive brow ridge
  // crown spikes between the antlers
  put(cx, hy - 6, bone); put(cx, hy - 7, boneL);
  put(cx - 2, hy - 6, boneD);
  put(cx + 2, hy - 6, boneD);
  // jutting cheekbones
  put(cx - 6, hy + 2, boneL); put(cx - 6, hy + 3, boneD);
  put(cx + 6, hy + 2, boneL); put(cx + 6, hy + 3, boneD);
  // muzzle tapering down
  rect(put, cx - 2, hy + 3, 5, 3, bone);
  rect(put, cx - 1, hy + 6, 3, 2, boneL);
  put(cx + 2, hy + 6, out);                // nostril
  // eyes — green fire burning deep in shadowed sockets
  for (const s of [-1, 1] as const) {
    disc(put, cx + s * 3, hy + 1, 2, out);
    put(cx + s * 3, hy + 1, eyeCol);
    put(cx + s * 3 + s, hy + 1, eyeHL);
    pf(cx + s * 3, hy, chargeGlow ? P.gfireL : P.entEyeD);     // glow licking up
    pf(cx + s * 3, hy + 3, flash ? P.white : P.entEyeD);       // ember falling below
  }
  // snarling maw — jagged fangs over a green-lit gullet
  for (let x = -2; x <= 2; x++) put(cx + x, hy + 8, x % 2 === 0 ? boneL : boneD);
  put(cx - 2, hy + 9, P.white);            // long fangs
  put(cx + 2, hy + 9, P.white);
  pf(cx, hy + 9, fG);                      // firelight in the mouth
  pf(cx - 1, hy + 9, fD);
  rect(put, cx - 2, hy + 10, 5, 1, boneD); // hanging lower jaw
  put(cx - 1, hy + 10, bone);
  put(cx + 1, hy + 10, bone);

  // ---- antlers: heavy jagged rack + lateral horns (max reach hy-12) ----
  for (const s of [-1, 1] as const) {
    // thick main beam sweeping up and out
    line(put, cx + s * 4, hy - 5, cx + s * 9, hy - 10, bone);
    line(put, cx + s * 5, hy - 5, cx + s * 10, hy - 10, bone);
    line(put, cx + s * 5, hy - 4, cx + s * 10, hy - 9, boneD);
    line(put, cx + s * 10, hy - 10, cx + s * 13, hy - 11, bone);
    line(put, cx + s * 10, hy - 9, cx + s * 13, hy - 10, boneD);
    // jagged tines off the beam (kept at/above hy-12 so nothing clips)
    for (const [tx2, ty2, tl] of [[6, -7, 3], [8, -9, 3], [11, -10, 2], [13, -11, 1]] as const) {
      const bx = cx + s * tx2, by = hy + ty2;
      for (let j = 0; j < tl; j++) put(bx + (j > 1 ? s : 0), by - j, j === tl - 1 ? boneL : bone);
    }
    // brow tine hooking forward over the eye
    put(cx + s * 5, hy - 3, bone);
    put(cx + s * 6, hy - 2, boneL);
    // lateral horn jutting sideways from the skull
    line(put, cx + s * 5, hy, cx + s * 11, hy - 2, bone);
    line(put, cx + s * 5, hy + 1, cx + s * 11, hy - 1, boneD);
    put(cx + s * 12, hy - 3, boneL);       // tip
  }
  // spectral shimmer drifting through the rack
  if (!flash) {
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + ph * 0.8;
      pf(Math.round(cx + Math.cos(ang) * 12), Math.round(hy - 7 + Math.sin(ang) * 4), P.wGhostB);
    }
  }

  // ---- birth pockets — fire-wreathed bulges on the torso ----
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [[-5, ty + 4], [0, ty + 2], [5, ty + 4]];
    for (const [dx2, oy] of pockets) {
      const ox = cx + dx2;
      if (stage === 0) {
        disc(put, ox, oy, 3, fD);
        disc(put, ox, oy, 2, fG);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, fD);
        disc(put, ox, oy, 2, out);
        put(ox, oy, P.entEye);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, fD);
        disc(put, ox, oy, 2, P.wolfM);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, fD);
        disc(put, ox, oy - 1, 3, P.wolfM);
        disc(put, ox, oy - 2, 2, P.wolf);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, out);
        disc(put, ox, oy, 2, fD);
      }
    }
  }

  // Crisp 1px outline around the skeleton only — flames stay soft
  strokeOutline(px, rawPut, 64);
}

export type ForestBossFrame =
  | 'idle0' | 'idle1' | 'idle2' | 'idle3'
  | 'move0' | 'move1' | 'move2' | 'move3'
  | 'atk0' | 'atk1'
  | 'chargeWind0' | 'chargeWind1' | 'chargeWind2' | 'chargeWind3' | 'chargeWind4' | 'chargeWind5'
  | 'hit'
  | 'birth0' | 'birth1' | 'birth2' | 'birth3' | 'birth4'
  | 'die0' | 'die1' | 'die2' | 'die3' | 'die4';

export const forestBossFrames: ForestBossFrame[] = [
  'idle0','idle1','idle2','idle3',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind0','chargeWind1','chargeWind2','chargeWind3','chargeWind4','chargeWind5','hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

export function drawForestBoss(frame: ForestBossFrame) {
  return (put: Put) => {
    switch (frame) {
      // 4 idle frames cycle the full flame flicker
      case 'idle0':      return drawWendigoBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawWendigoBody(put, { bob: -1, phase: 1 });
      case 'idle2':      return drawWendigoBody(put, { bob: -2, phase: 2 });
      case 'idle3':      return drawWendigoBody(put, { bob: -1, phase: 3 });
      case 'move0':      return drawWendigoBody(put, { bob: 0, phase: 0, armSway: 0.5 });
      case 'move1':      return drawWendigoBody(put, { bob: -1, phase: 1, armSway: 0 });
      case 'move2':      return drawWendigoBody(put, { bob: -2, phase: 2, armSway: -0.5 });
      case 'move3':      return drawWendigoBody(put, { bob: -1, phase: 3, armSway: 0 });
      case 'atk0':       return drawWendigoBody(put, { bob: -2, armSway: 1, phase: 0 });   // claws raised
      case 'atk1':       return drawWendigoBody(put, { bob: 2, armSway: -1, phase: 2 });   // slam
      // dash windup: ONE arm raise (out → overhead), then the arms stay
      // locked skyward while only the flames pulse (cw2-5 cycle the phase)
      case 'chargeWind0': return drawWendigoBody(put, { chargeGlow: true, armSway: 1, flare: 0.6, phase: 0, bob: -1 });
      case 'chargeWind1': return drawWendigoBody(put, { chargeGlow: true, armsOverhead: true, flare: 1.2, phase: 1, bob: -2 });
      case 'chargeWind2': return drawWendigoBody(put, { chargeGlow: true, armsOverhead: true, flare: 2, phase: 0, bob: -2 });
      case 'chargeWind3': return drawWendigoBody(put, { chargeGlow: true, armsOverhead: true, flare: 2, phase: 1, bob: -2 });
      case 'chargeWind4': return drawWendigoBody(put, { chargeGlow: true, armsOverhead: true, flare: 2, phase: 2, bob: -2 });
      case 'chargeWind5': return drawWendigoBody(put, { chargeGlow: true, armsOverhead: true, flare: 2, phase: 3, bob: -2 });
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
  phase?: number;             // 0-3 hair/gown flow phase
  cast?: 'raise' | 'release'; // orb-cast gesture (atk0 / atk1)
}

export function drawPhantomQueenBody(rawPut: Put, opts: PhantomQueenOpts) {
  const cx = 32;
  const bob = opts.bob ?? 0;
  const ph = opts.phase ?? 0;
  const flash = opts.flash ?? false;
  const chargeGlow = opts.chargeGlow ?? false;
  const cast = opts.cast;

  // ghost-blue ramp
  const qD = flash ? P.white : P.queenD;
  const q  = flash ? P.white : P.queen;
  const qM = flash ? P.white : P.queenM;
  const qL = flash ? P.white : P.queenL;
  const skin = flash ? P.white : P.queenP;   // pale spectral skin
  const skinL = flash ? P.white : '#d8ecff'; // cheek/shoulder highlight
  const lipD = flash ? P.white : '#34308e';  // full dark-blue lips
  const lipL = flash ? P.white : '#8a86d8';
  // regalia
  const sv  = flash ? P.white : P.silver;
  const svD = flash ? P.white : P.silverD;
  const svL = flash ? P.white : P.silverL;
  const gem = flash ? P.white : P.fogGlow;
  const out = flash ? P.white : P.outline;

  // Record the body for a crisp outline; spectral glows stay unrecorded.
  const px = new Set<number>();
  const put: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    px.add(y * 64 + x);
    rawPut(x, y, c);
  };
  const pf: Put = (x, y, c) => {
    if (c == null || x < 0 || y < 0 || x >= 64 || y >= 64) return;
    rawPut(x, y, c);
  };

  // Flowing strand renderer — hair and gown share it. Each strand drifts
  // along (dxStep, dyStep) while a phase-driven wave ripples down it.
  const strand = (x0: number, y0: number, dxStep: number, dyStep: number,
                  len: number, k: number, cMain: string, cHi: string) => {
    for (let j = 0; j < len; j++) {
      const t = j / len;
      const x = x0 + Math.round(dxStep * j + Math.sin(j * 0.5 + ph * (Math.PI / 2) + k) * (1 + t * 2.2));
      const y = y0 + Math.round(dyStep * j);
      if (t > 0.78 && (x + y + ph) % 3 === 0) continue; // wispy ragged tips
      put(x, y, cMain);
      put(x, y - 1, cHi);
      if (t < 0.6) put(x, y + 1, qD);
    }
  };

  // ---- WILD HAIR: a mane streaming back-left, rippling with the phase ----
  // (drawn first so the face/crown sit on top of it)
  strand(cx + 2, 10 + bob, -1.3, 0.9, 15, 0, q, qL);
  strand(cx + 1, 13 + bob, -1.5, 0.7, 16, 1.4, qM, q);
  strand(cx, 16 + bob, -1.4, 0.9, 14, 2.8, q, qL);
  strand(cx - 1, 20 + bob, -1.2, 1.0, 12, 4.2, qM, q);
  strand(cx + 3, 8 + bob, -1.0, 1.2, 12, 5.6, qD, qM);
  // loose wisps curling off the mane (unrecorded — half-faded)
  pf(cx - 17, 18 + bob + (ph % 2), qM);
  pf(cx - 19, 23 + bob - (ph % 2), qD);
  pf(cx - 16, 29 + bob + (ph % 2), qD);

  // ---- GOWN: the lower body dissolves into flowing mist tendrils ----
  const waistY = 35 + bob;
  // gown core fanning out from the waist
  for (let y = waistY; y <= 52 + bob; y++) {
    const t = (y - waistY) / 17;
    const halfW = Math.round(4 + t * 7);
    const sway = Math.round(Math.sin(t * 4 + ph * (Math.PI / 2)) * 2 - t * 3); // drifts left
    for (let dx = -halfW; dx <= halfW; dx++) {
      const edge = Math.abs(dx) / halfW;
      if (edge > 0.7 && (dx + y + ph) % 3 === 0) continue;
      const band = (((dx * 3 + y * 2) % 7) + 7) % 7;
      put(cx + 1 + sway + dx, y, edge > 0.85 ? qD : band < 2 ? qL : band < 4 ? q : qM);
    }
  }
  // long trailing tendrils whipping off the hem
  strand(cx - 4, 48 + bob, -1.1, 0.55, 14, 1, q, qL);
  strand(cx + 2, 50 + bob, -0.7, 0.45, 13, 3, qM, q);
  strand(cx + 6, 47 + bob, 0.5, 0.6, 10, 5, qM, q);
  // stray mist wisps drifting off the train
  pf(cx - 15, 53 + bob - (ph % 3), qD);
  pf(cx - 10, 56 + bob - (ph % 2), qM);
  pf(cx + 11, 54 + bob + (ph % 2), qD);

  // ---- BODICE: fitted, silver-trimmed ----
  const ty = 22 + bob;
  // torso core
  rect(put, cx - 1, ty, 7, 6, q);
  rect(put, cx - 2, ty + 6, 9, 4, q);
  rect(put, cx - 2, ty + 10, 8, 3, qM);     // hip wrap into the gown
  // bust arcs with highlight
  disc(put, cx + 1, ty + 3, 2, qL);
  disc(put, cx + 4, ty + 3, 2, qL);
  put(cx + 1, ty + 2, skin);
  put(cx + 4, ty + 2, skin);
  // silver bodice trim — centre seam + under-bust curve + hip V
  for (let y = ty + 1; y <= ty + 11; y++) put(cx + 2, y, y % 3 === 0 ? sv : svD);
  put(cx, ty + 5, svD); put(cx + 1, ty + 5, sv);
  put(cx + 3, ty + 5, sv); put(cx + 4, ty + 5, svD);
  put(cx, ty + 10, svD); put(cx + 4, ty + 10, svD);
  put(cx + 1, ty + 11, sv); put(cx + 3, ty + 11, sv);
  // chest gem + belt gem, glowing
  put(cx + 2, ty + 4, gem);
  pf(cx + 2, ty + 3, flash ? P.white : '#b8e4ff');
  put(cx + 2, ty + 12, gem);
  put(cx + 1, ty + 12, svD); put(cx + 3, ty + 12, svD);
  if (chargeGlow || cast) {                 // regalia flares when casting
    pf(cx + 5, ty + 4, gem);
    pf(cx - 1, ty + 4, gem);
    pf(cx + 2, ty + 14, gem);
  }

  // ---- PAULDRON: angular silver plate on the leading shoulder ----
  rect(put, cx + 6, ty - 1, 5, 2, sv);
  rect(put, cx + 7, ty + 1, 4, 2, svD);
  put(cx + 11, ty, svL);                    // upswept point
  put(cx + 12, ty - 1, svL);
  put(cx + 8, ty, gem);                     // shoulder gem

  // ---- ARMS: graceful and pale, jewelled, ending in elegant claws ----
  // leading (right) arm — hangs reaching, rises overhead to cast
  {
    const raisedArm = cast === 'raise';
    const released = cast === 'release';
    const shX2 = cx + 9, shY2 = ty + 2;
    const elX = raisedArm ? cx + 13 : released ? cx + 14 : cx + 13;
    const elY = raisedArm ? ty - 3 : released ? ty + 4 : ty + 6;
    const wrX = raisedArm ? cx + 15 : released ? cx + 19 : cx + 17;
    const wrY = raisedArm ? ty - 8 : released ? ty + 3 : ty + 10;
    // upper arm — rounded shoulder light, skin core, soft shadow
    line(put, shX2, shY2 - 1, elX, elY - 1, skinL);
    line(put, shX2, shY2, elX, elY, skin);
    line(put, shX2, shY2 + 1, elX, elY + 1, qM);
    // silver armlet around the bicep
    const amX = Math.round((shX2 + elX) / 2), amY = Math.round((shY2 + elY) / 2);
    put(amX, amY - 1, svL);
    put(amX, amY, sv);
    put(amX, amY + 1, svD);
    // pointed elbow
    put(elX, elY, skinL);
    // forearm tapering to a fine wrist (2px)
    line(put, elX, elY, wrX, wrY, skin);
    line(put, elX, elY + 1, wrX, wrY + 1, qM);
    // silver bracelet at the wrist
    put(wrX - 1, wrY, sv);
    put(wrX - 1, wrY + 1, svD);
    // slim palm + four long curved fingers with bright nail tips
    put(wrX + 1, wrY, skin);
    const fdir = raisedArm ? -1 : 1;
    for (let k = 0; k < 4; k++) {
      const len = 5 - (k === 0 || k === 3 ? 1 : 0);
      for (let j = 1; j <= len; j++) {
        const curve = j > 2 ? 1 : 0; // fingers arc inward
        put(wrX + k - 1 + curve, wrY + fdir * j,
            j === len ? svL : j === 1 ? qM : skin); // knuckle shade → nail glint
      }
    }
    // orb gathering above the raised hand / streaking off the release
    if (raisedArm) {
      disc(pf, wrX + 1, wrY - 6, 2, gem);
      pf(wrX + 1, wrY - 6, P.white);
      pf(wrX - 1, wrY - 4 + (ph % 2), flash ? P.white : '#b8e4ff');
    } else if (released) {
      pf(wrX + 3, wrY + 1, gem);
      pf(wrX + 5, wrY, flash ? P.white : '#b8e4ff');
      pf(wrX + 7, wrY - 1, gem);
    }
  }
  // trailing (left) arm — half-lost in the hair, same elegance
  line(put, cx - 2, ty + 3, cx - 6, ty + 9, skinL);
  line(put, cx - 2, ty + 4, cx - 6, ty + 10, skin);
  line(put, cx - 2, ty + 5, cx - 6, ty + 11, qM);
  put(cx - 4, ty + 7, sv);                     // armlet glint through the hair
  put(cx - 6, ty + 11, svD);                   // bracelet
  for (let k = 0; k < 3; k++)
    for (let j = 1; j <= 4; j++)
      put(cx - 7 + k + (j > 2 ? -1 : 0), ty + 11 + j, j === 4 ? svL : j === 1 ? qM : skin);

  // ---- HEAD: regal three-quarter face framed by the mane ----
  const hyy = 14 + bob;
  // hair mass behind and above the head
  disc(put, cx + 3, hyy - 1, 6, q);
  disc(put, cx + 2, hyy - 2, 5, qM);
  // face — smooth pale oval tapering to a pointed chin
  disc(put, cx + 4, hyy, 4, skin);
  put(cx + 4, hyy + 4, skin);                // pointed chin
  put(cx + 3, hyy + 4, qM);                  // jaw shadow
  put(cx + 1, hyy + 2, qM);                  // jaw contour both sides
  put(cx + 7, hyy + 2, qM);
  // hair parts around the face — a strand falls past each temple
  rect(put, cx, hyy - 3, 1, 5, q);
  put(cx + 8, hyy - 2, q);
  put(cx + 8, hyy - 1, qM);
  put(cx + 4, hyy - 4, qD);                  // centre part
  // arched brows
  put(cx + 2, hyy - 2, qD); put(cx + 3, hyy - 2, qD);
  put(cx + 5, hyy - 2, qD); put(cx + 6, hyy - 2, qD);
  // half-lidded glowing eyes with dark lash corners
  put(cx + 2, hyy - 1, chargeGlow ? P.white : gem);
  put(cx + 3, hyy - 1, qD);
  put(cx + 5, hyy - 1, chargeGlow ? P.white : gem);
  put(cx + 6, hyy - 1, qD);
  // delicate nose — bridge light over a tiny shadow
  put(cx + 4, hyy, skinL);
  put(cx + 4, hyy + 1, qM);
  // full pouting lips
  put(cx + 3, hyy + 2, lipL);
  put(cx + 4, hyy + 2, lipD);
  put(cx + 5, hyy + 2, lipL);
  put(cx + 4, hyy + 3, lipL);                // lower-lip sheen
  // cheekbone highlights + a beauty mark
  put(cx + 2, hyy + 1, skinL);
  put(cx + 6, hyy + 1, skinL);
  put(cx + 6, hyy + 2, qD);
  // ear with a dangling gem earring
  put(cx + 1, hyy, skin);
  put(cx + 1, hyy + 1, gem);
  // slender neck with collarbones into the décolleté
  rect(put, cx + 3, hyy + 5, 2, 3, skin);
  put(cx + 4, hyy + 6, qM);                  // neck shadow
  put(cx + 2, hyy + 8, qM);                  // collarbones
  put(cx + 5, hyy + 8, qM);
  rect(put, cx + 2, hyy + 8, 4, 1, skin);    // open chest above the bodice
  put(cx + 3, hyy + 8, skinL);

  // ---- CROWN: spiked silver tiara seated on the mane ----
  const cy2 = hyy - 6;
  rect(put, cx, cy2, 9, 2, sv);              // band
  put(cx, cy2 + 1, svD);
  put(cx + 8, cy2 + 1, svD);
  // five spikes, tall centre
  for (const [sx2, tall] of [[0, 2], [2, 3], [4, 5], [6, 3], [8, 2]] as const) {
    for (let j = 1; j <= tall; j++)
      put(cx + sx2, cy2 - j, j === tall ? svL : sv);
  }
  // gems set between the spikes
  put(cx + 1, cy2, gem);
  put(cx + 4, cy2 - 1, gem);
  put(cx + 7, cy2, gem);
  if (chargeGlow) pf(cx + 4, cy2 - 6, P.white); // crown flare

  // spectral motes drifting around her
  const motes: ReadonlyArray<readonly [number, number]> = [[-12, 14], [10, 20], [-8, 40], [13, 36], [-14, 30]];
  for (let k = 0; k < motes.length; k++) {
    if ((k + ph) % 3 === 0) continue;
    const [mx, myy] = motes[k];
    pf(cx + mx, myy + bob - ((ph + k) % 4), k % 2 === 0 ? gem : qL);
  }

  // ---- birth pockets — spectral bulges swelling in the gown ----
  if (opts.pockets !== undefined) {
    const stage = opts.pockets;
    const pockets: Array<[number, number]> = [[-4, 42 + bob], [1, 46 + bob], [6, 42 + bob]];
    for (const [dx2, oy] of pockets) {
      const ox = cx + dx2;
      if (stage === 0) {
        disc(put, ox, oy, 3, qL);
        disc(put, ox, oy, 2, q);
      } else if (stage === 1) {
        disc(put, ox, oy, 3, qL);
        disc(put, ox, oy, 2, out);
        put(ox, oy, P.fogGlow);
      } else if (stage === 2) {
        disc(put, ox, oy, 3, qL);
        disc(put, ox, oy, 2, qM);
        put(ox - 1, oy, P.white);
        put(ox + 1, oy, P.white);
      } else if (stage === 3) {
        disc(put, ox, oy - 1, 4, qD);
        disc(put, ox, oy - 1, 3, qM);
        disc(put, ox, oy - 2, 2, q);
        put(ox - 1, oy - 1, P.white);
        put(ox + 1, oy - 1, P.white);
      } else if (stage === 4) {
        disc(put, ox, oy, 3, out);
        disc(put, ox, oy, 2, qD);
      }
    }
  }

  // Crisp 1px outline — the glows and stray wisps stay soft
  strokeOutline(px, rawPut, 64);
}

export function drawPhantomQueenDie(put: Put, step: number) {
  const cx = 32, cy = 30;
  const r = Math.max(0, 16 - step * 3);
  if (r > 0) {
    disc(put, cx, cy, r, P.queenD);
    disc(put, cx, cy, Math.max(0, r - 1), P.queen);
    disc(put, cx, cy, Math.max(0, r - 3), P.queenL);
  }
  // gown shreds + crown shards scattering
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + step * 0.3;
    const d = step * 5 + 5;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    put(x, y, P.queenM);
    put(x + 1, y, i % 3 === 0 ? P.silver : P.queenD);
    if (i % 4 === 0) put(x, y + 1, P.fogGlow);
  }
  if (step < 2) disc(put, cx, cy, 6, P.white);
}

/** Queen frame set — shared BossFrame plus two extra idle frames so her hair
 *  and gown flow constantly. No windup frames: castle bosses never dash. */
export type PhantomQueenFrame = BossFrame | 'idle2' | 'idle3';

export const phantomQueenFrames: PhantomQueenFrame[] = [
  'idle0','idle1','idle2','idle3',
  'move0','move1','move2','move3',
  'atk0','atk1',
  'chargeWind','hit',
  'birth0','birth1','birth2','birth3','birth4',
  'die0','die1','die2','die3','die4'
];

export function drawPhantomQueen(frame: PhantomQueenFrame) {
  return (put: Put) => {
    switch (frame) {
      // 4 idle frames keep the hair + gown rippling
      case 'idle0':      return drawPhantomQueenBody(put, { bob: 0, phase: 0 });
      case 'idle1':      return drawPhantomQueenBody(put, { bob: -1, phase: 1 });
      case 'idle2':      return drawPhantomQueenBody(put, { bob: -2, phase: 2 });
      case 'idle3':      return drawPhantomQueenBody(put, { bob: -1, phase: 3 });
      case 'move0':      return drawPhantomQueenBody(put, { bob: 0, phase: 0 });
      case 'move1':      return drawPhantomQueenBody(put, { bob: -1, phase: 1 });
      case 'move2':      return drawPhantomQueenBody(put, { bob: -2, phase: 2 });
      case 'move3':      return drawPhantomQueenBody(put, { bob: -1, phase: 3 });
      // orb cast: hand sweeps overhead gathering the orb, then hurls it
      case 'atk0':       return drawPhantomQueenBody(put, { cast: 'raise', bob: -1, phase: 1 });
      case 'atk1':       return drawPhantomQueenBody(put, { cast: 'release', bob: 1, phase: 3 });
      // legacy frame from the shared set — castle bosses never dash, so this
      // is just a glowing stance (kept registered for safety)
      case 'chargeWind': return drawPhantomQueenBody(put, { chargeGlow: true, bob: -1, phase: 1 });
      case 'hit':        return drawPhantomQueenBody(put, { flash: true });
      case 'birth0':     return drawPhantomQueenBody(put, { pockets: 0, phase: 0 });
      case 'birth1':     return drawPhantomQueenBody(put, { pockets: 1, phase: 1 });
      case 'birth2':     return drawPhantomQueenBody(put, { pockets: 2, phase: 2 });
      case 'birth3':     return drawPhantomQueenBody(put, { pockets: 3, phase: 3 });
      case 'birth4':     return drawPhantomQueenBody(put, { pockets: 4, phase: 0 });
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
