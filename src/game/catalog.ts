import type { SpeciesId, StructureId, TankShape } from "./types";

/** Display metadata for pickers and docs. Visuals live in `canvas/`, flavor in `SPECIES_FLAVOR`. */
export interface CatalogEntry<Id extends string> { id: Id; label: string; emoji: string; blurb: string }

export const STRUCTURES: CatalogEntry<StructureId>[] = [
  { id: "castle", label: "Castle", emoji: "🏰", blurb: "The original stone keep" },
  { id: "reunionTower", label: "Reunion Tower", emoji: "🔮", blurb: "Dallas's lit-up ball on a stick" },
  { id: "eiffelTower", label: "Eiffel Tower", emoji: "🗼", blurb: "Iron lattice, Paris" },
  { id: "bigBen", label: "Big Ben", emoji: "🕰️", blurb: "London's clock tower — with a working dial" },
  { id: "parthenon", label: "Parthenon", emoji: "🏛️", blurb: "Marble columns on the Acropolis" },
  { id: "stonehenge", label: "Stonehenge", emoji: "🪨", blurb: "Standing stones on Salisbury Plain" },
  { id: "pineapple", label: "Pineapple", emoji: "🍍", blurb: "Who lives in one under the sea?" },
  { id: "dallasCityHall", label: "Dallas City Hall", emoji: "🏢", blurb: "Pei's inverted pyramid" },
  { id: "dallasSkyline", label: "Dallas Skyline", emoji: "🌆", blurb: "Reunion to the Omni — swim between the towers; lights up at night" },
  { id: "omniHotel", label: "Omni Hotel", emoji: "🏨", blurb: "Its LED facade talks: graphics, your message, the time, the weather" },
];

export const SPECIES: CatalogEntry<SpeciesId>[] = [
  { id: "goldfish", label: "Goldfish", emoji: "🐠", blurb: "The classic. Steady swimmer" },
  { id: "betta", label: "Betta", emoji: "🐟", blurb: "Big flowing fins, takes its time" },
  { id: "endler", label: "Endler's Livebearer", emoji: "🐡", blurb: "Tiny, colourful, quick" },
  { id: "chiliRasbora", label: "Chili Rasbora", emoji: "🌶️", blurb: "Pinky-nail sized, swims in a school" },
  { id: "scarletBadis", label: "Scarlet Badis", emoji: "🟥", blurb: "Shy red fish with pale bars" },
  { id: "peaPuffer", label: "Pea Puffer", emoji: "🟢", blurb: "Round, curious, hovers about" },
  { id: "whiteCloud", label: "White Cloud Minnow", emoji: "☁️", blurb: "Silver school with red tails" },
];

/** Light gameplay flavor per species — visual/behaviour only, stats decay the same for all. */
export interface SpeciesFlavor {
  /** Multiplier on mood-based swim speed. */
  speed: number;
  /** Number of fish drawn. >1 = a school that follows a leader. */
  school: number;
}

export const SPECIES_FLAVOR: Record<SpeciesId, SpeciesFlavor> = {
  goldfish: { speed: 1, school: 1 },
  betta: { speed: 0.75, school: 1 },
  endler: { speed: 1.35, school: 1 },
  chiliRasbora: { speed: 1.3, school: 6 },
  scarletBadis: { speed: 0.85, school: 1 },
  peaPuffer: { speed: 0.7, school: 1 },
  whiteCloud: { speed: 1.2, school: 5 },
};

export const TANKS: CatalogEntry<TankShape>[] = [
  { id: "bowl", label: "Round", emoji: "🫧", blurb: "The classic glass bowl" },
  { id: "square", label: "Square", emoji: "🟦", blurb: "A square-cornered aquarium — wider, flat glass" },
];

export const DEFAULT_TANK: TankShape = "bowl";
export const DEFAULT_STRUCTURE: StructureId = "castle";
export const DEFAULT_SPECIES: SpeciesId = "goldfish";

export const isStructureId = (v: unknown): v is StructureId => STRUCTURES.some((s) => s.id === v);
export const isTankShape = (v: unknown): v is TankShape => TANKS.some((t) => t.id === v);
export const isSpeciesId = (v: unknown): v is SpeciesId => SPECIES.some((s) => s.id === v);
export const structureInfo = (id: StructureId) => STRUCTURES.find((s) => s.id === id)!;
export const speciesInfo = (id: SpeciesId) => SPECIES.find((s) => s.id === id)!;
