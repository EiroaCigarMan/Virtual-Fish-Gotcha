/**
 * Headless render of the bowl scene to PNG (no browser needed).
 * Usage: bun scripts/snapshot.ts [outPath] [mood] [cleanliness] [12h|24h] [seconds] [structure] [species] [bowl|square] [ISO time — pins the clock and day/night]
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { FishEngine, H, PX, W } from "../src/canvas/engine";
import { loadAtlas } from "../src/canvas/atlas";
import { isSpeciesId, isStructureId, isTankShape } from "../src/game/catalog";
import type { FishMood, TimeFormat } from "../src/game/types";
import { nodePlatform, publicBase } from "./lib/nodePlatform";

const [out = "snapshot.png", mood = "content", clean = "100", fmt = "12h", secs = "3", structure = "castle", species = "goldfish", tank = "bowl", when = ""] = process.argv.slice(2);
if (!isStructureId(structure)) throw new Error(`unknown structure: ${structure}`);
if (!isSpeciesId(species)) throw new Error(`unknown species: ${species}`);
if (!isTankShape(tank)) throw new Error(`unknown tank: ${tank}`);
const canvas = createCanvas(W * PX, H * PX);
// FishEngine only needs width/height/getContext — the napi canvas satisfies that.
const fixed = when ? new Date(when) : null;
if (when && Number.isNaN(fixed!.getTime())) throw new Error(`bad time: ${when}`);
const engine = new FishEngine(canvas as unknown as HTMLCanvasElement, nodePlatform, fixed ? () => fixed : () => new Date());
engine.setAtlas(await loadAtlas(nodePlatform, publicBase));
engine.setInputs({ mood: mood as FishMood, cleanliness: Number(clean), happiness: 80, timeFormat: fmt as TimeFormat, structure, species, tank });
// Drive the private loop manually with fixed steps.
type Priv = { update(dt: number): void; render(): void; feed(): void };
const p = engine as unknown as Priv;
p.feed();
const steps = Math.round(Number(secs) / (1 / 60));
for (let i = 0; i < steps; i++) p.update(1 / 60);
p.render();
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`wrote ${out} (${W * PX}x${H * PX}) mood=${mood} clean=${clean} fmt=${fmt} structure=${structure} species=${species} tank=${tank}${fixed ? ` at=${fixed.toISOString()}` : ""}`);
