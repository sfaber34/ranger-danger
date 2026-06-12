// Player + bow sprites. The "Ranger" hero — top-down blue-clad,
// 16-px-wide body, plus a separate bow frame that the ranger holds.
//
// drawPlayer(frame, pose):
//  - frame: 4-frame idle (breathing bob + blink), 6-frame run cycle
//    (legs scissor along x with a swing-leg lift, body dips on contact).
//  - pose: vertical aim stance picked by GameScene from the bow angle.
//    'up' tilts the head back and slides the hood; 'down' tucks the chin
//    and bends the knees into a slight crouch.

import { Put, P, rect, disc, line } from './canvas';

export type PPose = 'level' | 'up' | 'down';
export type PFrame =
  'idle0' | 'idle1' | 'idle2' | 'idle3' |
  'move0' | 'move1' | 'move2' | 'move3' | 'move4' | 'move5' |
  'shoot0' | 'shoot1' | 'hit';

// Body-bob tables (positive = torso/head sink 1 logical px, feet planted).
// Shared by drawPlayer and playerFrameBob so the bow can ride the bob.
const IDLE_BOB = [0, 1, 1, 0] as const;
const MOVE_BOB = [1, 0, 0, 1, 0, 0] as const;

/** Vertical body bob baked into a player texture frame, in world px (1 logical
 *  px = 2 physical px × 0.5 sprite scale = 1 world px). GameScene adds this to
 *  the bow/nock offsets so the arms ride the torso instead of floating. */
export function playerFrameBob(textureKey: string): number {
  const m = textureKey.match(/^p_(idle|move)_(?:up_|down_)?(\d)$/);
  if (!m) return 0;
  return (m[1] === 'idle' ? IDLE_BOB[+m[2]] : MOVE_BOB[+m[2]]) ?? 0;
}

