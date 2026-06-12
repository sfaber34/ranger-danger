// All enemy art lives here: ground enemies, flying enemies, castle enemies, and
// the projectile/poop fx that come from them. Bear is in bear.ts (its own palette
// and frame schema), bosses are in bosses.ts.

import { Put, P, mirrorX, strokeOutline, rect, disc, ring, line, ellipse } from './canvas';

export type EFrame = 'move0'|'move1'|'move2'|'move3'|'atk0'|'atk1'|'hit'|'die0'|'die1'|'die2'|'die3';

/** Extended frame set for the meadow enemies (snake/rat/deer) — 6-frame move
 *  cycles and 4-frame attacks for smoother animation. */
export type EFrame6 = EFrame | 'move4' | 'move5' | 'atk2' | 'atk3';

export function drawEnemyBasic(f: EFrame) {
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
export function drawEnemyHeavy(f: EFrame) {
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
//  SNAKE (32x32) — slithering viper, meadow basic enemy
// ==================================================================
export function drawEnemySnake(f: EFrame6, tongue = false) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 6 - step * 1.5;
      if (r <= 0) return;
      disc(rawPut, 16, 22, Math.max(0, Math.round(r)), P.snake);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        const x = Math.round(16 + Math.cos(a) * d), y = Math.round(22 + Math.sin(a) * d);
        rawPut(x, y, P.snakeD);
        rawPut(x + 1, y, i % 2 === 0 ? P.snakeBelly : P.snakePat);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    // Record body pixels for the silhouette outline (matches the ranger look)
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const body = flash ? P.white : P.snake;
    const bodyD = flash ? P.white : P.snakeD;
    const bodyL = flash ? P.white : P.snakeL;
    const belly = flash ? P.white : P.snakeBelly;
    const pat = flash ? P.white : P.snakePat;

    // 6-phase slither; attacks map onto a strike lunge
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const phase = mi >= 0 ? mi : ai >= 0 ? [0, 1, 2, 1][ai] : 0;
    const lunge = ai >= 0 ? [0, 1, 3, 2][ai] : 0; // head thrust toward prey
    const cy = 22;

    // --- continuous sinusoidal body, tail tip (x=27) to neck (x=8) ---
    // The wave travels backwards as phase advances, so the slither reads as
    // pushing the snake forward.
    const yAt = (x: number) => cy + Math.round(Math.sin(x * 0.55 - phase * (Math.PI / 3)) * 1.8);
    for (let x = 27; x >= 8; x--) {
      const th = x >= 25 ? 1 : x >= 21 ? 2 : x >= 13 ? 4 : 3; // taper: tail → thick mid → neck
      const y = yAt(x);
      const top = y - (th >> 1);
      for (let i = 0; i < th; i++) {
        const c = i === 0 && th >= 3 ? bodyL : i === th - 1 && th >= 2 ? belly : body;
        put(x, top + i, c);
      }
      // diamond back pattern — scrolls along the body with the wave
      if ((x + phase) % 4 < 2 && th >= 3) put(x, top, pat);
      if ((x + phase) % 4 === 0 && th >= 4) put(x, top + 1, bodyD);
      // dark banding toward the tail
      if (th <= 2 && x % 3 === 0) put(x, y, bodyD);
    }

    // --- head (viper wedge) ---
    const hx = 5 - lunge; // skull front-left
    const hy = yAt(9);    // rides the neck wave
    rect(put, hx + 1, hy - 2, 5, 5, body);
    rect(put, hx, hy - 1, 1, 3, body);            // snout tip
    rect(put, hx + 1, hy - 2, 5, 1, bodyD);       // brow ridge
    put(hx + 5, hy - 2, bodyL);                   // skull sheen
    put(hx + 4, hy - 2, bodyL);
    rect(put, hx + 1, hy + 2, 5, 1, belly);       // jaw
    put(hx, hy, P.outline);                       // nostril
    // eye — yellow with slit pupil
    put(hx + 3, hy - 1, flash ? P.white : '#ffcc00');
    put(hx + 4, hy - 1, flash ? P.white : '#ffe060');
    put(hx + 3, hy, flash ? P.white : P.outline); // slit

    if (ai >= 0) {
      // hood flare while striking
      for (let x = 9; x <= 13; x++) {
        put(x, yAt(x) - 3, bodyD);
        put(x, yAt(x) + 3, bodyD);
      }
      // open jaw + fangs
      rect(put, hx - 1, hy, 2, 3, P.outline);
      put(hx - 1, hy, P.white);                   // upper fang
      put(hx - 1, hy + 2, P.white);               // lower fang
      if (ai === 2) put(hx - 2, hy + 3, '#80e060'); // venom drip at full extension
    } else if (tongue) {
      // forked tongue — only drawn on the dedicated esnk_move0t variant
      // frame, which the move loop schedules once every 4 slither cycles
      put(hx - 1, hy, '#dd3333');
      put(hx - 2, hy, '#dd3333');
      put(hx - 3, hy - 1, '#dd3333');
      put(hx - 3, hy + 1, '#dd3333');
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  RAT (32x32) — single oversized meadow rat, low-slung scurrying runner
// ==================================================================
export function drawEnemyRat(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 20, Math.max(0, r), P.rat);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        const x = Math.round(16 + Math.cos(a) * d), y = Math.round(20 + Math.sin(a) * d);
        rawPut(x, y, P.ratD);
        rawPut(x + 1, y, i % 2 === 0 ? P.ratTail : P.ratL);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const body = flash ? P.white : P.rat;
    const bodyD = flash ? P.white : P.ratD;
    const bodyL = flash ? P.white : P.ratL;
    const tail = flash ? P.white : P.ratTail;
    const belly = flash ? P.white : '#a89888';
    const pink = flash ? P.white : '#e8a0a0';
    const whisker = flash ? P.white : '#c8c8c8';

    // 6-phase scurry; attacks map onto a biting lunge
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : ai >= 0 ? [0, 2, 4, 2][ai] : 0;
    const lunge = ai >= 0 ? [0, 1, 2, 1][ai] : 0;
    const bob = mi >= 0 ? Math.round(Math.sin(ph * (Math.PI / 3)) * 1.2) : 0;
    const cy = 20 + bob;          // body centreline
    const hx = -lunge;            // head thrusts toward prey
    const hdy = ai >= 0 ? 1 : 0;  // head dips when biting

    // ground shadow (unrecorded — stays outside the outline)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if ((dx * dx) / 49 + (dy * dy) / 1.2 <= 1) mput(16 + dx, 27 + dy, P.shadow);

    // --- tail: long thin whip, nearly as long as the body ---
    for (let s = 0; s < 7; s++) {
      const ty = cy + 3 - Math.round(Math.sin(ph * (Math.PI / 3) + s * 0.8) * 1.2) - (s >= 5 ? 1 : 0);
      put(22 + s, ty, s < 5 ? tail : bodyD);
    }

    // --- legs: thin scurrying legs with a visible gap under the belly ---
    const legs: ReadonlyArray<readonly [number, number]> = [[10, 0], [13, 3], [17, 1], [20, 4]];
    for (const [lx, k] of legs) {
      const ang = (ph + k) * (Math.PI / 3);
      const dx = mi >= 0 ? Math.round(Math.sin(ang) * 1.5) : 0;
      const lift = mi >= 0 ? Math.max(0, Math.round(Math.cos(ang))) : 0;
      rect(put, lx + dx, cy + 3, 1, 4 - bob - lift, bodyD); // bottom row lands on the 26px ground line
      put(lx + dx - 1, 26 - lift, bodyD); // toes splayed forward
    }

    // --- body: classic rat silhouette — arched hump over the haunch,
    //     dipping to a narrower shoulder, low to the ground ---
    disc(put, 18, cy, 4, body);          // haunch/rump (apex of the arch)
    disc(put, 12, cy + 1, 3, body);      // shoulder (lower — makes the neck dip)
    rect(put, 11, cy - 1, 8, 4, body);   // fill between
    // dark fur saddle along the back — reads as the hump
    rect(put, 15, cy - 4, 5, 1, bodyD);
    put(14, cy - 3, bodyD);
    put(20, cy - 3, bodyD);
    put(13, cy - 2, bodyD);
    put(21, cy - 2, bodyD);
    // flank highlight + pale underside (three-tone, not a blob)
    disc(put, 18, cy + 1, 2, bodyL);
    rect(put, 11, cy + 3, 8, 1, belly);

    // --- head: small skull tapering to a pointed snout ---
    rect(put, 7 + hx, cy + hdy, 4, 4, body);
    rect(put, 5 + hx, cy + 2 + hdy, 2, 2, body);    // snout taper
    put(4 + hx, cy + 3 + hdy, pink);                // nose tip
    put(6 + hx, cy + 3 + hdy, bodyD);               // jaw shading
    // ears — oversized, the key rat read
    rect(put, 10 + hx, cy - 3 + hdy, 2, 3, bodyD);  // far ear
    put(10 + hx, cy - 2 + hdy, flash ? P.white : '#c08080');
    rect(put, 8 + hx, cy - 3 + hdy, 2, 3, body);    // near ear
    put(8 + hx, cy - 2 + hdy, pink);
    // eye — beady red
    put(7 + hx, cy + 1 + hdy, flash ? P.white : '#ff2222');
    // whiskers
    put(3 + hx, cy + 2 + hdy, whisker);
    put(3 + hx, cy + 4 + hdy, whisker);

    // --- attack: bared incisors + motion streaks at full lunge ---
    if (ai >= 0) {
      put(5 + hx, cy + 4 + hdy, P.white);
      if (ai === 2) {
        put(2, cy + 2, bodyD);
        put(1, cy + 3, bodyD);
      }
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  DEER (32x32) — corrupted stag, meadow heavy enemy
// ==================================================================
export function drawEnemyDeer(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, Math.max(0, r), P.deer);
      disc(rawPut, 16, 18, Math.max(0, r - 2), P.deerL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        rawPut(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.deerD);
        rawPut(Math.round(16 + Math.cos(a) * d) + 1, Math.round(18 + Math.sin(a) * d), P.antler);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const body = flash ? P.white : P.deer;
    const bodyD = flash ? P.white : P.deerD;
    const bodyM = flash ? P.white : P.deerM;
    const bodyL = flash ? P.white : P.deerL;
    const belly = flash ? P.white : P.deerBelly;
    const horn = flash ? P.white : P.antler;
    const hornD = flash ? P.white : P.antlerD;
    const hornL = flash ? P.white : P.hornL;

    // Shadow (unrecorded — stays outside the outline)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if ((dx * dx) / 49 + (dy * dy) / 1.5 <= 1) mput(16 + dx, 28 + dy, P.shadow);

    // 6-phase gallop; attacks map onto an antler-thrust lunge
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : 0;
    const bob = mi >= 0 ? [0, -1, -1, 0, -1, -1][ph] : ai >= 0 ? [0, 0, 1, 0][ai] : 0;
    const headDown = ai >= 0 ? [1, 2, 4, 2][ai] : 0;
    const lunge = ai >= 0 ? [0, 1, 3, 1][ai] : 0;
    const cy = 14 + bob;

    // --- legs: 4-beat gallop — each leg swings/lifts on its own phase ---
    const legY = cy + 8;
    const legXs = [11, 15, 19, 22];
    const legKs = [0, 1, 3, 4]; // front pair leads, rear pair follows
    for (let i = 0; i < 4; i++) {
      const ang = (ph + legKs[i]) * (Math.PI / 3);
      const dx = mi >= 0 ? Math.round(Math.sin(ang) * 2) : 0;
      const lift = mi >= 0 ? Math.max(0, Math.round(Math.cos(ang) * 1.5)) : 0;
      const x = legXs[i] + dx;
      rect(put, x, legY, 2, 7 - lift, bodyD);
      put(x, legY + 2, bodyM);                       // knee highlight
      rect(put, x, legY + 7 - lift, 2, 1, P.outline); // hoof
    }

    // --- body ---
    rect(put, 10, cy + 2, 16, 7, body);
    rect(put, 11, cy + 1, 14, 1, body);
    rect(put, 13, cy + 7, 8, 2, belly);     // belly
    rect(put, 12, cy + 1, 10, 2, bodyD);    // dark back stripe
    // muscle shading — shoulder + haunch
    disc(put, 13, cy + 5, 2, bodyM);
    disc(put, 22, cy + 5, 2, bodyM);
    put(23, cy + 4, body);
    // white rump patch
    rect(put, 23, cy + 2, 3, 2, bodyL);
    put(25, cy + 4, bodyL);
    // fawn spots
    put(14, cy + 3, bodyL); put(17, cy + 4, bodyL);
    put(20, cy + 3, bodyL); put(12, cy + 5, bodyL);
    put(18, cy + 2, bodyL); put(15, cy + 6, bodyL);

    // --- neck + head (shifted by the attack lunge) ---
    const hx = -lunge, hy = headDown;
    rect(put, 8 + hx, cy + hy, 4, 5, body);
    put(9 + hx, cy + 1 + hy, bodyM);               // neck shading
    rect(put, 6 + hx, cy - 1 + hy, 5, 4, body);
    rect(put, 5 + hx, cy + hy, 2, 3, body);
    // snout + nose + mouth
    rect(put, 4 + hx, cy + 1 + hy, 3, 2, bodyL);
    put(4 + hx, cy + 1 + hy, P.outline);
    put(5 + hx, cy + 1 + hy, P.outline);
    put(5 + hx, cy + 2 + hy, bodyD);               // mouth line
    // eye — corrupted red with glint
    put(7 + hx, cy + hy, flash ? P.white : '#aa0000');
    put(8 + hx, cy + hy, flash ? P.white : '#ff3030');
    put(8 + hx, cy - 1 + hy, flash ? P.white : '#ff8080'); // glint
    // ear with pink inner
    rect(put, 8 + hx, cy - 3 + hy, 2, 2, bodyD);
    put(9 + hx, cy - 3 + hy, flash ? P.white : '#e8a0a0');

    // --- antlers: taller beams, three tines each, light tips ---
    // near antler
    rect(put, 7 + hx, cy - 5 + hy, 1, 3, horn);
    rect(put, 6 + hx, cy - 8 + hy, 1, 3, horn);
    put(5 + hx, cy - 9 + hy, horn);
    put(5 + hx, cy - 10 + hy, hornL);              // tip
    rect(put, 8 + hx, cy - 7 + hy, 1, 2, horn);
    put(9 + hx, cy - 8 + hy, hornD);
    put(9 + hx, cy - 9 + hy, hornL);
    put(4 + hx, cy - 6 + hy, hornD);               // brow tine
    put(3 + hx, cy - 7 + hy, hornL);
    // far antler
    rect(put, 10 + hx, cy - 5 + hy, 1, 3, hornD);
    rect(put, 11 + hx, cy - 8 + hy, 1, 3, hornD);
    put(12 + hx, cy - 9 + hy, hornD);
    put(12 + hx, cy - 10 + hy, horn);
    rect(put, 9 + hx, cy - 6 + hy, 1, 1, hornD);
    put(13 + hx, cy - 7 + hy, hornD);

    // --- tail: smooth wag ---
    const tailWag = Math.round(Math.sin(ph * (Math.PI / 3)) * 1.5);
    put(26, cy + 2 + tailWag, bodyL);
    put(26, cy + 3 + tailWag, bodyL);
    put(27, cy + 1 + tailWag, bodyL);

    // --- attack: antlers rake forward with motion streaks ---
    if (ai >= 0) {
      put(4 + hx, cy - 2 + hy, horn);
      put(3 + hx, cy - 3 + hy, horn);
      put(4 + hx, cy - 4 + hy, horn);
      put(3 + hx, cy - 5 + hy, hornD);
      put(2 + hx, cy - 4 + hy, hornL);
      if (ai === 2) { // streaks at full extension
        put(1, cy - 3 + hy, hornD);
        put(2, cy - 6 + hy, hornD);
        put(1, cy + hy, bodyD);
      }
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  INFECTED BASIC (32x32) — purple infected variant of basic enemy
// ==================================================================
export function drawEnemyInfectedBasic(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, r, P.infect);
      disc(rawPut, 16, 18, Math.max(0, r - 1), P.infectL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        const x = Math.round(16 + Math.cos(a) * d);
        const y = Math.round(18 + Math.sin(a) * d);
        rawPut(x, y, P.infectD);
        rawPut(x + 1, y, i % 2 === 0 ? P.infectH : P.infect);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const fl  = flash ? P.white : P.infect;    // purple flesh
    const flD = flash ? P.white : P.infectD;
    const flM = flash ? P.white : P.infectM;
    const flL = flash ? P.white : P.infectL;
    const boil  = flash ? P.white : P.infectH;  // orange pustules
    const boilL = flash ? P.white : P.infectHL;
    const spike = flash ? P.white : P.bronze;   // bone-orange back spikes
    const spikeL = flash ? P.white : P.bronzeL;
    const fang = flash ? P.white : P.arrow;     // golden-bone fangs

    // 6-phase lumber; attack = maw opens → gapes WIDE → lunge + bite shut
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : 0;
    const bob = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 1.2) : ai === 1 ? 1 : 0;
    const ox = ai >= 0 ? [1, 0, -2, -1][ai] : 0;       // lunge thrust (toward prey)
    const gape = ai === 0 ? 2 : ai === 1 ? 6 : 0;      // mouth opening height
    const clamp = ai === 2;                            // jaws slam shut mid-lunge

    // ground shadow (unrecorded)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -10; dx <= 10; dx++)
        if ((dx * dx) / 100 + (dy * dy) / 1.2 <= 1) mput(16 + dx + ox, 27 + dy, P.shadow);

    // ---- three stumpy legs: two front, one back ----
    // [x, width, phaseOffset, far]
    const legs: ReadonlyArray<readonly [number, number, number, boolean]> = [
      [6, 4, 0, false],            // near front
      [11, 3, Math.PI, true],      // far front
      [20, 5, Math.PI / 2, false], // single back leg
    ];
    for (const [lx, w, off, far] of legs) {
      let dx = 0, lift = 0;
      if (mi >= 0) {
        const ang = (ph / 6) * Math.PI * 2 + off;
        dx = Math.round(Math.sin(ang) * 1.5);
        lift = Math.max(0, Math.round(Math.cos(ang)));
      }
      const x = lx + dx + ox;
      rect(put, x, 20, w, 6 - lift, far ? flD : fl);
      rect(put, x, 20, 1, 5 - lift, far ? flM : flL);  // lit edge
      // toe folds
      put(x + 1, 25 - lift, flash ? P.white : P.outline);
      if (w >= 4) put(x + w - 2, 25 - lift, flash ? P.white : P.outline);
      if (!far) put(x + w - 1, 23 - lift, flD);        // ankle fold
    }
    // boil on the back leg
    put(22 + ox, 22, boil);
    put(23 + ox, 22, flD);

    // ---- body: lumpy tumorous mass (overlapping lobes) ----
    const B = ox; // body shift
    disc(put, 18 + B, 14 + bob, 9, fl);
    disc(put, 12 + B, 11 + bob, 6, fl);
    disc(put, 23 + B, 11 + bob, 6, fl);
    disc(put, 10 + B, 17 + bob, 5, fl);
    disc(put, 24 + B, 17 + bob, 6, fl);
    // mottled sick flesh
    for (let yy = 4; yy <= 23; yy++)
      for (let xx = 4; xx <= 29; xx++) {
        const X = xx + B, Y = yy + bob;
        if (!px.has(Y * 32 + X)) continue;
        if ((xx * 3 + yy * 7) % 11 === 0) put(X, Y, flM);
        else if ((xx * 5 + yy * 3) % 13 === 0) put(X, Y, flD);
      }
    // sheen along the upper-back lobes
    put(20 + B, 6 + bob, flL); put(23 + B, 7 + bob, flL);
    put(14 + B, 7 + bob, flL); put(25 + B, 9 + bob, flL);
    // deep crease folds between the lobes
    put(16 + B, 12 + bob, flD); put(17 + B, 13 + bob, flD);
    put(21 + B, 16 + bob, flD); put(20 + B, 17 + bob, flD);

    // ---- bone spikes along the back ridge ----
    for (const [sx2, sy2, tall] of [[11, 6, 2], [15, 4, 3], [20, 4, 3], [25, 7, 2]] as const) {
      for (let j = 0; j < tall; j++) {
        put(sx2 + B, sy2 + bob - j, j === tall - 1 ? spikeL : spike);
        if (j === 0) put(sx2 + 1 + B, sy2 + bob, flash ? P.white : P.bronzeD);
      }
    }

    // ---- weeping pustules (drips animate with the walk phase) ----
    // the big boil
    disc(put, 19 + B, 11 + bob, 2, boil);
    put(18 + B, 10 + bob, boilL);
    put(19 + B, 10 + bob, P.white);                    // wet glint
    ring(put, 19 + B, 11 + bob, 3, flD);               // swollen rim
    // medium boils
    disc(put, 13 + B, 9 + bob, 1, boil); put(13 + B, 8 + bob, boilL);
    disc(put, 24 + B, 15 + bob, 1, boil); put(24 + B, 14 + bob, boilL);
    disc(put, 11 + B, 15 + bob, 1, flash ? P.white : '#e088a8'); // pink one
    put(11 + B, 14 + bob, P.white);
    // small boil pips
    put(16 + B, 18 + bob, boil);
    put(22 + B, 19 + bob, boil);
    put(9 + B, 11 + bob, boil);
    // orange ooze trailing down from the weepers
    put(19 + B, 14 + bob, boil);
    put(19 + B, 15 + bob + (ph % 2), flash ? P.white : P.infectHM);
    put(24 + B, 17 + bob + ((ph + 1) % 2), flash ? P.white : P.infectHM);

    // ---- furious eye sunk in a brow fold ----
    const ey = 9 + bob;
    rect(put, 6 + B, ey - 1, 5, 1, flD);               // heavy brow fold
    put(5 + B, ey, flD);
    put(7 + B, ey, flash ? P.white : '#ff5020');       // burning iris
    put(8 + B, ey, flash ? P.white : '#8a1408');
    if (ai === 1) put(6 + B, ey, P.white);             // eye flares at full gape

    // ---- the MAW ----
    const mx = 4 + B;
    if (gape > 0) {
      // open: dark gullet between two rows of long bone fangs
      const top = 15 - (gape >> 1) + bob;
      rect(put, mx - 1, top, 9, gape, flash ? P.white : '#3a0a14');
      put(mx + 2, top + (gape >> 1), flash ? P.white : '#6a1020'); // throat
      put(mx + 4, top + (gape >> 1), flash ? P.white : P.redD);
      for (let k = 0; k < 4; k++) {
        const fx2 = mx + k * 2;
        const flen = gape >= 6 ? 2 : 1;
        for (let j = 0; j < flen; j++) put(fx2, top + j, fang);              // upper fangs
        for (let j = 0; j < flen; j++) put(fx2 + 1, top + gape - 1 - j, fang); // lower fangs
      }
      if (gape >= 6) put(mx - 1, top + gape, boil);    // drool at the corner
    } else if (clamp) {
      // jaws slammed shut — interlocked fangs + impact burst
      line(put, mx - 1, 16 + bob, mx + 7, 17 + bob, flD);
      for (let k = 0; k < 4; k++) {
        put(mx + k * 2, 15 + bob, fang);
        put(mx + 1 + k * 2, 17 + bob, fang);
      }
      mput(mx - 2, 13 + bob, P.white);                 // the clack
      mput(mx - 2, 16 + bob, P.white);
      mput(mx - 2, 19 + bob, P.white);
    } else {
      // closed: wide lip seam with fang tips poking through
      line(put, mx - 1, 16 + bob, mx + 8, 17 + bob, flD);
      for (let k = 0; k < 4; k++) {
        put(mx + k * 2, 15 + bob, fang);
        put(mx + 1 + k * 2, 17 + bob, fang);
      }
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  INFECTED HEAVY (32x32) — orange infected armored brute
// ==================================================================
export function drawEnemyInfectedHeavy(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, r, P.infectH);
      disc(rawPut, 16, 18, Math.max(0, r - 1), P.infectHL);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.3;
        const d = step * 3 + 4;
        rawPut(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.infectHD);
        rawPut(Math.round(16 + Math.cos(a) * d) + 1, Math.round(18 + Math.sin(a) * d), i % 2 === 0 ? P.infectR : P.wBone);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const fl  = flash ? P.white : P.infectH;    // orange flesh
    const flD = flash ? P.white : P.infectHD;
    const flM = flash ? P.white : P.infectHM;
    const flL = flash ? P.white : P.infectHL;
    const boil  = flash ? P.white : P.infectR;  // yellow-green boils
    const boilL = flash ? P.white : P.infectRL;
    const bn  = flash ? P.white : P.wBone;      // spikes / claws / fangs
    const bnL = flash ? P.white : P.wBoneL;
    const ooze = flash ? P.white : '#d8d040';

    // 6-phase upright lumber; attack = near-camera claw swipe
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : 0;
    const bob = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 1.3) : 0;
    const ox = ai >= 0 ? [1, 0, -2, -1][ai] : 0;       // lunge into the swipe
    const rear = ai >= 0 ? [1, 2, 0, 0][ai] : 0;       // rocks back on the windup
    const roar = ai === 1 || ai === 2 ? 2 : 0;         // maw gapes wider mid-swipe

    // ground shadow (unrecorded)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -10; dx <= 10; dx++)
        if ((dx * dx) / 100 + (dy * dy) / 1.2 <= 1) mput(15 + dx + ox, 28 + dy, P.shadow);

    // ---- two sturdy legs (it stands TALL — nothing like the basic's blob) ----
    const stride = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 2) : 0;
    const liftN = mi >= 0 ? Math.max(0, Math.round(Math.cos((ph / 6) * Math.PI * 2) * 1.2)) : 0;
    const liftF = mi >= 0 ? Math.max(0, Math.round(-Math.cos((ph / 6) * Math.PI * 2) * 1.2)) : 0;
    const B = ox;
    // far leg
    rect(put, 15 - stride + B, 19 + bob, 3, 8 - liftF - bob, flD);
    put(14 - stride + B, 26 - liftF, bn);              // bone toe claws
    put(16 - stride + B, 26 - liftF, bn);
    // near leg — knee accent, lit front edge
    rect(put, 10 + stride + B, 19 + bob, 4, 8 - liftN - bob, fl);
    rect(put, 10 + stride + B, 19 + bob, 1, 7 - liftN - bob, flL);
    put(11 + stride + B, 22 + bob, flD);               // knee crease
    put(9 + stride + B, 26 - liftN, bn);               // splayed toe claws
    put(11 + stride + B, 26 - liftN, bn);
    put(13 + stride + B, 26 - liftN, bnL);

    // ---- UPRIGHT torso: broad shoulders tapering to the hips ----
    // (rocking back on the windup shifts the upper body rearward)
    for (let y = 10; y <= 19; y++) {
      const t = (y - 10) / 9;
      const halfW = Math.round(7 - t * 3);             // shoulders 14 wide → hips 8
      const cxT = 13 + Math.round(t) + Math.round(rear * (1 - t)) + B;
      rect(put, cxT - halfW, y + bob, halfW * 2 + 1, 1, fl);
      put(cxT - halfW, y + bob, flL);                  // lit chest edge
      put(cxT + halfW, y + bob, flD);                  // shaded back edge
    }
    // muscle definition — pec line, ab creases, lat shading
    put(10 + rear + B, 13 + bob, flD);
    put(11 + rear + B, 13 + bob, flD);
    put(12 + B, 15 + bob, flD);
    put(13 + B, 17 + bob, flD);
    rect(put, 17 + B, 12 + bob, 2, 5, flM);            // lat/back shading
    // light mottling (sparser than the basic — muscle, not tumor)
    for (let yy = 10; yy <= 19; yy++)
      for (let xx = 7; xx <= 20; xx++) {
        const X = xx + B, Y = yy + bob;
        if (!px.has(Y * 32 + X)) continue;
        if ((xx * 5 + yy * 3) % 17 === 0) put(X, Y, flM);
      }

    // ---- bone spikes down the back edge ----
    for (const [sx2, sy2, tall] of [[14, 8, 3], [17, 9, 2], [19, 12, 2], [20, 15, 2]] as const) {
      for (let j = 0; j < tall; j++)
        put(sx2 + rear + B, sy2 + bob - j, j === tall - 1 ? bnL : bn);
    }

    // ---- a few boils (restrained — the heavy is muscle, not blob) ----
    disc(put, 16 + B, 13 + bob, 2, boil);              // big one on the shoulder blade
    put(15 + B, 12 + bob, boilL);
    put(16 + B, 12 + bob, P.white);                    // wet glint
    ring(put, 16 + B, 13 + bob, 3, flD);               // swollen rim
    disc(put, 12 + B, 17 + bob, 1, boil); put(12 + B, 16 + bob, boilL);
    put(18 + B, 18 + bob, boil);
    put(12 + stride + B, 21 + bob, boil);              // one on the near thigh
    // ooze trail (animates with the walk)
    put(16 + B, 16 + bob, ooze);
    put(16 + B, 17 + bob + (ph % 2), ooze);

    // ---- head: ON TOP of the shoulders, brow and teeth ----
    const hx = 9 + rear + B, hy = 6 + bob;
    disc(put, hx + 1, hy, 4, fl);
    put(hx + 3, hy - 3, flL);                          // crown light
    rect(put, hx - 3, hy - 2, 7, 2, flD);              // massive scowling brow
    put(hx - 3, hy - 1, flM);
    // slitted furious eye
    put(hx - 1, hy - 1, flash ? P.white : '#d8e030');
    put(hx, hy - 1, flash ? P.white : P.outline);
    // ---- the gaping maw (wider when it roars mid-swipe) ----
    const gape = 2 + roar;
    rect(put, hx - 4, hy + 1, 8, gape, flash ? P.white : '#4a1408');
    put(hx - 1, hy + 2, flash ? P.white : P.redD);      // throat
    for (let k = 0; k < 4; k++) {
      put(hx - 4 + k * 2, hy + 1, bnL);                 // upper fangs
      if (roar > 0) put(hx - 4 + k * 2, hy + 2, bn);
      put(hx - 3 + k * 2, hy + gape, bnL);              // lower fangs
    }
    put(hx - 4, hy + gape + 1, ooze);                   // drool off the jaw
    put(hx - 4, hy + gape + 2 + (ph % 2), ooze);
    // thick neck planting the head on the shoulders
    rect(put, hx, hy + 3, 4, 2, flM);

    // ---- far arm: hangs from the far shoulder, small claw drag ----
    line(put, 17 + rear + B, 12 + bob, 18 + B, 18 + bob, flD);
    line(put, 18 + B, 18 + bob, 17 + B, 23 + bob, flM);
    put(16 + B, 25 + bob, bn);                          // dragging claws
    put(17 + B, 26 + bob, bn);

    // ---- near arm: the SWIPE claw, drawn last over everything ----
    {
      const shX = 8 + rear + B, shY = 11 + bob;         // near shoulder (top of the torso)
      // wrist arc: rest → raised back → overhead → raking down past the maw → low
      const W: ReadonlyArray<readonly [number, number]> =
        ai >= 0 ? [[14, 6], [9, 4], [2, 12], [4, 20]] : [[5, 21], [5, 21], [5, 21], [5, 21]];
      const [wx0, wy] = ai >= 0 ? W[ai] : [5 - Math.round(stride / 2), 21];
      const wx = wx0 + B;
      const elX = Math.round((shX + wx) / 2) + (ai === 0 || ai === 1 ? 2 : -2);
      const elY = Math.round((shY + wy) / 2) - (ai === 0 || ai === 1 ? 2 : 0);
      // thick arm (3px)
      line(put, shX, shY - 1, elX, elY - 1, flL);
      line(put, shX, shY, elX, elY, fl);
      line(put, shX, shY + 1, elX, elY + 1, flD);
      line(put, elX, elY - 1, wx, wy - 1, flL);
      line(put, elX, elY, wx, wy, fl);
      line(put, elX, elY + 1, wx, wy + 1, flD);
      disc(put, elX, elY, 1, fl);                       // elbow knob
      put(elX, elY - 2, boil);                          // boil at the joint
      // the big claw: knuckle mass + three long bone talons
      disc(put, wx, wy, 2, flM);
      put(wx, wy - 1, fl);
      const cdx = ai < 0 ? 0 : ai <= 1 ? 1 : 1;         // talon direction
      const cdy = ai < 0 ? 1 : ai <= 1 ? -1 : 1;
      for (let k = -1; k <= 1; k++) {
        put(wx + 2 * cdx + k, wy + 2 * cdy, bn);
        put(wx + 3 * cdx + k, wy + 3 * cdy, k === 0 ? bnL : bn);
        if (k === 0) put(wx + 4 * cdx, wy + 4 * cdy, bnL);
      }
      // motion arc on the impact frame — traces overhead → strike point
      if (ai === 2) {
        for (let a = Math.PI * 1.05; a <= Math.PI * 1.5; a += 0.15) {
          const ax2 = Math.round(shX + Math.cos(a) * 9);
          const ay2 = Math.round(shY + Math.sin(a) * 9);
          mput(ax2, ay2, a < Math.PI * 1.25 ? P.white : flL);
        }
        mput(wx - 1, wy - 3, P.white);                  // crack at the strike point
        mput(wx + 1, wy - 2, P.white);
      } else if (ai === 3) {
        mput(wx + 1, wy - 4, flL);                      // fading trail
        mput(wx + 2, wy - 6, flL);
      }
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  BLIGHTED TOAD (32x32) — infected ranged toad, lobs toxic globs
// ==================================================================
export type ToadFrame = 'idle' | 'hop0' | 'hop1' | 'hop2' | 'hop3' | 'atk0' | 'atk1' | 'hit' | 'die0' | 'die1' | 'die2' | 'die3';

export function drawEnemyToad(f: ToadFrame) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 9 - step * 2;
      if (r <= 0) return;
      ellipse(rawPut, 16, 20, r + 2, r, P.toad);
      ellipse(rawPut, 16, 20, Math.max(0, r + 1), Math.max(0, r - 1), P.toadL);
      // toxic splatter particles
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        rawPut(Math.round(16 + Math.cos(a) * d), Math.round(20 + Math.sin(a) * d), '#40e060');
        rawPut(Math.round(16 + Math.cos(a) * d) + 1, Math.round(20 + Math.sin(a) * d), P.toadW);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const hide  = flash ? P.white : P.toad;
    const hideD = flash ? P.white : P.toadD;
    const hideM = flash ? P.white : P.toadM;
    const hideL = flash ? P.white : P.toadL;
    const wart  = flash ? P.white : P.toadW;
    const wartL = flash ? P.white : P.toadWL;
    const belly = flash ? P.white : P.toadB;
    const green = flash ? P.white : '#40e060';

    // Hop offsets: how high off the ground the toad is
    let hopY = 0;
    let squashX = 0; // widen body on landing
    let squashY = 0; // flatten body on landing
    if (f === 'hop0') { hopY = 1; squashY = 1; squashX = 1; } // coiled to launch
    if (f === 'hop1') { hopY = -7; }                           // peak of hop
    if (f === 'hop2') { hopY = -4; }                           // coming down
    if (f === 'hop3') { hopY = 0; squashX = 2; squashY = 1; }  // landing squash
    const airborne = f === 'hop1' || f === 'hop2';

    const isAtk0 = f === 'atk0';
    const isAtk1 = f === 'atk1';

    // Shadow (smaller when airborne, unrecorded)
    const shadowR = hopY < -3 ? 5 : 8;
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -shadowR; dx <= shadowR; dx++)
        if ((dx * dx) / (shadowR * shadowR) + (dy * dy) / 1.2 <= 1)
          mput(16 + dx, 27 + dy, P.shadow);

    const cy = 17 + hopY + (isAtk0 ? 1 : 0); // body centre (crouches on the windup)

    // ---- hind leg: the big folded thigh at the rear ----
    if (airborne) {
      // launch kick — leg extended back and down
      line(put, 22, cy + 3, 27, cy + 8, hideM);
      line(put, 22, cy + 4, 26, cy + 8, hideD);
      put(28, cy + 9, flash ? P.white : '#c8a040');     // kicked-back toes
      put(27, cy + 10, flash ? P.white : '#c8a040');
    } else {
      disc(put, 22, cy + 3, 4, hide);                   // folded thigh
      put(20, cy + 1, hideD);                           // fold crease
      put(21, cy + 2, hideD);
      put(21, cy + 4, wart);                            // thigh spots
      put(23, cy + 2, wart);
      put(23, cy + 5, wart);
      // long webbed foot tucked forward under the body
      for (let x = 17; x <= 23; x++) put(x, 25 - squashY + (x % 2), hideM);
      put(17, 26 - squashY, flash ? P.white : '#c8a040'); // claw tips
      put(19, 26 - squashY, flash ? P.white : '#c8a040');
    }

    // ---- squat warty body, brow raised at the front ----
    const bw = 10 + squashX;
    const bh = 7 - squashY;
    ellipse(put, 16, cy, bw, bh, hide);
    // pebbled hide texture
    for (let yy = -bh; yy <= bh; yy++)
      for (let xx = -bw; xx <= bw; xx++) {
        const X = 16 + xx, Y = cy + yy;
        if (!px.has(Y * 32 + X)) continue;
        if ((xx * 3 + yy * 7 + 64) % 9 === 0) put(X, Y, hideM);
        else if ((xx * 5 + yy * 3 + 64) % 13 === 0) put(X, Y, hideD);
      }
    // back highlight
    for (let xx = -3; xx <= 4; xx++)
      if ((xx + 32) % 2 === 0) put(16 + xx, cy - bh + 1, hideL);

    // ---- warts — raised brown bumps with lit tops ----
    disc(put, 17, cy - 4, 1, wart); put(17, cy - 5, wartL);
    disc(put, 21, cy - 2, 1, wart); put(21, cy - 3, wartL);
    disc(put, 13, cy - 3, 1, wart); put(13, cy - 4, wartL);
    put(19, cy - 6, wart);
    put(24, cy - 4, wart);
    put(11, cy - 1, wart);
    put(15, cy - 1, wart);
    put(23, cy + 1, wart);

    // ---- grumpy face: heavy brow, amber eye, downturned frown ----
    // brow ridge looming over the eye
    rect(put, 5, cy - 6, 6, 2, hideM);
    rect(put, 5, cy - 6, 6, 1, hideD);
    put(11, cy - 5, hideD);
    // big amber eye with a slit pupil
    put(7, cy - 4, flash ? P.white : '#e89018');
    put(8, cy - 4, flash ? P.white : '#f0a830');
    put(7, cy - 3, flash ? P.white : '#a85808');
    put(8, cy - 3, flash ? P.white : P.outline);        // slit
    put(6, cy - 4, P.white);                            // wet glint
    // nostril on the snout
    put(4, cy - 2, hideD);
    // mouth + chin
    if (isAtk1) {
      // maw wide open — the glob is coming out
      ellipse(put, 7, cy + 2, 4, 3, flash ? P.white : '#2e1208');
      rect(put, 4, cy, 7, 1, hideD);                    // raised upper lip
      put(8, cy + 3, flash ? P.white : P.redD);         // throat
      // the toxic glob emerging from the mouth
      disc(put, 4, cy + 2, 1, green);
      put(3, cy + 1, flash ? P.white : '#80ff90');
      put(4, cy + 3, flash ? P.white : '#208030');
      put(6, cy + 5, belly);                            // dropped chin
    } else {
      // the reference's wide downturned frown
      line(put, 3, cy + 1, 7, cy + 3, hideD);
      line(put, 7, cy + 3, 12, cy + 3, hideD);
      put(12, cy + 4, hideD);                           // grumpy corner crease
      // tan chin + belly
      for (let yy = cy + 4; yy <= cy + bh; yy++)
        for (let xx = 4; xx <= 13 - (yy - cy - 4); xx++) {
          if (!px.has(yy * 32 + xx)) continue;
          put(xx, yy, belly);
        }
      put(6, cy + 5, flash ? P.white : '#9a8050');      // chin shade
      put(9, cy + 6, flash ? P.white : '#9a8050');
    }
    // inflated throat pouch on the windup
    if (isAtk0) {
      disc(put, 7, cy + 4, 3, belly);
      put(6, cy + 3, flash ? P.white : '#d8bc8c');      // stretched skin sheen
      put(5, cy + 5, flash ? P.white : '#9a8050');
    }

    // ---- front legs: planted, long toes splayed forward ----
    if (airborne) {
      // tucked up against the chest
      line(put, 10, cy + 4, 8, cy + 6, hideM);
      put(7, cy + 6, flash ? P.white : '#c8a040');
    } else {
      // near leg
      rect(put, 9, cy + 4, 2, 25 - squashY - (cy + 4), hide);
      put(9, cy + 4, hideL);                            // shoulder light
      put(10, cy + 6, hideD);                           // elbow crease
      // splayed toes with claws
      put(7, 25 - squashY, hide);
      put(6, 26 - squashY, flash ? P.white : '#c8a040');
      put(8, 26 - squashY, flash ? P.white : '#c8a040');
      put(10, 26 - squashY, flash ? P.white : '#c8a040');
      // far leg
      rect(put, 13, cy + 5, 2, 24 - squashY - (cy + 5), hideM);
      put(12, 25 - squashY, hideD);
      put(14, 25 - squashY, hideD);
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  TOAD GLOB PROJECTILE (16x16) — arcing toxic glob
// ==================================================================
export function drawToadGlob(f: 'glob0' | 'glob1') {
  return (put: Put) => {
    const c1 = f === 'glob0' ? '#40e060' : '#60ff80';
    const c2 = f === 'glob0' ? '#208030' : '#40a050';
    // Glob body
    disc(put, 8, 8, 4, c2);
    disc(put, 8, 7, 3, c1);
    // Glow center
    put(8, 7, '#a0ff80');
    put(7, 7, c1); put(9, 7, c1);
    // Dripping trail
    put(8, 12, c2); put(7, 13, c2);
    put(9, 11, c2);
    // Speckles
    put(6, 6, '#80ff90');
    put(10, 8, '#80ff90');
  };
}

// ==================================================================
//  ENEMY WOLF (32x32) — fast grey pack hunter
// ==================================================================
export function drawEnemyWolf(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, r, P.wlf);
      disc(rawPut, 16, 18, Math.max(0, r - 1), P.wlfC);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 3;
        rawPut(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), P.wlfD);
        rawPut(Math.round(16 + Math.cos(a) * d) + 1, Math.round(18 + Math.sin(a) * d), P.wlfCD);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const top  = flash ? P.white : P.wlfD;   // dark slate saddle
    const bod  = flash ? P.white : P.wlf;    // mid coat
    const mid  = flash ? P.white : P.wlfM;
    const lite = flash ? P.white : P.wlfL;   // light flank
    const crm  = flash ? P.white : P.wlfC;   // cream underside
    const crmD = flash ? P.white : P.wlfCD;
    const amber = flash ? P.white : '#e8b428';

    // 6-phase trot; attack = jaws open + coil → lunge gaping → SNAP shut
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : 0;
    const bob = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 1) : 0;
    const ox = ai >= 0 ? [2, -2, -2, -1][ai] : 0;     // lunge thrust (toward prey)
    const hdy = ai >= 0 ? [1, 0, 0, 1][ai] : bob;     // head drops as it coils
    const jawOpen = ai === 0 || ai === 1;             // mouth opens through the lunge
    const gape = ai === 1 ? 3 : 2;                    // wide at full extension
    const snap = ai === 2;                            // jaws clack shut on impact

    // ground shadow (unrecorded)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -8; dx <= 8; dx++)
        if ((dx * dx) / 64 + (dy * dy) / 1.2 <= 1) mput(16 + dx + ox, 27 + dy, P.shadow);

    // ---- bushy tail, slate over a cream underside ----
    const tw = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 1) : ai === 0 ? -1 : 0;
    for (let t = 0; t <= 1; t += 0.18) {
      const tx2 = Math.round(22 + 6 * t) + ox;
      const ty2 = Math.round(15 + bob + 6 * Math.pow(t, 1.3)) + tw;
      disc(put, tx2, ty2, t < 0.6 ? 2 : 1, bod);
      put(tx2, ty2 - (t < 0.6 ? 2 : 1), top);          // dark top
      put(tx2, ty2 + (t < 0.6 ? 2 : 1), crm);          // cream underside
      // fluff breaking the silhouette
      if (Math.round(t * 5) % 2 === 0) {
        put(tx2 + 1, ty2 - (t < 0.6 ? 3 : 2), top);
        put(tx2 - 1, ty2 + (t < 0.6 ? 3 : 2), crmD);
      }
    }
    put(29 + ox, 22 + tw, crm);                        // pale tail tip
    put(28 + ox, 23 + tw, crmD);

    // ---- legs: long and slender, cream lower halves, pale paws ----
    // [hipX, phaseOffset] — diagonal trot pairs
    const legs: ReadonlyArray<readonly [number, number]> = [[9, 0], [20, Math.PI], [11, Math.PI], [22, 0]];
    for (let k = 0; k < 4; k++) {
      const [hipX, off] = legs[k];
      const far = k >= 2;
      let dx = 0, lift = 0;
      if (mi >= 0) {
        const ang = (ph / 6) * Math.PI * 2 + off + (far ? Math.PI / 2 : 0);
        dx = Math.round(Math.sin(ang) * 2);
        lift = Math.max(0, Math.round(Math.cos(ang) * 1.2));
      } else if (ai === 0) {
        dx = k % 2 === 0 ? 1 : -1;                     // legs coil under the body
      }
      const x = hipX + dx + ox + (far ? 1 : 0);
      const footY = 26 - lift;
      rect(put, x, 17 + bob, 2, 4, far ? top : mid);   // thigh
      if (!far) put(x, 17 + bob, bod);                 // thigh light
      // rear legs kink backward at the hock
      const hock = k === 1 || k === 3 ? 1 : 0;
      rect(put, x + hock, 21 + bob, far ? 1 : 2, footY - 21 - bob, far ? crmD : crm); // cream shank
      put(x + hock, footY, far ? crmD : crm);          // pale paw
      if (!far) {
        put(x + hock + 1, footY, crm);
        put(x + hock - 1, footY, flash ? P.white : P.outline); // toe split
      }
    }

    // ---- body: sleek, dark saddle over light flank over cream belly ----
    const bcx = 15 + ox, bcy = 15 + bob;
    ellipse(put, bcx, bcy, 8, 4, bod);
    // dark saddle along the back
    for (let xx = -7; xx <= 7; xx++)
      for (let yy = -4; yy <= -1; yy++)
        if ((xx * xx) / 64 + (yy * yy) / 16 <= 1) put(bcx + xx, bcy + yy, top);
    // layered fur strokes — dark in the saddle, light through the flank
    for (let xx = -7; xx <= 7; xx++)
      for (let yy = -4; yy <= 3; yy++) {
        const X = bcx + xx, Y = bcy + yy;
        if (!px.has(Y * 32 + X)) continue;
        if (yy < -1 && (xx * 3 + yy * 7 + 64) % 7 === 0) put(X, Y, mid);
        else if (yy >= -1 && (xx * 5 + yy * 3 + 64) % 9 === 0) put(X, Y, lite);
      }
    // muscled haunch + shoulder definition
    disc(put, bcx + 5, bcy, 2, mid);
    put(bcx + 4, bcy - 1, lite);
    disc(put, bcx - 5, bcy + 1, 2, mid);
    put(bcx - 5, bcy, lite);
    // cream belly — two-row gradient
    for (let xx = -5; xx <= 5; xx++) put(bcx + xx, bcy + 4, crm);
    for (let xx = -4; xx <= 4; xx += 2) put(bcx + xx, bcy + 3, crmD);
    put(bcx - 5, bcy + 3, crm);
    // ragged fur fringe under the ribs
    put(bcx - 2, bcy + 5, crmD);
    put(bcx + 2, bcy + 5, crmD);
    put(bcx, bcy + 5, crm);

    // ---- neck + head: long muzzle, amber eye, upright ears ----
    const hcx = 8 + ox, hcy = 11 + hdy;
    rect(put, hcx + 1, hcy + 1, 4, 5, bod);            // neck
    rect(put, hcx + 2, hcy, 3, 2, top);                // nape
    put(hcx + 3, hcy + 5, crm);                        // chest ruff
    put(hcx + 4, hcy + 6, crm);
    put(hcx + 2, hcy + 6, crmD);
    put(hcx + 5, hcy + 7, crmD);
    disc(put, hcx, hcy, 3, bod);                       // skull
    rect(put, hcx - 2, hcy - 3, 5, 2, top);            // dark crown
    put(hcx - 3, hcy - 2, top);                        // crown tapers to the bridge
    // cheek ruff — fuller, breaking the jawline
    put(hcx + 2, hcy + 2, crm);
    put(hcx + 3, hcy + 3, crm);
    put(hcx + 2, hcy + 3, crmD);
    put(hcx + 1, hcy + 2, crmD);
    // ears — pinned flat through the lunge + snap, upright otherwise
    if (ai === 1 || ai === 2) {
      rect(put, hcx + 1, hcy - 4, 3, 2, bod);
      put(hcx + 4, hcy - 3, top);
    } else {
      rect(put, hcx, hcy - 6, 2, 4, bod);              // near ear
      put(hcx, hcy - 6, top);
      put(hcx + 1, hcy - 5, top);                      // pointed tip
      put(hcx + 1, hcy - 4, crmD);                     // pale inner
      rect(put, hcx + 3, hcy - 5, 2, 3, top);          // far ear
      put(hcx + 4, hcy - 4, mid);
    }
    // muzzle — slate bridge over a cream lower jaw
    rect(put, hcx - 5, hcy - 1, 5, 2, bod);
    rect(put, hcx - 5, hcy - 1, 5, 1, top);
    put(hcx - 3, hcy - 1, mid);                        // bridge shading step
    rect(put, hcx - 6, hcy - 1, 1, 2, flash ? P.white : P.outline); // big nose
    put(hcx - 5, hcy, flash ? P.white : '#10141c');    // nostril
    // amber eye under a brow ridge
    put(hcx - 1, hcy - 2, top);                        // brow
    put(hcx, hcy - 2, top);
    put(hcx - 1, hcy - 1, amber);
    put(hcx - 2, hcy - 1, flash ? P.white : P.outline);
    // ---- the jaw: opens through the lunge, SNAPS shut on impact ----
    if (jawOpen) {
      rect(put, hcx - 5, hcy + 1, 5, gape - 1, flash ? P.white : '#2a0808'); // open maw
      put(hcx - 5, hcy + 1, P.white);                  // upper fangs
      put(hcx - 3, hcy + 1, P.white);
      rect(put, hcx - 5, hcy + gape, 5, 1, crm);       // dropped lower jaw
      put(hcx - 4, hcy + gape - 1, P.white);           // lower fang
      put(hcx - 5, hcy + gape - 1, P.white);
      if (gape >= 3) put(hcx - 2, hcy + 2, flash ? P.white : P.red); // tongue
    } else if (snap) {
      // jaws clenched shut at full extension — the clack
      rect(put, hcx - 5, hcy + 1, 5, 1, crm);
      put(hcx - 5, hcy + 1, P.white);                  // teeth clenched at the tip
      put(hcx - 4, hcy + 1, P.white);
      put(hcx - 3, hcy + 1, crmD);                     // tight lip line
      // impact burst radiating off the muzzle
      mput(hcx - 6, hcy - 3, P.white);
      mput(hcx - 6, hcy + 1, P.white);
      mput(hcx - 6, hcy + 3, P.white);
      mput(hcx - 5, hcy - 2, lite);
      mput(hcx - 5, hcy + 2, lite);
    } else {
      rect(put, hcx - 5, hcy + 1, 5, 1, crm);          // closed cream jaw
      put(hcx - 4, hcy + 1, crmD);                     // lip line
    }

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  ENEMY SPIDER (32x32) — dark arachnid with red eyes
// ==================================================================
export function drawEnemySpider(f: EFrame6) {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 6 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, r, P.spdr);
      disc(rawPut, 16, 18, Math.max(0, r - 1), P.spdrL);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        const x = Math.round(16 + Math.cos(a) * d), y = Math.round(18 + Math.sin(a) * d);
        rawPut(x, y, P.spdrD);
        rawPut(x + 1, y, i % 2 === 0 ? P.spdrO : P.spdrM);
      }
      return;
    }

    const mput = mirrorX(rawPut);
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const ab  = flash ? P.white : P.spdr;   // abdomen brown
    const abD = flash ? P.white : P.spdrD;  // mottling / shadow
    const abM = flash ? P.white : P.spdrM;  // cephalothorax + legs
    const abL = flash ? P.white : P.spdrL;  // fuzz highlight
    const band = flash ? P.white : P.spdrO; // orange joints + tarsi
    const fang = flash ? P.white : P.spdrF;

    // 6-phase scuttle; attack = rear up → lunge with fangs
    const mi = f.startsWith('move') ? +f[4] : -1;
    const ai = f.startsWith('atk') ? +f[3] : -1;
    const ph = mi >= 0 ? mi : 0;
    const bob = mi >= 0 ? Math.round(Math.sin((ph / 6) * Math.PI * 2) * 1) : 0;
    const ox = ai >= 0 ? [0, 0, -3, -1][ai] : 0;       // lunge thrust (toward prey)
    const hdy = ai >= 0 ? [-1, -2, -1, 0][ai] : 0;     // body rears back/up

    // ground shadow (unrecorded)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = -9; dx <= 9; dx++)
        if ((dx * dx) / 81 + (dy * dy) / 1.2 <= 1) mput(16 + dx + ox, 27 + dy, P.shadow);

    // ---- legs ----
    // Each leg: femur up to an orange knee, tibia down to an orange tarsus.
    // [attachX, attachY, kneeX, kneeY, footX] — front legs first (low x).
    const LEGS: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [7, 19, 3, 12, 1],
      [10, 20, 7, 12, 6],
      [13, 20, 13, 12, 13],
      [16, 19, 20, 12, 24],
    ];
    // raised front-leg poses per attack frame: [knee, foot] for legs 0 and 1
    const RAISED: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
      [[3, 10, 1, 14], [7, 11, 4, 15]],   // atk0 — front legs lift
      [[3, 8, 0, 11], [7, 9, 3, 12]],     // atk1 — reared high
      [[2, 11, 0, 18], [6, 11, 2, 17]],   // atk2 — striking down mid-lunge
      [[3, 11, 1, 19], [7, 12, 5, 20]],   // atk3 — recovering
    ];
    const drawLeg = (k: number, far: boolean) => {
      let [ax2, ay2, kx, ky, fx2] = LEGS[k];
      let fy2 = far ? 24 : 25;
      if (ai >= 0 && k < 2 && !far) {
        [kx, ky, fx2, fy2] = RAISED[ai][k];   // near front legs rear up
      } else if (mi >= 0) {
        const ang = (ph / 6) * Math.PI * 2 + k * (Math.PI / 2) + (far ? Math.PI : 0);
        const swing = Math.round(Math.sin(ang) * 2);
        const lift = Math.max(0, Math.round(Math.cos(ang) * 1.2));
        kx += swing >> 1;
        fx2 += swing;
        fy2 -= lift;
      }
      const c = far ? abD : abM;
      const off = far ? 2 : 0;
      line(put, ax2 + ox + off, ay2 + bob, kx + ox + off, ky + bob, c);
      line(put, kx + ox + off, ky + bob, fx2 + ox + off, fy2, c);
      if (!far) {
        put(kx + ox, ky + bob, band);          // orange knee
        put(kx + ox, ky + 1 + bob, band);
        put(fx2 + ox, fy2, band);              // orange tarsus tip
        put(fx2 + ox, fy2 + 1, band);
      }
    };
    // far-side legs behind the body
    for (let k = 0; k < 4; k++) drawLeg(k, true);

    // ---- abdomen: big mottled ball (the reference's signature) ----
    const acx = 21 + ox, acy = 16 + bob;
    ellipse(put, acx, acy, 8, 6, ab);
    // dark mottled blotches
    disc(put, acx - 3, acy - 2, 2, abD);
    disc(put, acx + 2, acy - 1, 2, abD);
    disc(put, acx - 1, acy + 2, 1, abD);
    put(acx + 4, acy - 3, abD);
    put(acx + 5, acy + 1, abD);
    // fuzz highlight along the top, shadow along the belly
    for (let x = -5; x <= 4; x++)
      if ((x * x) / 64 < 0.9) put(acx + x, acy - 5 + ((x + 32) % 2), abL);
    for (let x = -5; x <= 5; x++) put(acx + x, acy + 5, abD);

    // ---- cephalothorax (head) ----
    const hcx = 9 + ox, hcy = 19 + bob + hdy;
    disc(put, hcx, hcy, 4, abM);
    disc(put, hcx, hcy - 1, 2, abL);            // fuzz on top
    put(hcx + 3, hcy + 2, abD);                 // shadow toward the body
    // bead-eye cluster with wet glints
    put(hcx - 3, hcy - 3, P.outline);
    put(hcx - 2, hcy - 4, P.outline);
    put(hcx - 1, hcy - 3, P.outline);
    put(hcx - 3, hcy - 2, P.outline);
    put(hcx - 2, hcy - 3, P.white);             // glint
    put(hcx - 1, hcy - 2, P.outline);
    // ---- fangs ----
    if (ai >= 0) {
      // spread wide and thrust forward with the lunge
      put(hcx - 4, hcy + 2, fang);
      put(hcx - 5, hcy + 3, fang);
      put(hcx - 6, hcy + 4, flash ? P.white : P.bronzeM);
      put(hcx - 2, hcy + 3, fang);
      put(hcx - 3, hcy + 4, fang);
      put(hcx - 4, hcy + 5, flash ? P.white : P.bronzeM);
      if (ai === 2) {                            // bite connects — venom glint
        put(hcx - 7, hcy + 5, P.white);
        put(hcx - 5, hcy + 6, P.white);
      }
    } else {
      // hanging at rest
      put(hcx - 3, hcy + 3, fang);
      put(hcx - 3, hcy + 4, fang);
      put(hcx - 3, hcy + 5, flash ? P.white : P.bronzeM);
      put(hcx - 1, hcy + 3, fang);
      put(hcx - 1, hcy + 4, fang);
      put(hcx - 1, hcy + 5, flash ? P.white : P.bronzeM);
    }

    // near-side legs over the body
    for (let k = 0; k < 4; k++) drawLeg(k, false);

    strokeOutline(px, mput);
  };
}

