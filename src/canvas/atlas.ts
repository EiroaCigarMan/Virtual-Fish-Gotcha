/**
 * The baked sprite sheets (see scripts/sprites/) and their manifest, typed against the game's
 * ids so a species or structure without a model fails the type-check.
 */
import { FISH_SHEET, FISH_SPRITES, SPRITE_PX, STRUCTURE_SHEET, STRUCTURE_SPRITES } from "./generated/manifest";
import type { SpeciesId, StructureId } from "../game/types";
import type { Platform } from "./platform";

/** Physical sheet pixels per logical scene pixel. The engine draws through this same factor. */
export const PX = SPRITE_PX;

export interface FishSprite {
  w: number; h: number; frames: number; row: number;
  /** Eye / mouth centres in frame coordinates (logical px) for the mood overlays. */
  eye: readonly [number, number]; mouth: readonly [number, number];
  /** Opaque bounding box of frame 0 — what the AI treats as the body. */
  hit: readonly [number, number];
}
export interface StructureSprite {
  x: number; y: number; w: number; h: number; sy: number;
  /** Sheet rows of the night variants, if the model bakes any (else the runtime dims the day sprite). */
  night?: readonly number[];
}

export const FISH: Record<SpeciesId, FishSprite> = FISH_SPRITES;
export const STRUCTURE: Record<StructureId, StructureSprite> = STRUCTURE_SPRITES;
export const FISH_ROW_Y = FISH_SHEET.rowY;
export const STRUCTURE_SHEET_SIZE = STRUCTURE_SHEET;

export interface Atlas {
  fish: CanvasImageSource;
  structures: CanvasImageSource;
  /** The structure sheet pushed toward night blue — for landmarks without baked night frames. Built by the engine. */
  structuresNight?: CanvasImageSource;
}

/** A copy of the structure sheet mixed toward a night blue (source-atop keeps the alpha). */
export function makeNightSheet(platform: Platform, structures: CanvasImageSource, w: number, h: number): CanvasImageSource {
  const c = platform.createCanvas(w * PX, h * PX);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(structures, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(20,30,70,0.5)";
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function loadAtlas(platform: Platform, base: string): Promise<Atlas> {
  const [fish, structures] = await Promise.all([platform.loadImage(`${base}sprites/fish.png`), platform.loadImage(`${base}sprites/structures.png`)]);
  return { fish, structures };
}