export function drawPlayer(frame: PFrame, pose: PPose = 'level') {
  return (rawPut: Put) => {
    const cx = 16;

    // ----- shadow ellipse under feet (raw — not outlined or hit-flashed)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -6; dx <= 6; dx++)
        if ((dx * dx) / 36 + (dy * dy) / 1.5 <= 1) rawPut(cx + dx, 28 + dy, P.shadow);

    // Record body pixels so we can outline the silhouette + hit-flash it.
    const body = new Set<number>();
    const put: Put = (x, y, c) => {
      if (c == null || x < 0 || y < 0 || x >= 32 || y >= 32) return;
      body.add(y * 32 + x);
      rawPut(x, y, c);
    };

    // ----- frame parameters
    const idleIdx = frame.startsWith('idle') ? +frame[4] : frame.startsWith('shoot') ? 0 : -1;
    const moveIdx = frame.startsWith('move') ? +frame[4] : -1;
    // positive bob = torso/head sink 1px (feet stay planted)
    const bob = idleIdx >= 0 ? IDLE_BOB[idleIdx]
              : moveIdx >= 0 ? MOVE_BOB[moveIdx] : 0;
    const blink = idleIdx === 2;
    // run cycle: legs scissor along x; the swinging (airborne) leg lifts
    const strideL = moveIdx >= 0 ? [2, 1, -1, -2, -1, 1][moveIdx] : 0;
    const strideR = -strideL;
    const liftL = moveIdx === 4 || moveIdx === 5 ? -1 : 0;
    const liftR = moveIdx === 1 || moveIdx === 2 ? -1 : 0;

    // ----- pose (vertical aim stance)
    const crouch = pose === 'down' ? 1 : 0;                     // knees bend, body sinks
    const headDy = pose === 'up' ? -1 : pose === 'down' ? 1 : 0; // head tilts back / tucks
    const eyeDy = headDy;                                        // eyes track the aim
    const hoodDx = pose === 'up' ? -1 : 0;                       // hood slides back when looking up
    const brimDrop = pose === 'down' ? 1 : 0;                    // brim shades the eyes when looking down

    // ----- legs (far leg first so the near leg overlaps it)
    const leg = (x: number, lift: number, trouser: string) => {
      rect(put, x, 22 + crouch + lift, 3, 4 - crouch, trouser);
      rect(put, x, 26 + lift, 3, 1, P.woodM); // boot
      rect(put, x, 27 + lift, 3, 1, P.woodD); // sole
    };
    leg(cx - 4 + strideL, liftL, P.blueD);
    leg(cx + 1 + strideR, liftR, P.blueM);
    put(cx + 1 + strideR, 22 + crouch + liftR, P.blue); // near-thigh highlight

    // ----- torso (tunic) -----
    const torsoY = 13 + bob + crouch;
    rect(put, cx - 6, torsoY, 12, 9, P.blue);
    rect(put, cx - 6, torsoY, 12, 1, P.blueL);     // collar highlight
    rect(put, cx - 6, torsoY + 1, 1, 8, P.blueM);  // left shade
    rect(put, cx + 5, torsoY + 1, 1, 8, P.blueD);  // right shade
    rect(put, cx - 5, torsoY + 8, 10, 1, P.blueD); // hem
    put(cx, torsoY + 8, P.blueM);                  // tunic front split
    // quiver strap: left shoulder down to right hip
    line(put, cx - 5, torsoY + 1, cx + 4, torsoY + 6, P.woodD);
    // belt + buckle + hip pouch
    rect(put, cx - 6, torsoY + 6, 12, 1, P.woodD);
    put(cx, torsoY + 6, P.goldL);
    rect(put, cx + 3, torsoY + 7, 3, 2, P.wood);
    put(cx + 3, torsoY + 7, P.woodL);
    put(cx + 5, torsoY + 8, P.woodD);

    // ----- quiver tube over the left shoulder -----
    const qy = torsoY - 6;
    rect(put, cx - 9, qy, 3, 6, P.woodM);
    rect(put, cx - 9, qy, 1, 6, P.woodD); // shaded edge
    rect(put, cx - 9, qy, 3, 1, P.woodL); // rim
    // arrows peeking out
    put(cx - 8, qy - 1, P.arrow);
    put(cx - 8, qy - 2, P.red);
    put(cx - 7, qy - 1, P.arrowD);
    put(cx - 7, qy - 2, P.redL);

    // ----- shoulder stubs (arms are on the bow sprite) -----
    const armY = torsoY + 2;
    rect(put, cx - 7, armY, 2, 3, P.blue);
    put(cx - 7, armY, P.blueL);
    rect(put, cx + 5, armY, 2, 3, P.blue);
    put(cx + 6, armY, P.blueL);

    // ----- head -----
    const headCx = cx + (moveIdx >= 0 ? 1 : 0); // slight forward lean at a run
    const headCy = 9 + bob + headDy + crouch;
    disc(put, headCx, headCy, 4, P.skin);
    // neck
    rect(put, cx - 1, headCy + 4, 3, 1, P.skinD);
    // hood dome (1px proud of the skull) + brim
    for (let y = -5; y <= -1 + brimDrop; y++)
      for (let x = -5; x <= 5; x++)
        if (x * x + y * y <= 23) put(headCx + x + hoodDx, headCy + y, P.blueD);
    for (let x = -4; x <= 4; x++)
      if (x * x + 1 <= 23) put(headCx + x + hoodDx, headCy - 1 + brimDrop, P.blueM);
    // hood tail trailing off the back
    put(headCx + hoodDx - 5, headCy - 1, P.blueD);
    put(headCx + hoodDx - 6, headCy, P.blueD);
    put(headCx + hoodDx - 5, headCy, P.blueM);
    // gold feather swept back along the hood
    put(headCx + hoodDx - 4, headCy - 4, P.gold);
    put(headCx + hoodDx - 5, headCy - 3, P.gold);
    put(headCx + hoodDx - 6, headCy - 2, P.goldM);
    // face (quarter view — features sit toward the facing side)
    const eyeC = blink ? P.skinD : P.outline;
    put(headCx, headCy + eyeDy, eyeC);
    put(headCx + 2, headCy + eyeDy, eyeC);
    // mouth — defined 2px line (no chin stubble)
    put(headCx, headCy + 2 + eyeDy, P.woodD);
    put(headCx + 1, headCy + 2 + eyeDy, P.woodD);

    // ----- crisp 1px outline around the silhouette -----
    const NB: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const edges: number[] = [];
    for (const k of body) {
      const x = k % 32, y = (k / 32) | 0;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
        if (!body.has(ny * 32 + nx)) edges.push(ny * 32 + nx);
      }
    }
    for (const k of edges) rawPut(k % 32, (k / 32) | 0, P.outline);

    // ----- hit flash (white-out the silhouette, keep the outline) -----
    if (frame === 'hit') for (const k of body) rawPut(k % 32, (k / 32) | 0, P.white);
  };
}

// ==================================================================
//  BOW (32x32) — separate rotatable weapon sprite
//  Drawn pointing right. Origin set to (0.25, 0.5) = grip area at ~(8, 16).
// ==================================================================
export function drawBow(shooting: boolean) {
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