// ==================================================================
//  ENEMY CROW (32x32) — dark flying bird, basic river enemy
// ==================================================================
export function drawEnemyCrow(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 6 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, '#232330');
      disc(put, 16, 18, Math.max(0, r - 1), '#383850');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#1a1a28');
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : '#232330';
    const bodyD = flash ? P.white : '#141420';
    const bodyL = flash ? P.white : '#383850';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 1 : 0;
    const bob = [0, -1, -2, -1][phase];
    const wingY = [0, -2, -3, -1][phase];

    // Shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if ((dx * dx) / 25 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // Wings behind body — thick, connected
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const wy = Math.round(wingY * Math.sin(t * Math.PI));
      const th = Math.max(0, Math.round(2 - t * 1.5));
      for (let d = 0; d <= th; d++) {
        put(12 - i, 15 + bob + wy + d, bodyD);
        put(20 + i, 15 + bob + wy + d, bodyD);
      }
      put(12 - i, 15 + bob + wy, bodyL);
      put(20 + i, 15 + bob + wy, bodyL);
    }

    // Body
    disc(put, 16, 16 + bob, 5, bodyD);
    disc(put, 16, 16 + bob, 4, body);
    // Head
    disc(put, 16, 11 + bob, 3, bodyL);
    // Beak
    put(16, 14 + bob, '#c8a028');
    put(16, 15 + bob, '#b49020');
    // Eyes
    put(14, 10 + bob, flash ? P.white : '#ff5050');
    put(18, 10 + bob, flash ? P.white : '#ff5050');
    // Tail
    put(14, 22 + bob, bodyD); put(15, 23 + bob, bodyD);
    put(18, 22 + bob, bodyD); put(17, 23 + bob, bodyD);

    // Attack: beak open
    if (f === 'atk0' || f === 'atk1') {
      put(15, 14 + bob, '#c8a028'); put(17, 14 + bob, '#c8a028');
      if (f === 'atk1') put(16, 16 + bob, '#400808');
    }
  };
}

