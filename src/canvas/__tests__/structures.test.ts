import { describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { STRUCTURE_REGISTRY } from "../structures";
import { STRUCTURES } from "../../game/catalog";

type Box = { x: number; y: number; w: number; h: number };

const pixels = (id: keyof typeof STRUCTURE_REGISTRY, box: Box, fmt: "12h" | "24h" = "12h") => {
  const c = createCanvas(160, 144);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  STRUCTURE_REGISTRY[id].draw(ctx, new Date(2026, 0, 1, 10, 30), fmt);
  return (ctx as unknown as { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } }).getImageData(box.x, box.y, box.w, box.h).data;
};

const paintedShare = (id: keyof typeof STRUCTURE_REGISTRY, box: Box) => {
  const px = pixels(id, box);
  let painted = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) painted++;
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

  // The sign is squeezed in beside a 36x12 clock panel; if either moves the text stops being readable.
  test("Dallas City Hall's sign stays legible — text is painted and the clock never covers it", () => {
    const board = { x: 97, y: 88, w: 27, h: 27 };
    for (const fmt of ["12h", "24h"] as const) {
      expect(countColor("dallasCityHall", board, "#8f1d1d", fmt)).toBeGreaterThan(80); // the lettering
      expect(countColor("dallasCityHall", board, "#7ef9a2", fmt)).toBe(0); // clock glow, kept clear
    }
  });
});
