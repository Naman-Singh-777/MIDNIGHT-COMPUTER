/** Small versioned save. Storage can be missing or blocked, so every call is guarded. */
const KEY = 'midnight.v1';

export interface SaveData {
  version: 1;
  bestCorrect: number;
  nights: number;
  muted: boolean;
}

const DEFAULT: SaveData = { version: 1, bestCorrect: 0, nights: 0, muted: false };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.version !== 1) return { ...DEFAULT };
    return { ...DEFAULT, ...d };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* private window or blocked storage: the game still works */
  }
}