// ==================================================================
//  ENEMY BAT (32x32) — heavy flyer with large membrane wings
// ==================================================================
export function drawEnemyBat(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, r, '#3c2832');
      disc(put, 16, 18, Math.max(0, r - 1), '#5a3848');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#2a1820');
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : '#3c2832';
    const bodyD = flash ? P.white : '#2a1820';
    const bodyL = flash ? P.white : '#5a3848';
    const membrane = flash ? P.white : '#372030';
    const membraneL = flash ? P.white : '#4a3040';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 1 : 0;
    const bob = [0, -1, 0, 1][phase];
    const wingA = [0, -4, -5, -2][phase];

    // Shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // Wing membranes — large, connected to body
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const wy = 15 + bob + Math.round(wingA * Math.sin(t * Math.PI));
      const memH = Math.round(4 + Math.sin(t * Math.PI) * 4);
      for (let dy = 0; dy <= memH; dy++) {
        put(13 - i, wy + dy, membrane);
        put(19 + i, wy + dy, membrane);
      }
      // Bone along top
      put(13 - i, wy, membraneL);
      put(19 + i, wy, membraneL);
    }

    // Body
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if ((dx * dx) / 9 + (dy * dy) / 25 <= 1) put(16 + dx, 17 + bob + dy, body);
    // Head
    disc(put, 16, 11 + bob, 3, bodyL);
    // Ears
    put(13, 7 + bob, bodyL); put(13, 8 + bob, bodyL); put(14, 8 + bob, body);
    put(19, 7 + bob, bodyL); put(19, 8 + bob, bodyL); put(18, 8 + bob, body);
    // Eyes
    put(14, 11 + bob, flash ? P.white : '#ff3030');
    put(18, 11 + bob, flash ? P.white : '#ff3030');
    // Fangs
    if (f === 'atk0' || f === 'atk1') {
      put(15, 14 + bob, P.white); put(17, 14 + bob, P.white);
      if (f === 'atk1') { put(15, 15 + bob, P.white); put(17, 15 + bob, P.white); }
    } else {
      put(15, 14 + bob, '#e0e0e0'); put(17, 14 + bob, '#e0e0e0');
    }
  };
}

