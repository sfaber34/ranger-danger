// Bear is its own thing: bigger than the other ground enemies, has a unique
// 8-frame walk cycle, and uses a dedicated PB palette so the colour scheme
// stays consistent across all bear frames without bleeding into other art.

import Phaser from 'phaser';
import { Put, P, mirrorX, strokeOutline, rect, disc, line, makeCanvas, add } from './canvas';

// ==================================================================
//  ENEMY BEAR (32x32) — shaggy grizzly, side profile
// ==================================================================
export type BearFrame =
  | 'move0' | 'move1' | 'move2' | 'move3' | 'move4' | 'move5' | 'move6' | 'move7'
  | 'atk0' | 'atk1' | 'atk2' | 'atk3' | 'atk4'
  | 'hit'
  | 'die0' | 'die1' | 'die2' | 'die3';

export const bearFrames: BearFrame[] = [
  'move0','move1','move2','move3','move4','move5','move6','move7',
  'atk0','atk1','atk2','atk3','atk4',
  'hit',
  'die0','die1','die2','die3'
];

export const PB = {
  fur:    '#7a4e2c',   // warm mid brown
  furD:   '#4a2c14',   // dark shag streaks / lower body
  furM:   '#643c1e',
  furL:   '#9a6a3e',   // sunlit top fur
  muzzle: '#b08858',   // tan snout
  nose:   '#180c04',
  eye:    '#e8b830',   // angry amber
  claw:   '#d8c0a0',   // pale claws
};

