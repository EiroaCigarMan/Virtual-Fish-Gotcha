import { beforeAll, describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { STRUCTURE_REGISTRY, drawStructure } from "../structures";
import { STRUCTURE } from "../atlas";
import { type Atlas, loadAtlas, makeNightSheet, PX, STRUCTURE_SHEET_SIZE } from "../atlas";
import { STRUCTURES } from "../../game/catalog";
import { TANK_GEOMS } from "../tank";
import { nodePlatform, publicBase } from "../../../scripts/lib/nodePlatform";

type Box = { x: number; y: number; w: number; h: number };
let atlas: Atlas;
beforeAll(async () => { const a = await loadAtlas(nodePlatform, publicBase); atlas = { ...a, structuresNight: makeNightSheet(nodePlatform, a.structures, STRUCTURE_SHEET_SIZE.w, STRUCTURE_SHEET_SIZE.h) }; });

/** Render one structure at full resolution and return the pixels of a logical box. */
const pixels = (id: keyof typeof STRUCTURE_REGISTRY, box: Box, fmt: "12h" | "24h" = "12h", night = false) => {
  const c = createCanvas(160 * PX, 144 * PX);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.setTransform(PX, 0, 0, PX, 0, 0);
  drawStructure(ctx, atlas, id, new Date(2026, 0, 1, 10, 30), fmt, "#1c1730", night, 0);
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

  test("night: Reunion Tower's ball is brighter at night", () => {
    const ball = { x: 66, y: 40, w: 28, h: 28 };
    const bright = (px: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 40 && px[i] + px[i + 1] + px[i + 2] > 600) n++; return n; };
    expect(bright(pixels("reunionTower", ball, "12h", true))).toBeGreaterThan(bright(pixels("reunionTower", ball, "12h", false)) * 1.3);
  });

  test("night: every structure with baked night frames renders a different frame at night, with the clock digits pixel-identical", () => {
    let withNight = 0;
    for (const s of STRUCTURES) {
      const st = STRUCTURE_REGISTRY[s.id];
      const b = st.bounds, c = st.clock;
      const day = Buffer.from(pixels(s.id, b, "12h", false)), night = Buffer.from(pixels(s.id, b, "12h", true));
      expect(day.equals(night)).toBe(false);
      const inner = { x: c.x + 2, y: c.y + 1, w: c.w - 4, h: c.h - 2 };
      expect(Buffer.from(pixels(s.id, inner, "12h", true)).equals(Buffer.from(pixels(s.id, inner, "12h", false)))).toBe(true);
      if (STRUCTURE[s.id].night?.length) withNight++;
    }
    expect(withNight).toBe(STRUCTURES.length); // every landmark has its own night look
  });

  test("night: the tinted sheet (fallback for landmarks without night frames) is darker than the day sheet", () => {
    const c = createCanvas(160 * PX, 144 * PX);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const lum = (img: CanvasImageSource) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      const px = (ctx as unknown as { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } }).getImageData(0, 0, c.width, c.height).data;
      let s = 0, n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 40) { s += px[i] + px[i + 1] + px[i + 2]; n++; } return s / n;
    };
    expect(lum(atlas.structuresNight!)).toBeLessThan(lum(atlas.structures) * 0.85);
  });

  test("every clock recess is fully painted before the panel goes on (no see-through behind the clock)", () => {
    for (const s of STRUCTURES) expect(paintedShare(s.id, STRUCTURE_REGISTRY[s.id].clock)).toBeGreaterThan(0.99);
  });
});
