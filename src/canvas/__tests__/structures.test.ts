import { beforeAll, describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { STRUCTURE_REGISTRY, drawStructure } from "../structures";
import { type Atlas, loadAtlas, PX } from "../atlas";
import { STRUCTURES } from "../../game/catalog";
import { TANK_GEOMS } from "../tank";
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

  test("every structure fits inside both tanks — ≤3% of its painted pixels fall outside the glass", () => {
    for (const s of STRUCTURES) {
      const b = STRUCTURE_REGISTRY[s.id].bounds;
      const px = pixels(s.id, b);
      for (const G of Object.values(TANK_GEOMS)) {
        let painted = 0, outside = 0;
        for (let y = 0; y < b.h * PX; y++) for (let x = 0; x < b.w * PX; x++) {
          if (px[(y * b.w * PX + x) * 4 + 3] <= 40) continue;
          painted++;
          const sx = b.x + x / PX, sy = b.y + y / PX;
          if (Math.abs(sx - G.cx) > G.halfW(sy) || sy < G.rimY) outside++;
        }
        expect(outside / painted).toBeLessThanOrEqual(0.03);
      }
    }
  });

  test("every clock recess is fully painted before the panel goes on (no see-through behind the clock)", () => {
    for (const s of STRUCTURES) expect(paintedShare(s.id, STRUCTURE_REGISTRY[s.id].clock)).toBeGreaterThan(0.99);
  });
});