// Draw the bear facing right; 'l' renders through a mirrored put so both
// directional texture sets come from the same art.
export function drawBearDir(f: BearFrame, dir: 'r' | 'l') {
  return (rawPut: Put) => {
    if (f.startsWith('die')) {
      const step = parseInt(f.slice(3));
      const r = 10 - step * 2;
      if (r <= 0) return;
      disc(rawPut, 16, 18, r, PB.fur);
      disc(rawPut, 16, 18, Math.max(0, r - 1), PB.furM);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + step * 0.3;
        const dd = step * 3 + 4;
        rawPut(Math.round(16 + Math.cos(a) * dd), Math.round(18 + Math.sin(a) * dd), PB.furD);
        rawPut(Math.round(16 + Math.cos(a) * dd) + 1, Math.round(18 + Math.sin(a) * dd), PB.claw);
      }
      return;
    }

    const mput = dir === 'l' ? mirrorX(rawPut) : rawPut;
    const px = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      px.add(y * 32 + x);
      mput(x, y, c);
    };

    const flash = f === 'hit';
    const fur  = flash ? P.white : PB.fur;
    const furD = flash ? P.white : PB.furD;
    const furM = flash ? P.white : PB.furM;
    const furL = flash ? P.white : PB.furL;
    const muz  = flash ? P.white : PB.muzzle;
    const claw = flash ? P.white : PB.claw;

    // Walk params — 8-frame amble, diagonal leg pairs
    const isMove = f.startsWith('move');
    const moveIdx = isMove ? parseInt(f.slice(4)) : 0;
    const phase = (moveIdx / 8) * Math.PI * 2;
    const bob = isMove ? Math.round(Math.sin(phase * 2) * 1) : 0;

    // Attack params — the paw swipe: windup → raise → SWIPE → follow → recover
    const isAtk = f.startsWith('atk');
    const atkStage = isAtk ? parseInt(f.slice(3)) : -1;
    const lunge = isAtk ? [0, 0, 1, 1, 0][atkStage] : 0;   // body presses forward
    const rear  = isAtk ? [1, 2, 1, 0, 0][atkStage] : 0;   // front end rises on the windup
    const by = 16 + bob - (rear >> 1);

    // Shadow (unrecorded)
    for (let sx = -11; sx <= 11; sx++)
      for (let sy = -1; sy <= 1; sy++)
        if ((sx * sx) / 121 + (sy * sy) <= 1) mput(16 + sx + lunge, 29 + sy, P.shadow);

    // ---- legs ----
    const legY = by + 4;
    const leg = (hipX: number, k: number, far: boolean, skip: boolean) => {
      if (skip) return;
      let dx = 0, lift = 0;
      if (isMove) {
        const ang = phase + k * (Math.PI / 2);
        dx = Math.round(Math.sin(ang) * 2);
        lift = Math.max(0, Math.round(Math.cos(ang) * 1.2));
      }
      const x = hipX + dx + lunge;
      const footY = 28 - lift;
      const c = far ? furD : furM;
      // muscled haunch at the hip
      if (!far) disc(put, x + 1, legY - 1, 2, fur);
      rect(put, x, legY, far ? 3 : 4, footY - legY, c);            // leg column
      if (!far) rect(put, x, legY, 1, footY - legY - 2, fur);      // front-lit edge
      if (!far) put(x + 3, legY + 2, furD);                        // back-of-leg shade
      rect(put, x - 1, footY, far ? 4 : 5, 1, c);                  // broad paw
      // toes — separated pale claws
      put(x + (far ? 1 : 2), footY, flash ? P.white : P.outline);
      put(x + (far ? 2 : 3), footY, claw);
      put(x + (far ? 3 : 4), footY, claw);
    };
    const swiping = isAtk;                  // near-front leg becomes the swipe arm
    leg(6, 2, true, false);                 // far rear
    leg(16, 0, true, false);                // far front
    leg(8, 0, false, false);                // near rear
    leg(18, 2, false, swiping);             // near front (lifted during the swipe)

    // ---- body: massive arched bulk, shaggy ----
    const bcx = 12 + lunge;
    disc(put, bcx - 4, by, 6, fur);                          // rump mass
    for (let yy = -6; yy <= 6; yy++)                          // mid barrel
      for (let xx = -9; xx <= 9; xx++)
        if ((xx * xx) / 81 + (yy * yy) / 36 <= 1) put(bcx + 1 + xx, by + yy, fur);
    disc(put, bcx + 6, by - 3 - rear, 5, fur);               // shoulder hump (rises on windup)
    // layered shag — long dark strokes with sunlit flecks along the back
    for (let yy = -7; yy <= 6; yy++)
      for (let xx = -10; xx <= 11; xx++) {
        const X = bcx + 1 + xx, Y = by + yy;
        if (!px.has(Y * 32 + X)) continue;
        if ((xx * 3 + yy * 7 + 64) % 9 === 0) put(X, Y, furD);
        else if ((xx * 2 + yy * 5 + 64) % 11 === 0) put(X, Y, furM);   // second streak pass
        else if (yy < -3 && (xx * 5 + yy * 3 + 64) % 7 === 0) put(X, Y, furL);
      }
    // darker low body grading into the legs
    for (let xx = -8; xx <= 7; xx++) put(bcx + 1 + xx, by + 5, furM);
    // ragged fur fringe along the belly + rump
    for (let xx = -8; xx <= 6; xx += 2) put(bcx + xx, by + 6 + ((xx + 32) % 3 === 0 ? 1 : 0), furD);
    put(bcx - 9, by + 2, furD);
    put(bcx - 10, by + 4, furD);
    put(bcx - 9, by - 3, furD);                              // rump shag
    // sunlit ridge along the spine
    for (let xx = -6; xx <= 6; xx += 1)
      if ((xx + 32) % 2 === 0) put(bcx + xx, by - 6 - ((xx > 2) ? 1 : 0), furL);
    // stub tail
    disc(put, bcx - 10, by - 2, 1, furM);

    // ---- head: BIG, held low and forward, snarling ----
    const hx = 23 + lunge, hy = 15 + bob - rear;
    disc(put, hx, hy, 5, fur);                               // bigger skull
    disc(put, hx - 1, hy - 3, 3, furL);                      // brow/crown fur
    put(hx - 4, hy + 2, furM);                               // cheek shading
    put(hx - 4, hy + 3, furD);
    put(hx - 2, hy + 4, furM);                               // jowl
    // round ears with dark inners
    disc(put, hx - 3, hy - 5, 2, furM);
    put(hx - 3, hy - 5, furD);
    put(hx - 3, hy - 6, fur);
    disc(put, hx + 1, hy - 6, 2, furM);
    put(hx + 1, hy - 6, furD);
    put(hx + 1, hy - 5, fur);
    // tan muzzle with bridge shading + big dark nose
    rect(put, hx + 3, hy - 1, 4, 4, muz);
    rect(put, hx + 3, hy - 1, 4, 1, furM);                   // bridge
    put(hx + 4, hy, flash ? P.white : '#c89868');            // muzzle light
    rect(put, hx + 6, hy - 1, 2, 2, flash ? P.white : PB.nose);
    put(hx + 5, hy + 1, furM);                               // nostril crease
    // angry amber eye under a heavy slanted brow
    rect(put, hx, hy - 3, 3, 1, furD);                       // brow ridge
    put(hx + 2, hy - 2, furD);
    put(hx + 1, hy - 2, flash ? P.white : PB.eye);
    put(hx + 2, hy - 1, flash ? P.white : P.outline);        // hard pupil corner
    // snarl — lip curled over visible teeth
    const jawOpen = atkStage >= 1 && atkStage <= 3;
    if (jawOpen) {
      rect(put, hx + 3, hy + 3, 4, 2, flash ? P.white : '#3a0808'); // open maw
      put(hx + 3, hy + 3, P.white);                          // upper fangs
      put(hx + 5, hy + 3, P.white);
      put(hx + 4, hy + 4, P.white);                          // lower fang
      put(hx + 2, hy + 3, furM);                             // jaw hinge
      put(hx + 3, hy + 5, furM);                             // dropped jaw line
    } else {
      rect(put, hx + 3, hy + 3, 4, 1, furD);                 // closed lip line
      put(hx + 4, hy + 3, P.white);                          // teeth bared in the snarl
      put(hx + 6, hy + 3, P.white);
    }

    // ---- the SWIPE: near-front paw sweeps a big arc CLOSE TO CAMERA ----
    // Drawn last so the arm + paw pass OVER the body and head.
    if (isAtk) {
      const shX = 18 + lunge, shY = by + 1;                  // shoulder pivot
      // paw arc: raised behind → high overhead → impact past the face → low → returning
      const PAW: ReadonlyArray<readonly [number, number]> = [[10, 6], [20, 3], [28, 12], [28, 20], [23, 25]];
      const [pawX0, pawY] = PAW[atkStage];
      const pawX = pawX0 + lunge;
      const elX = Math.round((shX + pawX) / 2) + (atkStage <= 1 ? -2 : 2);
      const elY = Math.round((shY + pawY) / 2) - (atkStage <= 1 ? 2 : -1);
      // thick foreleg (3px) — reads in front of everything
      line(put, shX, shY - 1, elX, elY - 1, furL);
      line(put, shX, shY, elX, elY, fur);
      line(put, shX, shY + 1, elX, elY + 1, furD);
      line(put, elX, elY - 1, pawX, pawY - 1, furL);
      line(put, elX, elY, pawX, pawY, fur);
      line(put, elX, elY + 1, pawX, pawY + 1, furD);
      // BIG paw with a pad and four spread claws
      disc(put, pawX, pawY, 3, fur);
      disc(put, pawX, pawY + 1, 1, furM);                    // pad
      put(pawX - 1, pawY - 2, furL);                         // knuckle light
      const cdx = atkStage <= 2 ? 1 : 0;                     // claws lead the swing
      const cdy = atkStage <= 1 ? -1 : 1;
      for (let k = -1; k <= 2; k++) {
        put(pawX + 3 * cdx + k, pawY + 3 * cdy, claw);
        put(pawX + 4 * cdx + k, pawY + 4 * cdy, k === 0 || k === 1 ? claw : P.outline);
      }
      // motion arc tracing the full swing on the impact frame
      if (atkStage === 2) {
        for (let a = -1.2; a <= 0.35; a += 0.22) {
          const ax2 = Math.round(shX + Math.cos(a) * 11);
          const ay2 = Math.round(shY + Math.sin(a) * 11);
          mput(ax2, ay2, a > -0.4 ? P.white : furL);
        }
        mput(pawX + 2, pawY - 3, P.white);                   // crack at the impact point
        mput(pawX + 3, pawY - 1, P.white);
      } else if (atkStage === 3) {
        mput(pawX + 2, pawY - 4, furL);                      // fading trail
        mput(pawX + 1, pawY - 7, furL);
      }
    }

    strokeOutline(px, mput);
  };
}

// Generate all bear frames procedurally (right + left facing)
export function extractBearFrames(scene: Phaser.Scene) {
  for (const f of bearFrames) {
    add(scene, `ear_${f}`, makeCanvas(32, drawBearDir(f, 'r')));
    add(scene, `eal_${f}`, makeCanvas(32, drawBearDir(f, 'l')));
  }
}
