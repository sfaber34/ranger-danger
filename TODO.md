# TODO

## 1. Redo Tower Graphics (Isometric Perspective)
- Current tower art is top-down, which clashes with the angled perspective of the player and enemies
- Redraw tower base and top sprites at a 3/4 angle to match the rest of the game
- Base should visually fill its 2x2 grid footprint so players can clearly see the collision boundary
  - Avoids confusion when walking near tower corners and being blocked by invisible edges
- Maintain the tier tinting system (arrow: white → blue → gold, cannon: grey → bronze → red)
- Cannon and arrow tops should still rotate to aim but drawn from the angled perspective
- Update hit flash and upgrade pop animations to match new art style

## 2. Level Select Screen (Pick One Approach)
- Levels unlock sequentially — beating one unlocks the next
- Each level has 3 difficulties: Easy, Medium, Hard
- Save/load progress (localStorage) to track completion per level per difficulty

### Option A: Card-Based Select
- Each biome is a card (e.g. Grasslands, Alien Planet, Mountains, Dungeon, etc.)
- Multiple cards per biome for Easy / Medium / Hard difficulties
- Cards show completion status — green checkmark (or similar) for each difficulty beaten
- Cards could show a preview image of the biome, level number, and difficulty stars
- Locked levels shown as greyed-out/face-down cards
- Clean grid layout, easy to scan at a glance

### Option B: Map-Based Select
- Connected world map with dotted paths between level nodes
- Levels are clickable circles on the map — click for more info or to play
- Path dots light up / animate as levels are beaten, showing progression
- Each level node shows biome art and completion status
- Clicking a level opens a detail panel where you select difficulty (Easy / Medium / Hard)
- Difficulty completion shown as 3 stars or colored pips on the node
- Locked levels shown greyed out with a lock icon on the node

### Level Biomes (shared by both options)
1. **Grasslands** (Level 1) — current level, green fields, basic enemies
2. **Forest** — denser terrain, tree obstacles, faster enemy waves
3. **Swamp** — muddy ground slows player, poison enemies
4. **Desert** — open terrain, long sight lines, sandstorm events
5. **Mountains** — narrow paths, elevation advantage, tougher heavies
6. **Volcanic** — fire hazards, lava rivers as natural walls, elite enemies
7. **Frozen Peaks** — ice slows projectiles, blizzard reduces visibility
8. **Dark Fortress** — final level, all enemy types, multiple bosses

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

## 5. Tower Specialization (Branching Upgrades)
- Current system: 3 linear upgrade tiers (Level 0 → 1 → 2)
- New system: Levels 0 and 1 remain the same, but upgrading past Level 1 presents a **choice** between two specializations
- Each specialization takes the tower in a distinct direction with unique attributes
- Once chosen, the specialization is permanent for that tower (no respec)
- Visual change to reflect the chosen path (tint, top sprite, or particle effect)

### Arrow Tower Specializations (after Level 1)
- **Marksman** — longer range, higher single-target damage, slower fire rate, piercing shots that hit multiple enemies in a line
- **Rapid Fire** — shorter range, lower per-shot damage, much faster fire rate, slight spread to shots

### Cannon Tower Specializations (after Level 1)
- **Mortar** — massive splash radius, slower fire rate, leaves lingering fire zone that damages enemies over time
- **Shrapnel** — tighter splash radius, but fragments fly outward on impact dealing secondary damage to a wider area

### Future Tower Specializations
- Design specializations for each new tower type as they are added
- Each branch should feel meaningfully different in playstyle, not just stat tweaks
- Encourage mixing specializations across towers for varied strategies

### UI
- When a Level 1 tower is upgraded, show a choice panel with both specialization options
- Display name, icon, and brief description of each path
- Highlight stat changes compared to the base Level 1 tower

## 6. Character Abilities (Purchasable Upgrades)
- Spend XP or in-game currency to permanently upgrade the player character
- Upgrades persist across levels (part of the progression system)

### Stat Upgrades
- **Attack Speed** — reduce bow fire rate cooldown
- **Attack Range** — increase targeting/shooting distance
- **Attack Damage** — increase arrow damage per hit
- **Movement Speed** — move faster around the map
- **Coin Magnet Range** — collect coins from further away
- **Coin Magnet Speed** — coins fly toward player faster
- **Max HP** — increase player health pool
- **HP Regen** — slowly regenerate health over time
- **Armor** — reduce incoming damage by a flat amount or percentage

### Design Notes
- Each stat should have multiple tiers (e.g. 5 levels each, progressively more expensive)
- Accessible from the level select screen or during the pre-wave build phase
- Show clear before/after values so the player knows what they're buying
- Balance so upgrades feel impactful but no single stat becomes a must-buy
- Could tie into the XP system from TODO #4 — XP is the currency for these upgrades
