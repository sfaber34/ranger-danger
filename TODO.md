# TODO

## 1. Redo Tower Graphics (Isometric Perspective)
- Current tower art is top-down, which clashes with the angled perspective of the player and enemies
- Redraw tower base and top sprites at a 3/4 angle to match the rest of the game
- Base should visually fill its 2x2 grid footprint so players can clearly see the collision boundary
  - Avoids confusion when walking near tower corners and being blocked by invisible edges
- Maintain the tier tinting system (arrow: white → blue → gold, cannon: grey → bronze → red)
- Cannon and arrow tops should still rotate to aim but drawn from the angled perspective
- Update hit flash and upgrade pop animations to match new art style

## 2. Level Select Screen (Island Map)
- Create an island-themed world map as the level select screen
- The island is viewed from above at an angle, showing different biomes/regions
- Each level is a node on the map connected by a path
- Levels unlock sequentially — beating one unlocks the next
- Save/load progress (localStorage) to track which levels are beaten

### Level Progression & Biomes
1. **Grasslands** (Level 1) — current level, green fields, basic enemies
2. **Forest** — denser terrain, tree obstacles, faster enemy waves
3. **Swamp** — muddy ground slows player, poison enemies
4. **Desert** — open terrain, long sight lines, sandstorm events
5. **Mountains** — narrow paths, elevation advantage, tougher heavies
6. **Volcanic** — fire hazards, lava rivers as natural walls, elite enemies
7. **Frozen Peaks** — ice slows projectiles, blizzard reduces visibility
8. **Dark Fortress** — final level, all enemy types, multiple bosses

### Map Visual Style
- Hand-drawn pixel art island with biome colors visible on the map
- Beaten levels shown with a flag/checkmark
- Locked levels shown greyed out with a lock icon
- Animated path between levels lights up as you progress
- Player avatar stands on the current/last-beaten level node

## 3. Improve Ground/Terrain Variety
- Current ground is a single shade of green — looks flat and unpolished
- Each biome needs varied terrain tiles that are all walkable but visually distinct
- **Grasslands**: mix of grass shades, patches of dirt, sandy spots, small stones, tufts of tall grass
- **Forest**: mossy ground, leaf litter, exposed roots, muddy patches
- **Swamp**: murky water puddles, reeds, soggy earth tones
- **Desert**: sand dunes, cracked earth, rock outcroppings, occasional scrub brush
- **Mountains**: rocky ground, gravel patches, snow-dusted stone, cliff edges
- **Volcanic**: charred rock, lava cracks (glowing), ash-covered ground
- **Frozen Peaks**: snow, ice patches, frozen puddles, wind-swept stone
- **Dark Fortress**: dark stone tiles, cracks, glowing runes
- Use Perlin/simplex noise or random seeding to generate natural-looking terrain variation per level
- Terrain is purely cosmetic — no gameplay effect on walkability (walls/towers still use the grid)

## 4. Unlock Progression System
- Towers and content unlock through character experience earned by beating levels
- Leftover money at end of a level converts to experience (ties into loot collection window)

### Tower Unlock Order
1. **Arrow Tower** — available from the start (Level 1 acts as a tutorial with only arrows)
2. **Cannon Tower** — unlocked after beating Level 1
3. **TBD Tower 3** — unlocked after beating Level 2
4. **TBD Tower 4** — unlocked after further progression
- Each new tower unlock should feel like a meaningful power spike

### Enemy / Tower Synergy
- As each tower type unlocks, new enemy types weak to that tower are introduced in subsequent levels
  - e.g. Cannon unlocks → next level introduces clustered swarm enemies vulnerable to AoE
  - e.g. Tower 3 unlocks → next level introduces enemies with a weakness matching that tower's specialty
- Encourages players to use newly unlocked towers rather than spamming one type
- Earlier enemy types still appear but in different mixes to keep variety

### Experience & Persistence
- Track total XP earned across all levels (localStorage)
- Show XP progress bar on level select screen
- Unlock thresholds clearly visible so players know what they're working toward
- Replay earlier levels to farm XP if needed (but diminishing returns to prevent grinding)
