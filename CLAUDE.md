# Ranger Danger — Working Notes

A Phaser 3 tower-defense game. The codebase was split out of a few mega-files in 2026-Q2 (see `REFACTOR_PLAN.md`); these rules exist to keep it that way.

## Where things live

- **Scene lifecycle only** in `src/scenes/GameScene.ts` (`init`, `preload`, `create`, `update`, `shutdown`) and the canonical mutable state. Game logic moves to systems.
- **Per-feature systems** in `src/systems/<X>System.ts`. Each is a class taking `(scene: GameScene)` in its constructor. Add a new system rather than growing GameScene. Reference: `src/systems/CoinSystem.ts`.
- **State machines** in `src/state/<X>State.ts` (`WaveState`, `BuildState`, `BossState`, `EndState`). Every state transition is a named method — no scattered flag mutations like `this.bossSpawned = true`. Reference: `src/state/WaveState.ts`.
- **Art generation** in `src/assets/art/<topic>.ts` (`canvas`, `player`, `enemies`, `bear`, `bosses`, `towers`, `projectiles`, `fx`, `terrain`, `ui`). `src/assets/generateArt.ts` is a thin orchestrator — do not add new `drawXxx` functions there. Reference: `src/assets/art/towers.ts`.
- **Tutorial steps** in `src/tutorial/steps/<stepName>.ts`, registered in `src/tutorial/registry.ts`. Class-based step for stateful counters; plain object for stateless. Do not grow the dispatcher in `TutorialScene.ts`. Reference: `src/tutorial/steps/gameKill.ts`.
- **Cross-scene contracts** go through the typed wrappers in `src/core/registry.ts` and `src/core/events.ts`. No `game.registry.set('foo', ...)` or `game.events.emit('bar', ...)` with raw strings — add the key/event to the schema first.

## Coding rules

- **Don't grow files past ~500 lines** for the modules above. If you're tempted, you're adding to the wrong file — extract a sibling instead.
- **Don't add fallbacks for "can't happen" cases.** Trust internal invariants. Validate at boundaries (user input, external APIs) only.
- **Don't add backwards-compat shims** (re-exports of old names, "removed" comments, unused `_var` renames). Delete cleanly.
- **Don't write comments that explain *what* code does** — well-named identifiers do that. Comment only the non-obvious *why*: a hidden constraint, a workaround, an invariant a future reader would miss.
- **Phaser timers outlive their owner.** A `scene.time.delayedCall(..., () => this.foo())` keeps firing after the GameObject is destroyed (`this.scene` becomes undefined). Either guard the callback (`if (!this.scene) return;`) or cancel the timer on destroy. See `src/entities/Tower.ts:applyTierVisual` for the pattern.

## Validation

After any non-trivial change: `npx tsc --noEmit` must pass, and `npm run dev` must boot.

## Dev server

Always launch with `npm run dev` (not `vite` directly) — npm scripts set the right env.
