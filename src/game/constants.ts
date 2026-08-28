import type { ActionName, StatName } from "./types";

export const STORAGE_KEY = "virtual-fish-gotcha:v1";
/** Key used before the 2026-08 rename; loadState adopts a save found here once, then removes it. */
export const LEGACY_STORAGE_KEY = "tamagotchi-fish:v1";

/** Stat points lost per real hour (also applied for time spent away). */
export const DECAY_PER_HOUR: Record<StatName, number> = {
  hunger: 6, // full → empty in ~16h
  happiness: 4, // ~25h
  cleanliness: 2.5, // ~40h
};

export const ACTION_EFFECTS: Record<ActionName, Partial<Record<StatName, number>>> = {
  feed: { hunger: 28, happiness: 4, cleanliness: -3 },
  play: { happiness: 24, hunger: -5, cleanliness: -2 },
  clean: { cleanliness: 40, happiness: 6 },
};

export const ACTION_COOLDOWN_MS: Record<ActionName, number> = {
  feed: 6_000,
  play: 10_000,
  clean: 15_000,
};

export const DECAY_TICK_MS = 10_000;
