import type { FishModel, StructureModel } from "../types";
import { goldfish } from "./fish/goldfish";
import { betta } from "./fish/betta";
import { endler } from "./fish/endler";
import { chiliRasbora } from "./fish/chiliRasbora";
import { scarletBadis } from "./fish/scarletBadis";
import { peaPuffer } from "./fish/peaPuffer";
import { whiteCloud } from "./fish/whiteCloud";
import { castle } from "./structures/castle";
import { reunionTower } from "./structures/reunionTower";
import { eiffelTower } from "./structures/eiffelTower";
import { bigBen } from "./structures/bigBen";
import { parthenon } from "./structures/parthenon";
import { stonehenge } from "./structures/stonehenge";
import { pineapple } from "./structures/pineapple";
import { dallasCityHall } from "./structures/dallasCityHall";
import { dallasSkyline } from "./structures/dallasSkyline";

/** Keys are the game's SpeciesId / StructureId; the runtime manifest is typed against them, so a missing model fails the type-check. */
export const FISH_MODELS: Record<string, FishModel> = { goldfish, betta, endler, chiliRasbora, scarletBadis, peaPuffer, whiteCloud };
export const STRUCTURE_MODELS: Record<string, StructureModel> = { castle, reunionTower, eiffelTower, bigBen, parthenon, stonehenge, pineapple, dallasCityHall, dallasSkyline };
