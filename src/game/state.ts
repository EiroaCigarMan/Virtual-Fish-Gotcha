import { ACTION_COOLDOWN_MS, ACTION_EFFECTS, DECAY_PER_HOUR } from "./constants";
import { DEFAULT_SPECIES, DEFAULT_STRUCTURE, DEFAULT_TANK } from "./catalog";
import { sanitizeOmniMessage } from "./omni";
import type { ActionName, GameState, SpeciesId, StatName, StructureId, TankShape, TimeFormat } from "./types";

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function defaultState(now = Date.now()): GameState {
  return {
    schemaVersion: 4,
    hunger: 80,
    happiness: 75,
    cleanliness: 85,
    lastSeenAt: now,
    lastActionAt: { feed: null, play: null, clean: null },
    timeFormat: "12h",
    fishName: "",
    createdAt: now,
    structure: DEFAULT_STRUCTURE,
    species: DEFAULT_SPECIES,
    tank: DEFAULT_TANK,
    omniMessage: "",
  };
}

/** Pure: apply real-time decay from lastSeenAt to `now`. Safe against clock going backwards. */
export function applyDecay(state: GameState, now: number): GameState {
  const hours = Math.max(0, now - state.lastSeenAt) / 3_600_000;
  if (hours <= 0) return state;
  return {
    ...state,
    hunger: clamp(state.hunger - hours * DECAY_PER_HOUR.hunger),
    happiness: clamp(state.happiness - hours * DECAY_PER_HOUR.happiness),
    cleanliness: clamp(state.cleanliness - hours * DECAY_PER_HOUR.cleanliness),
    lastSeenAt: now,
  };
}

export function cooldownRemaining(state: GameState, action: ActionName, now: number): number {
  const last = state.lastActionAt[action];
  if (last == null) return 0;
  return Math.max(0, last + ACTION_COOLDOWN_MS[action] - now);
}

/** Pure: apply an action. Cooldown is enforced here (not only in the UI). Returns same object if refused. */
export function applyAction(state: GameState, action: ActionName, now: number): GameState {
  if (cooldownRemaining(state, action, now) > 0) return state;
  const decayed = applyDecay(state, now);
  const next: GameState = { ...decayed, lastActionAt: { ...decayed.lastActionAt, [action]: now } };
  for (const [stat, delta] of Object.entries(ACTION_EFFECTS[action]) as [StatName, number][]) {
    next[stat] = clamp(next[stat] + delta);
  }
  return next;
}

export function setTimeFormat(state: GameState, timeFormat: TimeFormat): GameState {
  return { ...state, timeFormat };
}

export const MAX_NAME_LEN = 16;
export function setFishName(state: GameState, name: string): GameState {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN);
  return clean ? { ...state, fishName: clean } : state;
}

/**
 * Pure: swap the structure. Cosmetic — except that the wide skyline nudges a round bowl to the
 * square tank the first time it's picked (the tank can be switched straight back).
 */
export function setStructure(state: GameState, structure: StructureId): GameState {
  if (state.structure === structure) return state;
  const tank = structure === "dallasSkyline" && state.tank === "bowl" ? "square" : state.tank;
  return { ...state, structure, tank };
}

/** Pure: set what the Omni's facade scrolls (sanitised to what it can letter). Same text → same object. */
export function setOmniMessage(state: GameState, raw: string): GameState {
  const omniMessage = sanitizeOmniMessage(raw);
  return state.omniMessage === omniMessage ? state : { ...state, omniMessage };
}

/** Pure: swap the tank shape. Cosmetic — nothing else changes. */
export function setTank(state: GameState, tank: TankShape): GameState {
  return state.tank === tank ? state : { ...state, tank };
}

/**
 * Pure: a new fish of `species`. Stats, name and age reset (the name dialog reopens);
 * structure, tank and clock format carry over. Same species → same object (no-op).
 */
export function newFish(state: GameState, species: SpeciesId, now = Date.now()): GameState {
  if (state.species === species) return state;
  return { ...defaultState(now), structure: state.structure, tank: state.tank, timeFormat: state.timeFormat, omniMessage: state.omniMessage, species };
}
