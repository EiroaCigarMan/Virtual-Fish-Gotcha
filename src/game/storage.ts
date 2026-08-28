import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { applyDecay, clamp, defaultState } from "./state";
import { DEFAULT_SPECIES, DEFAULT_STRUCTURE, isSpeciesId, isStructureId } from "./catalog";
import type { GameState } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Validate + repair a parsed blob; unknown/corrupt → null. v1 blobs migrate (goldfish + castle). */
function coerce(raw: unknown, now: number): GameState | null {
  if (!isRecord(raw) || (raw.schemaVersion !== 1 && raw.schemaVersion !== 2)) return null;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const d = defaultState(now);
  const la = isRecord(raw.lastActionAt) ? raw.lastActionAt : {};
  const ts = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    schemaVersion: 2,
    hunger: clamp(num(raw.hunger, d.hunger)),
    happiness: clamp(num(raw.happiness, d.happiness)),
    cleanliness: clamp(num(raw.cleanliness, d.cleanliness)),
    lastSeenAt: num(raw.lastSeenAt, now),
    lastActionAt: { feed: ts(la.feed), play: ts(la.play), clean: ts(la.clean) },
    timeFormat: raw.timeFormat === "24h" ? "24h" : "12h",
    fishName: typeof raw.fishName === "string" ? raw.fishName.trim().slice(0, 16) : "",
    createdAt: num(raw.createdAt, now),
    structure: isStructureId(raw.structure) ? raw.structure : DEFAULT_STRUCTURE,
    species: isSpeciesId(raw.species) ? raw.species : DEFAULT_SPECIES,
  };
}

/** Exposed for tests. */
export const coerceState = coerce;

/**
 * Raw save text under the current key. If there is none but a pre-rename save exists, adopt it:
 * copy it under the new key and remove the old one, so nobody loses a fish to the rename.
 */
export function readSaveText(): string | null {
  const text = localStorage.getItem(STORAGE_KEY);
  if (text !== null) return text;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return null;
  localStorage.setItem(STORAGE_KEY, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacy;
}

/** Load and apply offline decay. Falls back to a fresh fish on missing/corrupt data. */
export function loadState(now = Date.now()): GameState {
  try {
    const text = readSaveText();
    if (!text) return defaultState(now);
    const parsed = coerce(JSON.parse(text), now);
    return parsed ? applyDecay(parsed, now) : defaultState(now);
  } catch {
    return defaultState(now);
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
