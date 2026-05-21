export type Difficulty = 'easy' | 'medium' | 'hard' | 'oneHP' | 'endless';
export type Biome = 'grasslands' | 'forest' | 'infected' | 'river' | 'castle' | 'desert' | 'tundra' | 'volcanic';

export interface LevelDef {
  id: number;
  name: string;
  biome: Biome;
  x: number;
  y: number;
  connectsTo: number[];
  unlockCost: number;
  implemented: boolean;
  // Per-level spawn tuning (overrides CFG defaults)
  rampFactor?: number;   // how fast spawn interval tightens (lower = harder)
  minInterval?: number;  // spawn interval floor in ms
  waveSize?: number;     // enemies per wave
  clusterMax?: number;   // cap on group spawn sizes (prevents swarms on early levels)
}

export const LEVELS: LevelDef[] = [
  // Grasslands — top-left (castle & forest area)
  { id: 1,  name: 'Meadow',        biome: 'grasslands', x: 150, y: 345, connectsTo: [2],    unlockCost: 0,  implemented: true,
    rampFactor: 0.93, minInterval: 350, waveSize: 100, clusterMax: 4 },
  { id: 2,  name: 'Forest',        biome: 'forest',     x: 265, y: 425, connectsTo: [3],    unlockCost: 1,  implemented: true,
    rampFactor: 0.91, minInterval: 320, waveSize: 110, clusterMax: 3 },
  { id: 3,  name: 'Infected',      biome: 'infected', x: 410, y: 320, connectsTo: [4],    unlockCost: 3,  implemented: true,
    rampFactor: 0.88, minInterval: 250, waveSize: 120, clusterMax: 3 },
  { id: 4,  name: 'Rivers',        biome: 'river',      x: 168, y: 200, connectsTo: [5],    unlockCost: 4,  implemented: true,
    rampFactor: 0.86, minInterval: 220, waveSize: 130, clusterMax: 2 },
  { id: 5,  name: 'The Castle',    biome: 'castle',     x: 125, y: 95, connectsTo: [6],    unlockCost: 5,  implemented: true,
    rampFactor: 0.90, minInterval: 300, waveSize: 90, clusterMax: 3 },
  // Desert — top-center/right (ruins & dunes)
  { id: 6,  name: 'Oasis',         biome: 'desert',     x: 430, y: 170, connectsTo: [7],    unlockCost: 7,  implemented: false },
  { id: 7,  name: 'Sand Dunes',    biome: 'desert',     x: 540, y: 110, connectsTo: [8],    unlockCost: 9,  implemented: false },
  { id: 8,  name: 'Buried Temple', biome: 'desert',     x: 620, y: 200, connectsTo: [9],    unlockCost: 12, implemented: false },
  // Tundra — bottom-center (frozen lakes & caves)
  { id: 9,  name: 'Frozen Lake',   biome: 'tundra',     x: 380, y: 460, connectsTo: [10],   unlockCost: 15, implemented: false },
  { id: 10, name: 'Ice Cavern',    biome: 'tundra',     x: 490, y: 530, connectsTo: [11],   unlockCost: 18, implemented: false },
  { id: 11, name: 'Blizzard Peak', biome: 'tundra',     x: 610, y: 450, connectsTo: [12],   unlockCost: 22, implemented: false },
  // Volcanic — right side (lava & dungeon)
  { id: 12, name: 'Ashen Path',    biome: 'volcanic',   x: 750, y: 340, connectsTo: [13],   unlockCost: 26, implemented: false },
  { id: 13, name: 'Lava Fields',   biome: 'volcanic',   x: 830, y: 200, connectsTo: [14],   unlockCost: 30, implemented: false },
  { id: 14, name: "Dragon's Maw",  biome: 'volcanic',   x: 870, y: 420, connectsTo: [],     unlockCost: 34, implemented: false },
];

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'oneHP', 'endless'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', oneHP: '1 HP', endless: 'Endless'
};

