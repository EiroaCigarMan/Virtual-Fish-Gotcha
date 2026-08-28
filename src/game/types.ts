export type StatName = "hunger" | "happiness" | "cleanliness";
export type ActionName = "feed" | "play" | "clean";
export type TimeFormat = "12h" | "24h";

export type FishMood = "content" | "hungry" | "bored" | "dirty" | "sad" | "sleepy";

/** The structure the fish swims around. Every one carries the clock in its lower portion. */
export type StructureId = "castle" | "reunionTower" | "eiffelTower" | "bigBen" | "parthenon" | "stonehenge" | "pineapple" | "dallasCityHall" | "dallasSkyline" | "omniHotel";

/** The tank the scene is drawn in: the round bowl or a square-cornered aquarium. Cosmetic. */
export type TankShape = "bowl" | "square";

/** Which fish lives in the bowl. Changing species starts a new fish. */
export type SpeciesId = "goldfish" | "betta" | "endler" | "chiliRasbora" | "scarletBadis" | "peaPuffer" | "whiteCloud";

export interface GameState {
  schemaVersion: 4;
  hunger: number; // 0-100, higher = fuller
  happiness: number;
  cleanliness: number;
  lastSeenAt: number;
  lastActionAt: Record<ActionName, number | null>;
  timeFormat: TimeFormat;
  fishName: string;
  createdAt: number;
  structure: StructureId;
  species: SpeciesId;
  tank: TankShape;
  /** What the Omni Hotel's facade scrolls (uppercase, ≤40 chars; empty = a default greeting). */
  omniMessage: string;
}
