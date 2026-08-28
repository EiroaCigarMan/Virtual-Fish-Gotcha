import type { FishModel, StructureModel } from "../types";
import { goldfish } from "./fish/goldfish";
import { castle } from "./structures/castle";

/** Keys are the game's SpeciesId / StructureId; every id must appear here or the bake fails typecheck downstream. */
export const FISH_MODELS: Record<string, FishModel> = { goldfish };
export const STRUCTURE_MODELS: Record<string, StructureModel> = { castle };