export const MEDAL_COLORS: Record<Difficulty, { label: string; fill: number; hex: string }> = {
  easy:    { label: 'Bronze',  fill: 0xc47a3e, hex: '#c47a3e' },
  medium:  { label: 'Silver',  fill: 0xc8d0d8, hex: '#c8d0d8' },
  hard:    { label: 'Gold',    fill: 0xffd84a, hex: '#ffd84a' },
  oneHP:   { label: 'Diamond', fill: 0x7cc4ff, hex: '#7cc4ff' },
  // No medal awarded for Endless — entry exists so DIFFICULTY-keyed
  // Records type-check. The endless mode tracks high scores instead.
  endless: { label: 'Endless', fill: 0xc040c0, hex: '#c040c0' },
};

export const BIOME_COLORS: Record<Biome, { fill: number; label: string; textHex: string }> = {
  grasslands: { fill: 0x2a4a1e, label: 'Grasslands', textHex: '#5eaa3e' },
  forest:     { fill: 0x1a3a14, label: 'Forest',     textHex: '#3a7a2e' },
  infected:   { fill: 0x2a1a3a, label: 'Infected',    textHex: '#a040d0' },
  river:      { fill: 0x1e3a4a, label: 'River',      textHex: '#4a9aba' },
  castle:     { fill: 0x3a3a4a, label: 'Castle',     textHex: '#8a8aaa' },
  desert:     { fill: 0x5a4a28, label: 'Desert',     textHex: '#d4a84a' },
  tundra:     { fill: 0x2a3a4e, label: 'Tundra',     textHex: '#8ab4d0' },
  volcanic:   { fill: 0x4a1a1a, label: 'Volcanic',   textHex: '#d45a3a' },
};

// ---------- localStorage ----------
const STORAGE_KEY = 'td_medals';

export type MedalStore = Record<string, Record<Difficulty, boolean>>;

export function loadMedals(): MedalStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveMedal(levelId: number, diff: Difficulty): void {
  // Endless mode has no win condition — no medal awarded. High scores
  // for endless live in their own localStorage namespace.
  if (diff === 'endless') return;
  const store = loadMedals();
  const key = String(levelId);
  if (!store[key]) store[key] = { easy: false, medium: false, hard: false, oneHP: false, endless: false };
  store[key][diff] = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    return;
  }
  // Engaged player just earned progress — ask the browser to mark this
  // origin's storage as persistent so it survives ITP / quota eviction.
  // Silent in Chrome (engagement-gated auto-grant); a small infobar in
  // Firefox; no-op in Safari. Storage works the same regardless.
  requestPersistentStorage();
}

/** Tracks across calls so we don't spam the browser. */
let _persistRequested = false;

/** Best-effort request to make this origin's storage persistent. The
 *  browser may auto-grant, prompt, or no-op depending on the engine —
 *  any outcome is fine because the underlying APIs work either way. */
function requestPersistentStorage(): void {
  if (_persistRequested) return;
  _persistRequested = true;
  try {
    const s = navigator.storage;
    if (s && typeof s.persist === 'function') {
      // Don't await — this isn't on any critical path.
      s.persist().catch(() => { /* user denied / unsupported — fine */ });
    }
  } catch {
    // Some private-browsing modes throw on storage access. Ignore.
  }
}

export function hasMedal(store: MedalStore, levelId: number): boolean {
  const medals = store[String(levelId)];
  if (!medals) return false;
  return Object.values(medals).some(v => v);
}

export function isLevelUnlocked(store: MedalStore, levelId: number): boolean {
  if (levelId <= 1) return true;
  return hasMedal(store, levelId - 1);
}

export function totalMedals(store?: MedalStore): number {
  const s = store ?? loadMedals();
  let count = 0;
  for (const lvl of Object.values(s)) {
    for (const v of Object.values(lvl)) if (v) count++;
  }
  return count;
}
