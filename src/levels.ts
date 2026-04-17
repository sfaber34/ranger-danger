export type Difficulty = 'easy' | 'medium' | 'hard' | 'oneHP';
export type Biome = 'grasslands' | 'forest' | 'infected' | 'desert' | 'tundra' | 'volcanic';

export interface LevelDef {
  id: number;
  name: string;
  biome: Biome;
  x: number;
  y: number;
  connectsTo: number[];
  unlockCost: number;
  implemented: boolean;
}

export const LEVELS: LevelDef[] = [
  // Grasslands — top-left (castle & forest area)
  { id: 1,  name: 'The Meadow',    biome: 'grasslands', x: 210, y: 530, connectsTo: [2],    unlockCost: 0,  implemented: true },
  { id: 2,  name: 'Forest',        biome: 'forest',     x: 265, y: 425, connectsTo: [3],    unlockCost: 1,  implemented: true },
  { id: 3,  name: 'Riverside',     biome: 'infected', x: 290, y: 310, connectsTo: [4],    unlockCost: 3,  implemented: true },
  { id: 4,  name: 'The Castle',    biome: 'grasslands', x: 153, y: 300, connectsTo: [5],    unlockCost: 5,  implemented: false },
  // Desert — top-center/right (ruins & dunes)
  { id: 5,  name: 'Oasis',         biome: 'desert',     x: 430, y: 170, connectsTo: [6],    unlockCost: 7,  implemented: false },
  { id: 6,  name: 'Sand Dunes',    biome: 'desert',     x: 540, y: 110, connectsTo: [7],    unlockCost: 9,  implemented: false },
  { id: 7,  name: 'Buried Temple', biome: 'desert',     x: 620, y: 200, connectsTo: [8],    unlockCost: 12, implemented: false },
  // Tundra — bottom-center (frozen lakes & caves)
  { id: 8,  name: 'Frozen Lake',   biome: 'tundra',     x: 380, y: 460, connectsTo: [9],    unlockCost: 15, implemented: false },
  { id: 9,  name: 'Ice Cavern',    biome: 'tundra',     x: 490, y: 530, connectsTo: [10],   unlockCost: 18, implemented: false },
  { id: 10, name: 'Blizzard Peak', biome: 'tundra',     x: 610, y: 450, connectsTo: [11],   unlockCost: 22, implemented: false },
  // Volcanic — right side (lava & dungeon)
  { id: 11, name: 'Ashen Path',    biome: 'volcanic',   x: 750, y: 340, connectsTo: [12],   unlockCost: 26, implemented: false },
  { id: 12, name: 'Lava Fields',   biome: 'volcanic',   x: 830, y: 200, connectsTo: [13],   unlockCost: 30, implemented: false },
  { id: 13, name: "Dragon's Maw",  biome: 'volcanic',   x: 870, y: 420, connectsTo: [],     unlockCost: 34, implemented: false },
];

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'oneHP'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', oneHP: '1 HP'
};

export const MEDAL_COLORS: Record<Difficulty, { label: string; fill: number; hex: string }> = {
  easy:   { label: 'Bronze',  fill: 0xc47a3e, hex: '#c47a3e' },
  medium: { label: 'Silver',  fill: 0xc8d0d8, hex: '#c8d0d8' },
  hard:   { label: 'Gold',    fill: 0xffd84a, hex: '#ffd84a' },
  oneHP:  { label: 'Diamond', fill: 0x7cc4ff, hex: '#7cc4ff' },
};

export const BIOME_COLORS: Record<Biome, { fill: number; label: string; textHex: string }> = {
  grasslands: { fill: 0x2a4a1e, label: 'Grasslands', textHex: '#5eaa3e' },
  forest:     { fill: 0x1a3a14, label: 'Forest',     textHex: '#3a7a2e' },
  infected:   { fill: 0x2a1a3a, label: 'Infected',    textHex: '#a040d0' },
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
  const store = loadMedals();
  const key = String(levelId);
  if (!store[key]) store[key] = { easy: false, medium: false, hard: false, oneHP: false };
  store[key][diff] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