// ==================================================================
//  ENEMY DRAGONFLY (32x32) — fast iridescent insect
// ==================================================================
export function drawEnemyDragonfly(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 5 - step * 1.5;
      if (r <= 0) return;
      disc(put, 16, 16, Math.max(0, Math.round(r)), '#28a0b4');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(16 + Math.sin(a) * d), '#1a708a');
      }
      return;
    }
    const flash = f === 'hit';
    const bodyC = flash ? P.white : '#28a0b4';
    const bodyD = flash ? P.white : '#1a708a';
    const bodyL = flash ? P.white : '#38c0d8';
    const wingC = flash ? P.white : '#80d8e8';
    const wingD = flash ? P.white : '#60b8cc';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 1 : 0;
    const bob = [0, -1, -2, -1][phase];
    const wingA = [0, -2, -3, -1][phase];
    const wingA2 = Math.round(-wingA * 0.5);

    // Shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if ((dx * dx) / 25 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // Upper wings — attached to thorax
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const wy = Math.round(wingA * t);
      const th = Math.max(0, Math.round(1.5 - t));
      for (let d = 0; d <= th; d++) {
        put(14 - i, 11 + bob + wy + d, wingD);
        put(18 + i, 11 + bob + wy + d, wingD);
      }
      put(14 - i, 11 + bob + wy, wingC);
      put(18 + i, 11 + bob + wy, wingC);
    }
    // Lower wings
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const wy = Math.round(wingA2 * t);
      put(14 - i, 14 + bob + wy, wingD);
      put(18 + i, 14 + bob + wy, wingD);
    }

    // Long segmented body (abdomen)
    for (let i = 0; i < 12; i++) {
      const c = i < 4 ? bodyL : i < 8 ? bodyC : bodyD;
      put(16, 10 + i + bob, c);
      if (i < 6) { put(15, 10 + i + bob, bodyD); put(17, 10 + i + bob, bodyD); }
    }
    // Head
    disc(put, 16, 9 + bob, 2, bodyL);
    // Big compound eyes
    put(14, 8 + bob, flash ? P.white : '#c83030');
    put(18, 8 + bob, flash ? P.white : '#c83030');

    // Attack: abdomen curls forward
    if (f === 'atk0' || f === 'atk1') {
      put(16, 22 + bob, bodyD);
      if (f === 'atk1') put(16, 23 + bob, '#ff6060');
    }
  };
}

