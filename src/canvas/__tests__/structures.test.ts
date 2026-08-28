import { beforeAll, describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { STRUCTURE_REGISTRY, drawStructure } from "../structures";
import { type Atlas, loadAtlas, PX } from "../atlas";
import { STRUCTURES } from "../../game/catalog";
import { nodePlatform, publicBase } from "../../../scripts/lib/nodePlatform";

type Box = { x: number; y: number; w: number; h: number };
let atlas: Atlas;
beforeAll(async () => { atlas = await loadAtlas(nodePlatform, publicBase); });

/** Render one structure at full resolution and return the pixels of a logical box. */
const pixels = (id: keyof typeof STRUCTURE_REGISTRY, box: Box, fmt: "12h" | "24h" = "12h") => {
  const c = createCanvas(160 * PX, 144 * PX);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.setTransform(PX, 0, 0, PX, 0, 0);
  drawStructure(ctx, atlas, id, new Date(2026, 0, 1, 10, 30), fmt);
  return (ctx as unknown as { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } })
    .getImageData(box.x * PX, box.y * PX, box.w * PX, box.h * PX).data;
};

const paintedShare = (id: keyof typeof STRUCTURE_REGISTRY, box: Box) => {
  const px = pixels(id, box);
  let painted = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 40) painted++;
  return painted / (px.length / 4);
};

/** Count pixels matching an "#rrggbb" colour inside a box. */
const countColor = (id: keyof typeof STRUCTURE_REGISTRY, box: Box, hex: string, fmt: "12h" | "24h" = "12h") => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const px = pixels(id, box, fmt);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] === r && px[i + 1] === g && px[i + 2] === b) n++;
  return n;
};

describe("structure rendering", () => {
  test("declared passages are really open (≤10% painted); every structure paints inside its bounds", () => {
    for (const s of STRUCTURES) {
      const st = STRUCTURE_REGISTRY[s.id];
      for (const p of st.passages ?? []) expect(paintedShare(s.id, p)).toBeLessThanOrEqual(0.1);
      expect(paintedShare(s.id, st.bounds)).toBeGreaterThan(0.15);
    }
  });

  test("every clock panel is fully inside its structure's sprite box", () => {
    for (const s of STRUCTURES) {
      const { bounds: b, clock: c } = STRUCTURE_REGISTRY[s.id];
      expect(c.x).toBeGreaterThanOrEqual(b.x);
      expect(c.y).toBeGreaterThanOrEqual(b.y);
      expect(c.x + c.w).toBeLessThanOrEqual(b.x + b.w);
      expect(c.y + c.h).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  // The sign is squeezed in beside the clock panel; if either moves the text stops being readable.
  test("Dallas City Hall's sign stays legible — text is painted and the clock never covers it", () => {
    const board = { x: 97, y: 88, w: 27, h: 27 };
    for (const fmt of ["12h", "24h"] as const) {
      expect(countColor("dallasCityHall", board, "#8f1d1d", fmt)).toBeGreaterThan(80 * PX * PX * 0.6); // the lettering
      expect(countColor("dallasCityHall", board, "#7ef9a2", fmt)).toBe(0); // clock glow, kept clear
    }
  });
});
