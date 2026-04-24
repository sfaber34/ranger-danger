# Mobile Support Plan

Reference doc for making Ranger Danger mobile-friendly. Each phase is independently shippable.

## Current scaling mechanism

- **Logical world/camera view**: fixed 960×640 (3:2) — set by `CFG.width/height`, rendered via `Phaser.Scale.FIT`.
- **`sf` scale factor** (`LevelSelectScene.ts:30-46`): computed as `min(parentW*DPR/960, parentH*DPR/640)`. Then `setGameSize(960*sf, 640*sf)` + `camera.setZoom(sf)` is applied. Net effect: the canvas renders at device-native pixels for crispness, but the camera always shows exactly 960×640 *world* units.
- **World coords are sf-independent**: `CFG.player.speed`, ranges, hitboxes, tile size (`CFG.tile = 32`), projectile physics — all in world units and untouched by `sf`.
- **UI scales *with* sf**: `UIScene.ts:36-40` (`p()`, `fs()` helpers) multiplies every text size, padding, hit region, and bar width by `sf`. So UI text grows proportionally with the device's native pixel budget, not with logical CSS pixels.

## The mobile problem

On an iPhone portrait (393×852 logical / DPR 3):
- `sf = min(1179/960, 2556/640) = 1.23`
- Canvas renders at 1180×787 physical, `FIT`ted into 393px wide → **262px tall game window with ~590px of black bars**.

Landscape-only helps but still wastes space, and the UI-text-scales-with-DPR rule produces *tiny* UI on mobile because `sf` is small when the aspect doesn't match.

## What won't break

- **Gameplay math** — player speed, hitboxes, AI, projectile physics, tower ranges, tile grid all in world units. Changing how much world the camera shows does *not* change any of these.
- **Sprite assets** — drawn once at 32×32 logical via `scale2x`. Resolution-independent.

## What will break (things to watch)

- **`CFG.spawnDist = 18` tiles** assumes ~30×20 tile view. If mobile portrait shows ~13×22 tiles, enemies spawn inside the vertical view unless spawnDist becomes viewport-aware.
- **Chunk generation radius** (`chunkSize = 16`, generated in a ring around the player) — tuned for the fixed view. Mostly OK because it keys on player tile, but edge-of-view pop-in gets more visible with a larger view.
- **UIScene** (`create()` runs once) reads `this.scale.width/height` — if we switch to `RESIZE` mode, layout needs re-running on orientation/window change.
- **Build ghost preview** and **tower range circles** rely on `pointer.worldX/worldY` which Phaser handles correctly under any zoom, so those are fine.

## Direction (decided)

**Show a different amount of world per aspect ratio.** Desktop keeps the current look exactly — same 960×640 camera view, same UI sizing. Mobile resizes the viewport to fill the device screen and shows whatever world area matches that aspect ratio (less horizontal world in portrait, a shorter/wider slice in narrow landscape, etc.).

Guiding rules:

- **Desktop behavior must be unchanged.** Anyone playing on desktop after these changes should see the exact same framing, UI placement, and text sizing as before.
- **Mobile fills the device viewport.** No letterboxing. Canvas = 100vw × 100vh. Camera zoom is chosen so the world stays at a playable scale while the visible region's aspect matches the device.
- **Seeing less world on mobile is acceptable.** Mobile players will have a smaller view of the battlefield — that's the tradeoff we've accepted in exchange for filling the screen.

Start with Phase 1 alone — it's self-contained, verifiable on desktop by resizing the window (desktop should look identical at any window size ≥ the old 960×640 equivalent), and unblocks everything else.

---

## Phase 1 — Viewport foundation ✅

Decouple three things previously conflated into `sf`:

1. **`renderScale`** = DPR-aware canvas resolution for crispness.
2. **`cameraZoom`** = screen px per world px, chosen per device so we show a sensible amount of world.
3. **`uiScale`** = multiplier for UI sizes/text, chosen per device for readability.

Landed (commit-ready):

- [x] New `src/viewport.ts` centralizes the decision. Exports `computeViewport()` returning `{ isMobile, isPortrait, renderW, renderH, cameraZoom, uiScale }` and a `viewportWorldSize(vp)` helper.
- [x] `LevelSelectScene` now calls `computeViewport()` instead of the inline DPR math. It publishes `sf`, `cameraZoom`, `uiScale`, and `isMobile` to `game.registry`. Desktop still gets the exact legacy values (`sf = uiScale = cameraZoom`).
- [x] `GameScene` reads `cameraZoom` from the registry for `cameras.main.setZoom` (falls back to `sf` if absent).
- [x] Viewport-aware `spawnDist` — new `GameScene.spawnDist` field. Desktop resolves to `CFG.spawnDist` (unchanged). Mobile grows it to `max(CFG.spawnDist, ceil(view_corner / tile) + 2)` so enemies still spawn off-screen when the mobile view is taller than 3:2. All 7 internal `CFG.spawnDist` reads in `GameScene` now go through the field.
- [x] CSS hardening in `index.html`: `overflow: hidden`, `overscroll-behavior: none`, and `touch-action: none` on `#game` — prevents pull-to-refresh, rubber-band scrolling, and browser gesture handling on the canvas.

Decisions made during implementation:

- Scale mode stays `Phaser.Scale.FIT`. Switching to `RESIZE` was unnecessary once we let `LevelSelectScene` set `gameSize = viewport × DPR` directly on mobile — that aspect matches the parent element, so FIT produces no letterboxing there while keeping legacy FIT letterboxing on desktop windows that aren't 3:2.
- `uiScale` on mobile = `dpr * 1.5`. Desktop keeps `uiScale = sf` (legacy). `UIScene` still reads the `sf` registry key; because `sf === uiScale` on both code paths now, no UIScene changes were needed in Phase 1.

Deliberately deferred (handled in later phases):

- Orientation/window resize handling (needs UI re-layout → Phase 2).
- Tap targets, joystick, build flow on mobile → Phase 3.
- Safe-area insets, fullscreen-on-play, PWA manifest → Phase 4.
- Level select screen layout on mobile may look rough — acceptable for Phase 1 since the game itself renders correctly.

## Phase 2 — UI re-layout with anchors

- [ ] Refactor `UIScene` to build layout in a `layout()` method that reads current `this.scale.width/height` and `uiScale`.
- [ ] Call `layout()` in `create()` and on `this.scale.on('resize', …)`.
- [ ] Replace hard-coded positions like `W - this.p(60)` with named anchors: top-left, top-right, bottom-center (hotbar), bottom-left (future joystick), bottom-right (future action buttons).
- [ ] Add safe-area insets: `env(safe-area-inset-top/bottom)` in CSS, respect them in UI anchor padding for iOS notches.

## Phase 3 — Touch input

- [ ] Detect touch: `const isTouch = window.matchMedia('(pointer: coarse)').matches;`
- [ ] Add virtual joystick (bottom-left, only when touch) that converts to the same `vx/vy` the keyboard path produces in `updatePlayer`.
- [ ] Tap-to-place for build mode (replace hover-preview with "ghost follows tap, confirm button places").
- [ ] Bigger hotbar slots when `uiScale > 1` (wire the `p()` helper to `uiScale` instead of `sf`).

## Phase 4 — Page / PWA polish

- [ ] Prevent pull-to-refresh, pinch zoom, and long-press context menu on the canvas.
- [ ] Fullscreen on Play tap for mobile (request fullscreen when Play is tapped).
- [ ] `manifest.json` + apple-touch-icon for homescreen install (optional).
- [ ] Orientation lock hint if portrait/landscape design diverges.