// ==================================================================
//  ENEMY MOSQUITO (32x32) — ranged attacker, shoots darts
// ==================================================================
export function drawEnemyMosquito(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 5 - step * 1.5;
      if (r <= 0) return;
      disc(put, 16, 17, Math.max(0, Math.round(r)), '#504638');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(17 + Math.sin(a) * d), '#3a3028');
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : '#504638';
    const bodyD = flash ? P.white : '#3a3028';
    const bodyL = flash ? P.white : '#685a48';
    const wingC = flash ? P.white : '#b4c8d8';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 1 : 0;
    const bob = [-1, 0, 1, 0][phase];
    const wingA = [2, -2, 2, -2][phase]; // fast flapping

    // Shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -4; dx <= 4; dx++)
        if ((dx * dx) / 16 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // Wings — fast blur, attached to thorax
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const wy = Math.round(wingA * Math.sin(t * Math.PI));
      const th = Math.max(0, Math.round(1 - t * 0.8));
      for (let d = 0; d <= th; d++) {
        put(14 - i, 13 + bob + wy + d, wingC);
        put(18 + i, 13 + bob + wy + d, wingC);
      }
    }

    // Body (thin abdomen)
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if ((dx * dx) / 4 + (dy * dy) / 16 <= 1) put(16 + dx, 17 + bob + dy, body);
    // Lighter thorax
    disc(put, 16, 14 + bob, 2, bodyL);
    // Head
    disc(put, 16, 11 + bob, 2, bodyL);
    // Proboscis — long needle pointing down/forward
    put(16, 13 + bob, '#a08060');
    put(16, 9 + bob, '#a08060');
    put(16, 8 + bob, '#807050');
    // Eyes
    put(14, 10 + bob, flash ? P.white : '#c80000');
    put(18, 10 + bob, flash ? P.white : '#c80000');
    // Dangly legs
    put(14, 19 + bob, bodyD); put(13, 21 + bob, bodyD);
    put(18, 19 + bob, bodyD); put(19, 21 + bob, bodyD);
    put(15, 20 + bob, bodyD); put(14, 22 + bob, bodyD);
    put(17, 20 + bob, bodyD); put(18, 22 + bob, bodyD);

    // Attack animation: proboscis extends, dart fires
    if (f === 'atk0') {
      put(16, 7 + bob, '#c0a060');
      put(16, 6 + bob, '#c0a060');
    } else if (f === 'atk1') {
      put(16, 7 + bob, '#e0c080');
      put(16, 6 + bob, '#e0c080');
      put(16, 5 + bob, '#60c040'); // venom glow at tip
    }
  };
}

