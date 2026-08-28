/**
 * The baked sprite sheets (see scripts/sprites/) and their manifest, typed against the game's
 * ids so a species or structure without a model fails the type-check.
 */
import { FISH_SHEET, FISH_SPRITES, SPRITE_PX, STRUCTURE_SPRITES } from "./generated/manifest";
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
export interface StructureSprite { x: number; y: number; w: number; h: number; sy: number }

export const FISH: Record<SpeciesId, FishSprite> = FISH_SPRITES;
export const STRUCTURE: Record<StructureId, StructureSprite> = STRUCTURE_SPRITES;
export const FISH_ROW_Y = FISH_SHEET.rowY;

export interface Atlas {
  fish: CanvasImageSource;
  structures: CanvasImageSource;
}

export async function loadAtlas(platform: Platform, base: string): Promise<Atlas> {
  const [fish, structures] = await Promise.all([platform.loadImage(`${base}sprites/fish.png`), platform.loadImage(`${base}sprites/structures.png`)]);
  return { fish, structures };
}
