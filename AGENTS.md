# Ranger Danger — Working Notes

## Project context

- **What I'm working on:** Ranger Danger — a top-down hybrid roguelite + tower-defense game.
- **Goal:** Ship a Steam Early Access build.
- **Audience:** Steam players on desktop.
- **Stack context:** Phaser 3 + TypeScript, bundled with Vite. Steam release will wrap the web build in Electron / Tauri / NW.js — write code that runs in a browser runtime but stays portable across that wrapping (no Node-only or Electron-only APIs in game code).
- **What to avoid:** Mobile-only features and patterns (touch-only inputs, virtual joysticks as the *only* control scheme, mobile-store-specific hooks). Keyboard + mouse is the primary surface; existing mobile-friendly affordances stay but shouldn't lead design.

Apply this context to every task. When something doesn't fit, flag it before proceeding.

The codebase was split out of a few mega-files in 2026-Q2 (see `REFACTOR_PLAN.md`); the rules below exist to keep it that way.

## Workflow

- **No filler openings.** Start every response with the actual answer. No "Great question!", "Of course!", "Certainly!", or other warmups, no preamble, no restating the question.
- **Match response length to task complexity.** Simple questions get short, direct answers. Complex tasks get full, detailed responses. Don't pad with restatements or recap closers.
- **Design choices need options first.** For tasks with a real design choice (gameplay mechanism, UX shape, structural refactor): present 2-4 approaches with tradeoffs and wait for me to pick before implementing. For clear bug fixes or trivial tweaks: diagnose, propose the fix directly, then confirm before applying. Don't pad with contrived alternatives.
- **Flag uncertainty explicitly.** If you're not sure about something, say so before including it. Don't fill gaps with plausible-sounding information.

## Where things live

- **Scene lifecycle only** in `src/scenes/GameScene.ts` (`init`, `preload`, `create`, `update`, `shutdown`) and the canonical mutable state. Game logic moves to systems.
- **Per-feature systems** in `src/systems/<X>System.ts`. Each is a class taking `(scene: GameScene)` in its constructor. Add a new system rather than growing GameScene. Reference: `src/systems/CoinSystem.ts`.
- **State machines** in `src/state/<X>State.ts` (`WaveState`, `BuildState`, `BossState`, `EndState`). Every state transition is a named method — no scattered flag mutations like `this.bossSpawned = true`. Reference: `src/state/WaveState.ts`.
- **Art generation** in `src/assets/art/<topic>.ts` (`canvas`, `player`, `enemies`, `bear`, `bosses`, `towers`, `projectiles`, `fx`, `terrain`, `ui`). `src/assets/generateArt.ts` is a thin orchestrator — do not add new `drawXxx` functions there. Reference: `src/assets/art/towers.ts`.
- **Tutorial steps** in `src/tutorial/steps/<stepName>.ts`, registered in `src/tutorial/registry.ts`. Class-based step for stateful counters; plain object for stateless. Do not grow the dispatcher in `TutorialScene.ts`. Reference: `src/tutorial/steps/gameKill.ts`.
- **Cross-scene contracts** go through the typed wrappers in `src/core/registry.ts` and `src/core/events.ts`. No `game.registry.set('foo', ...)` or `game.events.emit('bar', ...)` with raw strings — add the key/event to the schema first.

## Coding rules

- **Don't add fallbacks for "can't happen" cases.** Trust internal invariants. Validate at boundaries (user input, external APIs) only.
- **Don't add backwards-compat shims** (re-exports of old names, "removed" comments, unused `_var` renames). Delete cleanly.
- **Don't write comments that explain *what* code does** — well-named identifiers do that. Comment only the non-obvious *why*: a hidden constraint, a workaround, an invariant a future reader would miss.
- **Phaser timers outlive their owner.** A `scene.time.delayedCall(..., () => this.foo())` keeps firing after the GameObject is destroyed (`this.scene` becomes undefined). Either guard the callback (`if (!this.scene) return;`) or cancel the timer on destroy. See `src/entities/Tower.ts:applyTierVisual` for the pattern.

## Validation

After any non-trivial change: `npx tsc --noEmit` must pass, and `npm run dev` must boot.

## Dev server

Always launch with `npm run dev` (not `vite` directly) — npm scripts set the right env.