// ==================================================================
//  MOSQUITO DART (16x16) — small slow-moving venom projectile
// ==================================================================
export function drawMosquitoDart(f: 'dart0' | 'dart1') {
  return (put: Put) => {
    // Small venom droplet with a tail
    const c1 = f === 'dart0' ? '#60c040' : '#80d060';
    const c2 = f === 'dart0' ? '#408030' : '#50a040';
    const tail = f === 'dart0' ? '#304020' : '#405028';
    // Body of dart — pointed
    put(6, 8, c1); put(7, 8, c1); put(8, 8, c1); put(9, 8, c1);
    put(7, 7, c2); put(8, 7, c1); put(9, 7, c2);
    put(7, 9, c2); put(8, 9, c1); put(9, 9, c2);
    // Tip
    put(10, 8, c1); put(11, 8, c2);
    // Venom glow
    put(8, 8, '#a0ff80');
    // Trail
    put(4, 8, tail); put(5, 8, tail);
    put(3, 7, tail); put(3, 9, tail);
  };
}

// ==================================================================
//  BIRD POOP (16x16) — white splat with dark speckles
// ==================================================================
export function drawBirdPoop() {
  return (put: Put) => {
    // White irregular blob
    disc(put, 8, 8, 4, '#e8e8e0');
    disc(put, 8, 8, 3, '#f4f4ec');
    disc(put, 7, 9, 2, '#e0e0d8');
    disc(put, 9, 7, 2, '#f0f0e8');
    // Splat edges — irregular
    put(4, 8, '#deded6'); put(12, 8, '#deded6');
    put(8, 4, '#deded6'); put(8, 12, '#deded6');
    put(5, 6, '#e8e8e0'); put(11, 10, '#e8e8e0');
    put(6, 11, '#e0e0d8'); put(10, 5, '#e0e0d8');
    // Dark speckles
    put(7, 7, '#3a3a30'); put(9, 9, '#2a2a20');
    put(6, 8, '#3a3a30'); put(10, 7, '#2a2a20');
    put(8, 10, '#444438');
    // Slight highlight
    put(7, 6, '#ffffff'); put(8, 7, '#fafaf4');
  };
}

// ==================================================================
//  SKELETON SOLDIER (32x32) — bone-white warrior with rusty sword
// ==================================================================
export function drawEnemySkeleton(f: EFrame) {
  return (rawPut: Put) => {
    const put = f.startsWith('die') ? rawPut : mirrorX(rawPut);
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, Math.max(0, r), '#d8d0c0');
      disc(put, 16, 18, Math.max(0, r - 2), '#c8c0a8');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#b8b098');
      }
      return;
    }
    const flash = f === 'hit';
    const bone = flash ? P.white : '#d8d0c0';
    const boneD = flash ? P.white : '#c8c0a8';
    const boneDD = flash ? P.white : '#b8b098';
    const cloth = flash ? P.white : '#3a4a5a';
    const sword = flash ? P.white : '#8892a0';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 2 : 0;
    const bob = [0, -1, 0, 1][phase];

    // Skull
    rect(put, 14, 4 + bob, 5, 5, bone);
    rect(put, 15, 3 + bob, 3, 1, bone);
    // Eye sockets
    put(14, 6 + bob, P.outline); put(15, 6 + bob, P.outline);
    put(17, 6 + bob, P.outline); put(18, 6 + bob, P.outline);
    // Nose
    put(16, 7 + bob, boneDD);
    // Jaw
    rect(put, 14, 9 + bob, 5, 1, boneD);
    put(14, 9 + bob, boneDD); put(18, 9 + bob, boneDD);

    // Spine
    rect(put, 16, 10 + bob, 1, 3, boneD);

    // Ribcage
    rect(put, 13, 11 + bob, 7, 4, boneD);
    // Rib gaps
    put(14, 12 + bob, cloth); put(18, 12 + bob, cloth);
    put(14, 14 + bob, cloth); put(18, 14 + bob, cloth);
    put(16, 12 + bob, cloth); put(16, 14 + bob, cloth);

    // Tattered cloth around waist
    rect(put, 13, 15 + bob, 7, 3, cloth);
    put(13, 17 + bob, null); put(15, 17 + bob, null); put(19, 17 + bob, null);

    // Arms — bone segments
    // Left arm
    put(12, 11 + bob, boneD); put(11, 12 + bob, boneD); put(10, 13 + bob, boneD);
    // Right arm holding sword
    put(20, 11 + bob, boneD); put(21, 12 + bob, boneD); put(22, 13 + bob, boneD);

    // Sword in right hand
    if (f === 'atk0') {
      // Sword raised
      put(22, 10 + bob, sword); put(22, 9 + bob, sword); put(22, 8 + bob, sword);
      put(22, 7 + bob, sword); put(22, 6 + bob, '#a0a8b8');
    } else if (f === 'atk1') {
      // Sword swung down
      put(23, 14 + bob, sword); put(24, 15 + bob, sword); put(25, 16 + bob, sword);
      put(26, 17 + bob, sword); put(27, 18 + bob, '#a0a8b8');
    } else {
      // Sword at rest, angled
      put(23, 12 + bob, sword); put(24, 11 + bob, sword); put(25, 10 + bob, sword);
      put(26, 9 + bob, sword); put(27, 8 + bob, '#a0a8b8');
    }

    // Legs — bone with cloth
    const legOff = [0, 1, 0, -1][phase];
    // Left leg
    put(14, 18 + bob, boneD); put(14, 19 + bob + legOff, boneD);
    put(14, 20 + bob + legOff, boneD); put(14, 21 + bob + legOff, boneD);
    put(13, 22 + bob + legOff, boneDD); put(14, 22 + bob + legOff, boneDD);
    // Right leg
    put(18, 18 + bob, boneD); put(18, 19 + bob - legOff, boneD);
    put(18, 20 + bob - legOff, boneD); put(18, 21 + bob - legOff, boneD);
    put(17, 22 + bob - legOff, boneDD); put(18, 22 + bob - legOff, boneDD);
  };
}

// ==================================================================
//  WARLOCK (32x32) — dark robed magic caster with glowing purple eyes
// ==================================================================
export function drawEnemyWarlock(f: EFrame) {
  return (rawPut: Put) => {
    const put = f.startsWith('die') ? rawPut : mirrorX(rawPut);
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, Math.max(0, r), '#2a0a3a');
      disc(put, 16, 18, Math.max(0, r - 2), '#3a1a4a');
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + step * 0.6;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#aa40ff');
      }
      return;
    }
    const flash = f === 'hit';
    const robe = flash ? P.white : '#2a0a3a';
    const robeM = flash ? P.white : '#3a1a4a';
    const glow = flash ? P.white : '#aa40ff';
    const glowL = flash ? P.white : '#dd80ff';
    const hands = flash ? P.white : '#6a8a5a';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 2 : 0;
    const bob = [0, -1, 0, 1][phase];

    // Hood
    rect(put, 13, 4 + bob, 7, 6, robe);
    rect(put, 12, 5 + bob, 1, 4, robe);
    rect(put, 20, 5 + bob, 1, 4, robe);
    rect(put, 14, 3 + bob, 5, 1, robeM);

    // Face shadow inside hood
    rect(put, 14, 6 + bob, 5, 3, '#1a0828');

    // Glowing purple eyes
    put(15, 7 + bob, glow); put(17, 7 + bob, glow);
    put(15, 6 + bob, glowL); put(17, 6 + bob, glowL);

    // Robe body
    rect(put, 13, 10 + bob, 7, 8, robe);
    rect(put, 12, 12 + bob, 1, 6, robeM);
    rect(put, 20, 12 + bob, 1, 6, robeM);
    // Robe flare at bottom
    rect(put, 11, 18 + bob, 11, 3, robe);
    rect(put, 12, 21 + bob, 9, 1, robeM);
    // Ragged bottom edge
    put(11, 20 + bob, null); put(21, 20 + bob, null);
    put(13, 21 + bob, null); put(19, 21 + bob, null);

    // Staff in left hand
    put(11, 8 + bob, '#5a3a1a'); put(11, 9 + bob, '#5a3a1a');
    put(11, 10 + bob, '#5a3a1a'); put(11, 11 + bob, '#5a3a1a');
    put(11, 12 + bob, '#5a3a1a'); put(11, 13 + bob, '#5a3a1a');
    put(11, 14 + bob, '#5a3a1a'); put(11, 15 + bob, '#5a3a1a');
    put(11, 16 + bob, '#5a3a1a'); put(11, 17 + bob, '#5a3a1a');
    // Crystal on top
    put(11, 6 + bob, glow); put(11, 5 + bob, glowL);
    put(10, 6 + bob, glow); put(12, 6 + bob, glow);
    put(11, 7 + bob, glow);

    // Left hand on staff
    put(12, 13 + bob, hands);
    // Right casting hand
    put(20, 14 + bob, hands); put(21, 14 + bob, hands);

    // Casting effect on attack
    if (f === 'atk0') {
      put(22, 13 + bob, glow); put(23, 13 + bob, glow);
      put(22, 14 + bob, glowL); put(23, 14 + bob, glow);
      put(22, 15 + bob, glow); put(23, 15 + bob, glow);
    } else if (f === 'atk1') {
      disc(put, 23, 14 + bob, 2, glowL);
      put(25, 14 + bob, glow); put(26, 14 + bob, glow);
      put(23, 12 + bob, glow); put(23, 16 + bob, glow);
    }

    // Robe sway on walk
    const legOff = [0, 1, 0, -1][phase];
    put(14, 21 + bob + legOff, robeM);
    put(18, 21 + bob - legOff, robeM);
  };
}

// ==================================================================
//  GOLEM (32x32) — massive stone guardian with glowing orange runes
// ==================================================================
export function drawEnemyGolem(f: EFrame) {
  return (rawPut: Put) => {
    const put = f.startsWith('die') ? rawPut : mirrorX(rawPut);
    // Darker basalt/obsidian palette — the previous mid-grey '#5a6270' and
    // '#636d7a' were two of the four castle flagstone shades, so the golem
    // disappeared into the floor on the castle level.
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 16, Math.max(0, r), '#2c303a');
      disc(put, 16, 16, Math.max(0, r - 2), '#3c4250');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(16 + Math.sin(a) * d), '#ffa020');
      }
      return;
    }
    const flash = f === 'hit';
    const stone = flash ? P.white : '#2c303a';
    const stoneD = flash ? P.white : '#1c1f26';
    const stoneL = flash ? P.white : '#3c4250';
    const rune = flash ? P.white : '#ffa020';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 2 : 0;
    const bob = [0, -1, 0, 1][phase];

    // Massive blocky head
    rect(put, 12, 2 + bob, 9, 7, stone);
    rect(put, 13, 1 + bob, 7, 1, stoneL);
    // Glowing eyes
    put(14, 5 + bob, rune); put(15, 5 + bob, rune);
    put(18, 5 + bob, rune); put(19, 5 + bob, rune);
    // Brow ridge
    rect(put, 13, 4 + bob, 7, 1, stoneD);
    // Jaw
    rect(put, 13, 8 + bob, 7, 1, stoneD);

    // Massive torso
    rect(put, 10, 9 + bob, 13, 10, stone);
    rect(put, 9, 10 + bob, 1, 8, stoneD);
    rect(put, 23, 10 + bob, 1, 8, stoneD);
    // Chest rune lines
    put(16, 11 + bob, rune); put(16, 12 + bob, rune); put(16, 13 + bob, rune);
    put(14, 12 + bob, rune); put(18, 12 + bob, rune);
    put(13, 13 + bob, rune); put(19, 13 + bob, rune);

    // Shoulders (blocky)
    rect(put, 7, 9 + bob, 3, 4, stoneL);
    rect(put, 23, 9 + bob, 3, 4, stoneL);

    // Arms
    const atkSwing = f === 'atk1' ? 3 : 0;
    // Left arm
    rect(put, 7, 13 + bob, 3, 5, stone);
    put(7, 18 + bob, stoneD); put(8, 18 + bob, stoneD); put(9, 18 + bob, stoneD);
    // Right arm
    rect(put, 23, 13 + bob - atkSwing, 3, 5, stone);
    put(23, 18 + bob - atkSwing, stoneD); put(24, 18 + bob - atkSwing, stoneD); put(25, 18 + bob - atkSwing, stoneD);

    // Arm runes
    put(8, 15 + bob, rune);
    put(24, 15 + bob - atkSwing, rune);

    // Legs — thick pillars
    const legOff = [0, 1, 0, -1][phase];
    // Left leg
    rect(put, 11, 19 + bob, 4, 5 + legOff, stone);
    rect(put, 11, 24 + bob + legOff, 5, 1, stoneD);
    // Right leg
    rect(put, 18, 19 + bob, 4, 5 - legOff, stone);
    rect(put, 17, 24 + bob - legOff, 5, 1, stoneD);
    // Leg runes
    put(13, 21 + bob + legOff, rune);
    put(19, 21 + bob - legOff, rune);

    // Attack: fist glow
    if (f === 'atk0') {
      put(24, 17 + bob, rune); put(25, 17 + bob, rune);
    } else if (f === 'atk1') {
      put(24, 14 + bob, rune); put(25, 14 + bob, rune);
      put(23, 15 + bob, rune); put(26, 15 + bob, rune);
    }
  };
}

// ==================================================================
//  SHADOW IMP (32x32) — small dark fiend with horns, orange eyes
// ==================================================================
export function drawEnemyShadowImp(f: EFrame) {
  return (rawPut: Put) => {
    const put = f.startsWith('die') ? rawPut : mirrorX(rawPut);
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 6 - step * 1.5;
      if (r <= 0) return;
      disc(put, 16, 20, Math.max(0, Math.round(r)), '#1a1028');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + step * 0.6;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(20 + Math.sin(a) * d), '#3a2a48');
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : '#1a1028';
    const bodyM = flash ? P.white : '#2a1a38';
    const bodyL = flash ? P.white : '#3a2a48';
    const eyes = flash ? P.white : '#ff8800';
    const grin = flash ? P.white : '#ff4040';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 2 : 0;
    const bob = [0, -1, 0, 1][phase];

    // Shadow on ground
    for (let dy = -1; dy <= 0; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= 3) put(16 + dx, 27 + dy, P.shadow);

    // Small body
    disc(put, 16, 18 + bob, 4, body);
    disc(put, 16, 18 + bob, 3, bodyM);

    // Head
    disc(put, 16, 12 + bob, 4, bodyM);
    disc(put, 16, 12 + bob, 3, bodyL);

    // Horns
    put(12, 10 + bob, bodyL); put(11, 9 + bob, bodyL); put(10, 8 + bob, body);
    put(20, 10 + bob, bodyL); put(21, 9 + bob, bodyL); put(22, 8 + bob, body);

    // Eyes — bright orange
    put(14, 12 + bob, eyes); put(18, 12 + bob, eyes);
    // Eye glow
    put(14, 11 + bob, '#ffaa44'); put(18, 11 + bob, '#ffaa44');

    // Red grin
    put(14, 14 + bob, grin); put(15, 14 + bob, grin); put(16, 14 + bob, grin);
    put(17, 14 + bob, grin); put(18, 14 + bob, grin);

    // Thin arms
    put(11, 17 + bob, bodyL); put(10, 18 + bob, bodyL); put(9, 19 + bob, bodyL);
    put(21, 17 + bob, bodyL); put(22, 18 + bob, bodyL); put(23, 19 + bob, bodyL);

    // Claws
    put(8, 19 + bob, grin); put(9, 20 + bob, grin);
    put(24, 19 + bob, grin); put(23, 20 + bob, grin);

    // Small legs
    const legOff = [0, 1, 0, -1][phase];
    put(14, 22 + bob + legOff, bodyL); put(14, 23 + bob + legOff, bodyL);
    put(13, 24 + bob + legOff, body);
    put(18, 22 + bob - legOff, bodyL); put(18, 23 + bob - legOff, bodyL);
    put(19, 24 + bob - legOff, body);

    // Pointed tail
    put(16, 22 + bob, body); put(17, 23 + bob, body); put(18, 24 + bob, bodyL);
    put(19, 25 + bob, bodyL);

    // Smoky wisps
    if (phase % 2 === 0) {
      put(13, 20 + bob, bodyL); put(19, 16 + bob, bodyL);
    } else {
      put(19, 20 + bob, bodyL); put(13, 16 + bob, bodyL);
    }

    // Attack: claws forward
    if (f === 'atk0') {
      put(8, 17 + bob, grin); put(7, 17 + bob, grin);
      put(24, 17 + bob, grin); put(25, 17 + bob, grin);
    } else if (f === 'atk1') {
      put(7, 16 + bob, grin); put(6, 15 + bob, grin);
      put(25, 16 + bob, grin); put(26, 15 + bob, grin);
    }
  };
}

// ==================================================================
//  CASTLE BAT (32x32) — dark bat with spread wings, red eyes, fangs
// ==================================================================
export function drawEnemyCastleBat(f: EFrame) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 18, Math.max(0, r), '#2a1a2a');
      disc(put, 16, 18, Math.max(0, r - 1), '#3a2a3a');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.4;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#1a0a1a');
      }
      return;
    }
    const flash = f === 'hit';
    const body = flash ? P.white : '#2a1a2a';
    const bodyD = flash ? P.white : '#1a0a1a';
    const bodyL = flash ? P.white : '#3a2a3a';
    const membrane = flash ? P.white : '#221428';
    const membraneL = flash ? P.white : '#3a2838';
    const eyeC = flash ? P.white : '#ff2020';
    const fang = flash ? P.white : '#d8d0c0';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 1 : 0;
    const bob = [0, -1, 0, 1][phase];
    const wingA = [0, -5, -6, -3][phase];

    // Shadow
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) put(16 + dx, 28 + dy, P.shadow);

    // Wing membranes
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const wy = 15 + bob + Math.round(wingA * Math.sin(t * Math.PI));
      const memH = Math.round(3 + Math.sin(t * Math.PI) * 4);
      for (let dy = 0; dy <= memH; dy++) {
        put(12 - i, wy + dy, membrane);
        put(20 + i, wy + dy, membrane);
      }
      // Wing bones
      put(12 - i, wy, membraneL);
      put(20 + i, wy, membraneL);
    }
    // Wing claw tips
    put(0, 15 + bob + wingA, bodyL);
    put(31, 15 + bob + wingA, bodyL);

    // Body — oval
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if ((dx * dx) / 9 + (dy * dy) / 16 <= 1) put(16 + dx, 17 + bob + dy, body);
    // Lighter belly
    for (let dy = 0; dy <= 3; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if ((dx * dx) / 4 + (dy * dy) / 9 <= 1) put(16 + dx, 18 + bob + dy, bodyL);

    // Head
    disc(put, 16, 11 + bob, 3, bodyL);
    disc(put, 16, 11 + bob, 2, body);

    // Pointed ears
    put(12, 8 + bob, bodyL); put(12, 7 + bob, bodyL); put(13, 9 + bob, bodyL);
    put(20, 8 + bob, bodyL); put(20, 7 + bob, bodyL); put(19, 9 + bob, bodyL);

    // Red eyes
    put(14, 11 + bob, eyeC); put(18, 11 + bob, eyeC);
    // Eye glow
    put(14, 10 + bob, '#ff4040'); put(18, 10 + bob, '#ff4040');

    // Fangs
    put(15, 14 + bob, fang); put(17, 14 + bob, fang);
    if (f === 'atk0' || f === 'atk1') {
      put(15, 15 + bob, fang); put(17, 15 + bob, fang);
      if (f === 'atk1') {
        put(15, 16 + bob, fang); put(17, 16 + bob, fang);
      }
    }

    // Mouth
    put(15, 13 + bob, bodyD); put(16, 13 + bob, bodyD); put(17, 13 + bob, bodyD);
  };
}

// ==================================================================
//  CASTLE RAT (32x32) — plague rat, dark castle themed
// ==================================================================
export function drawEnemyCastleRat(f: EFrame) {
  return (rawPut: Put) => {
    const put = f.startsWith('die') ? rawPut : mirrorX(rawPut);
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 7 - step * 2;
      if (r <= 0) return;
      disc(put, 16, 20, Math.max(0, r), '#4a3a2a');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + step * 0.5;
        const d = step * 3 + 2;
        put(Math.round(16 + Math.cos(a) * d), Math.round(20 + Math.sin(a) * d), '#5a4a38');
      }
      return;
    }
    const flash = f === 'hit';
    const bodyA = flash ? P.white : '#4a3a2a';
    const bodyB = flash ? P.white : '#5a4a38';
    const bodyC = flash ? P.white : '#3a2a1a';
    const tail = flash ? P.white : '#6a5a48';

    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 :
                  f === 'atk0' ? 0 : f === 'atk1' ? 2 : 0;

    const rats = [
      { x: 10, y: 19 + [0, 1, 0, -1][phase], c: bodyA },
      { x: 16, y: 17 + [0, -1, 0, 1][(phase + 1) % 4], c: bodyB },
      { x: 14, y: 22 + [0, 1, 0, -1][(phase + 2) % 4], c: bodyA },
    ];

    // Tails first (behind)
    for (let i = 0; i < rats.length; i++) {
      const r = rats[i];
      const tw = [0, 1, 0, -1][(phase + i) % 4];
      put(r.x + 6, r.y + 1 + tw, tail);
      put(r.x + 7, r.y + tw, tail);
      put(r.x + 8, r.y + tw, tail);
      put(r.x + 9, r.y - 1 + tw, tail);
    }

    // Rat bodies
    for (let i = 0; i < rats.length; i++) {
      const r = rats[i];
      const legOff = [0, 1, 0, 1][(phase + i) % 4];
      // Body
      rect(put, r.x, r.y, 7, 4, r.c);
      rect(put, r.x + 1, r.y - 1, 5, 1, r.c);
      // Darker stripe
      rect(put, r.x + 1, r.y, 5, 1, bodyC);
      // Legs
      put(r.x, r.y + 4 - legOff, bodyC);
      put(r.x + 1, r.y + 4 - legOff, bodyC);
      put(r.x + 5, r.y + 4 + legOff, bodyC);
      put(r.x + 6, r.y + 4 + legOff, bodyC);
      // Head
      rect(put, r.x - 2, r.y, 3, 3, r.c);
      // Ear
      put(r.x - 1, r.y - 1, '#8a6a5a');
      // Eye — red
      put(r.x - 2, r.y + 1, '#ff2020');
      // Pink nose
      put(r.x - 3, r.y + 1, '#e0a0a0');
    }
  };
}

type DesertEnemyVariant = 'scorpion' | 'boss_scorpion' | 'scarab' | 'sand_mite' | 'cactus_hopper' | 'dune_strider' | 'sand_wraith' | 'temple_guardian' | 'sun_mote';

export function drawEnemyDesert(f: EFrame, variant: DesertEnemyVariant) {
  return (put: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 8 - step * 2;
      if (r <= 0) return;
      const col = variant === 'sun_mote' ? '#ffd45a'
        : variant === 'boss_scorpion' ? '#7f9a38'
        : variant === 'cactus_hopper' ? '#4f8a3a'
        : '#b88442';
      disc(put, 16, 18, Math.max(0, r), col);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + step * 0.45;
        const d = step * 3 + 3;
        put(Math.round(16 + Math.cos(a) * d), Math.round(18 + Math.sin(a) * d), '#6a4528');
      }
      return;
    }
    const flash = f === 'hit';
    const phase = f === 'move0' ? 0 : f === 'move1' ? 1 : f === 'move2' ? 2 : f === 'move3' ? 3 : 0;
    const bob = [0, -1, 0, 1][phase];
    const attack = f === 'atk0' || f === 'atk1';
    const palettes: Record<DesertEnemyVariant, { d: string; m: string; l: string; hi: string }> = {
      scorpion: { d: '#4a2512', m: '#9a5a24', l: '#d08a3a', hi: '#ffcf70' },
      boss_scorpion: { d: '#273018', m: '#5f6f2f', l: '#9bb84a', hi: '#e4f080' },
      scarab: { d: '#153a38', m: '#2f5c58', l: '#56a29a', hi: '#b8f0d8' },
      sand_mite: { d: '#6a4218', m: '#c8943e', l: '#f0c060', hi: '#fff0a0' },
      cactus_hopper: { d: '#245024', m: '#4f8a3a', l: '#87bf5c', hi: '#e0f0c8' },
      dune_strider: { d: '#6a4920', m: '#d0a45a', l: '#f0ca78', hi: '#fff0b8' },
      sand_wraith: { d: '#4a3c30', m: '#b8a070', l: '#e0d0a0', hi: '#fff0c8' },
      temple_guardian: { d: '#4d3820', m: '#b89052', l: '#d8b878', hi: '#fff0a0' },
      sun_mote: { d: '#9a4a10', m: '#ffb82e', l: '#ffe070', hi: '#ffffff' },
    };
    const pal = palettes[variant];
    const d = flash ? P.white : pal.d;
    const m = flash ? P.white : pal.m;
    const l = flash ? P.white : pal.l;
    const hi = flash ? P.white : pal.hi;

    if (variant === 'scorpion' || variant === 'boss_scorpion') {
      const small = variant === 'boss_scorpion';
      disc(put, 15, 18 + bob, small ? 5 : 7, d);
      disc(put, 15, 17 + bob, small ? 4 : 6, m);
      rect(put, 20, 12 + bob, 3, small ? 6 : 8, d);
      rect(put, 21, 10 + bob, small ? 3 : 4, 3, m);
      put(25, 11 + bob, attack ? hi : small ? '#d9f06a' : '#d04020');
      for (let i = 0; i < 4; i++) {
        line(put, 9 + i * 3, 20 + bob, 5 + i * 2, 23 + ((i + phase) % 2), d);
        line(put, 18 + i * 2, 20 + bob, 25 + i, 23 + ((i + phase + 1) % 2), d);
      }
      put(12, 15 + bob, P.outline); put(18, 15 + bob, P.outline);
      return;
    }
    if (variant === 'scarab') {
      disc(put, 16, 18 + bob, 8, d);
      disc(put, 16, 17 + bob, 7, m);
      rect(put, 10, 16 + bob, 12, 1, hi);
      rect(put, 15, 10 + bob, 2, 13, d);
      rect(put, 9, 22 + bob, 14, 2, d);
      put(12, 14 + bob, '#ffd84a'); put(20, 14 + bob, '#ffd84a');
      return;
    }
    if (variant === 'sand_mite') {
      for (let i = 0; i < 4; i++) {
        disc(put, 10 + i * 4, 18 + ((i + phase) % 2) + bob, i === 1 || i === 2 ? 4 : 3, i % 2 ? m : l);
      }
      for (let i = 0; i < 6; i++) {
        const x = 7 + i * 3;
        put(x, 23 + ((i + phase) % 2), d);
        put(x + 1, 24 + ((i + phase) % 2), d);
      }
      put(8, 16 + bob, P.outline); put(9, 16 + bob, hi);
      return;
    }
    if (variant === 'cactus_hopper') {
      rect(put, 12, 11 + bob, 8, 14, d);
      rect(put, 13, 10 + bob, 7, 15, m);
      rect(put, 16, 10 + bob, 1, 14, hi);
      rect(put, 8, 17 + bob, 4, 3, m);
      rect(put, 20, 15 + bob, 4, 3, m);
      rect(put, 11, 25 + bob, 5, 3, d);
      rect(put, 18, 25 - bob, 5, 3, d);
      put(14, 14 + bob, P.outline); put(19, 14 + bob, P.outline);
      return;
    }
    if (variant === 'dune_strider') {
      disc(put, 16, 15 + bob, 5, m);
      rect(put, 12, 19 + bob, 8, 5, l);
      for (let i = 0; i < 6; i++) {
        const legX = 8 + i * 3;
        line(put, 15, 21 + bob, legX, 27 + ((i + phase) % 2), d);
      }
      rect(put, 11, 12 + bob, 10, 1, hi);
      put(13, 15 + bob, P.outline); put(19, 15 + bob, P.outline);
      return;
    }
    if (variant === 'sand_wraith') {
      ellipse(put, 16, 16 + bob, 8, 10, d);
      ellipse(put, 16, 15 + bob, 7, 9, m);
      for (let i = 0; i < 5; i++) {
        const x = 10 + i * 3;
        line(put, x, 23 + bob, x - 2 + phase, 28, i % 2 ? d : l);
      }
      put(13, 14 + bob, '#64c8ff'); put(19, 14 + bob, '#64c8ff');
      if (attack) rect(put, 12, 19 + bob, 8, 2, P.outline);
      return;
    }
    if (variant === 'temple_guardian') {
      rect(put, 9, 12 + bob, 14, 13, d);
      rect(put, 10, 11 + bob, 12, 13, m);
      rect(put, 11, 12 + bob, 10, 2, l);
      rect(put, 11, 19 + bob, 10, 2, d);
      rect(put, 7, 24 + bob, 7, 4, d);
      rect(put, 18, 24 - bob, 7, 4, d);
      put(12, 16 + bob, '#40e0ff'); put(20, 16 + bob, '#40e0ff');
      return;
    }
    // sun_mote
    disc(put, 16, 16 + bob, attack ? 7 : 6, d);
    disc(put, 16, 16 + bob, attack ? 6 : 5, m);
    disc(put, 16, 16 + bob, 3, hi);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + phase * 0.25;
      line(put,
        Math.round(16 + Math.cos(a) * 7),
        Math.round(16 + bob + Math.sin(a) * 7),
        Math.round(16 + Math.cos(a) * 10),
        Math.round(16 + bob + Math.sin(a) * 10),
        l);
    }
  };
}

export function drawSunBolt(frame: 0 | 1) {
  return (put: Put) => {
    const shift = frame === 0 ? 0 : 1;
    line(put, 3, 8 + shift, 12, 8 - shift, '#fff0a0');
    line(put, 4, 9 + shift, 13, 9 - shift, '#ffb82e');
    line(put, 5, 7 + shift, 11, 5 - shift, '#ffd84a');
    disc(put, 12, 8 - shift, 2, '#ffffff');
  };
}

// ==================================================================
//  WARLOCK MAGIC BOLT (32x32) — purple orb projectile
// ==================================================================
export function drawWarlockBolt(f: 'bolt0' | 'bolt1') {
  return (put: Put) => {
    const phase = f === 'bolt0' ? 0 : 1;
    const glow = '#aa40ff';
    const glowL = '#dd80ff';
    const core = '#ffffff';
    const trail = '#6a20c0';

    // Outer glow
    disc(put, 16, 16, 5, trail);
    disc(put, 16, 16, 4, glow);
    disc(put, 16, 16, 2, glowL);
    // Core
    put(16, 16, core); put(15, 16, core); put(17, 16, core);
    put(16, 15, core); put(16, 17, core);

    // Sparkle effect rotating between frames
    if (phase === 0) {
      put(12, 16, glowL); put(20, 16, glowL);
      put(16, 12, glowL); put(16, 20, glowL);
    } else {
      put(13, 13, glowL); put(19, 13, glowL);
      put(13, 19, glowL); put(19, 19, glowL);
    }

    // Trail wisps
    put(10, 16 + (phase === 0 ? -1 : 1), trail);
    put(9, 16, trail);
    put(8, 16 + (phase === 0 ? 1 : -1), trail);
  };
}
