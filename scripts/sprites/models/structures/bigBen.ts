import { box, cylinder, hash, hex, merge, mixRGB, part, transform, type Mesh, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";

/**
 * Big Ben, London: a stretch of the Palace of Westminster (scene 44..100 × 100..124, carrying
 * the clock panel) with the Elizabeth Tower on its right (scene 98..114) rising to a belfry, a
 * green-grey spire and a gold tip. The dial is blank — the runtime draws live hands over it at
 * scene (106, 70). Model space: ground y = 0, x = 0 at scene 80.
 */
const STONE = hex("#c9b58a"), STONE_L = hex("#e6d6ad"), STONE_D = hex("#8c7a55"), MORTAR = hex("#a8956a");
const ROOF = hex("#4b6b5a"), ROOF_D = hex("#2f4a3c"), DIAL = hex("#f4ecd0"), WIN = hex("#2a2340"), GOLD = hex("#e2b24a");
const PANEL = hex("#0e1422");

const bakeLoc = (m: Mesh): Mesh => ({ ...m, loc: m.pos.slice() });

/** Clock recess: lip proud +0.4, dark panel inset 0.4, covering exactly x0..x1 × y0..y1 (facade cut via `withHole`). */
function clockRecess(x0: number, x1: number, y0: number, y1: number, zFace: number, lip: RGB): Mesh {
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fz = zFace - 0.1;
  return merge(
    transform(box(w + 2, 1, 1, lip), { t: [cx, y1 + 0.5, fz] }),
    transform(box(w + 2, 1, 1, lip), { t: [cx, y0 - 0.5, fz] }),
    transform(box(1, h, 1, lip), { t: [x0 - 0.5, cy, fz] }),
    transform(box(1, h, 1, lip), { t: [x1 + 0.5, cy, fz] }),
    transform(box(w + 0.4, h + 0.4, 0.6, PANEL), { t: [cx, cy, zFace - 0.7] }),
  );
}
const withHole = (tex: TexFn, x0: number, x1: number, y0: number, y1: number, zFace: number): TexFn =>
  (x, y, z) => (z > zFace - 0.5 && x > x0 - 1 && x < x1 + 1 && y > y0 - 1 && y < y1 + 1 ? null : tex(x, y, z));

// wing: scene 44..100 → model -36..20; tower: scene 98..114 → model 18..34
const WX0 = -36, WX1 = 20, WH = 24, WD = 18;
const TX0 = 18, TX1 = 34, TCX = (TX0 + TX1) / 2, TH = 66, TD = 16;
const DIAL_R = 6.5;
/**
 * The dial must PROJECT to model (26, 54) = scene (106, 70), where the runtime draws the hands.
 * Under yaw -7 / pitch 7 the face plane (z ≈ 9.2) shifts ~1.3 left and ~1.1 down, so it is
 * modelled at (27.3, 55.9) to land there.
 */
const DIAL_X = 27.3, DIAL_Y = 55.9;

/** Pointed-arch (lancet) window test: a w×h slot with a pointed head. */
const lancet = (lx: number, ly: number, w: number, h: number) => {
  if (Math.abs(lx) > w / 2 || ly < 0 || ly > h) return false;
  const head = h - w * 0.9;
  return ly < head || Math.abs(lx) < (w / 2) * (1 - (ly - head) / (h - head)) + 0.15;
};

/** Ashlar courses on the wing: rows every 3, staggered headers, a mortar line, hash-varied tone; lancets on the flanks. */
const wingTex: TexFn = (x, y, z) => {
  const front = z > WD / 2 - 0.3;
  if (front) {
    for (const wx of [-32.5, -29, 13.5, 17]) if (lancet(x - wx, y - 6, 2, 8)) return WIN;
    if (y > 22.6 && y < 23.4) return STONE_L; // string course under the parapet
  }
  const row = Math.floor(y / 3), my = ((y % 3) + 3) % 3;
  const u = front ? x : z;
  const mx = (((u + (row % 2 ? 3.5 : 0)) % 7) + 7) % 7;
  if (my < 0.4 || mx < 0.4) return MORTAR;
  const tone = hash(row, Math.floor((u + (row % 2 ? 3.5 : 0)) / 7)) * 0.5;
  return mixRGB(STONE, STONE_L, tone);
};

/** Gothic tower: vertical ribs every 2 units, a darker recessed field between, lancets up the front, belfry openings. */
const towerTex: TexFn = (x, y, z) => {
  const front = z > TD / 2 - 0.3, side = x > TX1 - 0.3;
  const u = front ? x - TCX : z;
  if (y > 59.5 && y < 66) {
    // belfry: three tall dark openings per face between ribs
    const cu = ((u % 4) + 4) % 4;
    if ((front || side) && cu > 0.9 && cu < 3.1 && y > 60.5 && y < 65.2 && Math.abs(u) < 6.5) return WIN;
    return ((u % 4) + 4) % 4 < 0.6 ? STONE_D : STONE;
  }
  if (front) for (const wy of [3, 11, 19, 27, 35]) if (lancet(u, y - wy, 3, 5.5)) return WIN;
  if (side) for (const wy of [3, 11, 19, 27, 35]) if (lancet(u, y - wy, 3, 5.5)) return WIN;
  // ribbing: pilaster strips at |u| = 6.2 and 2.2 (light), fine ribs every 2
  const cu = ((u % 2) + 2) % 2;
  const pil = Math.abs(Math.abs(u) - 6.4) < 0.7;
  if (pil) return STONE_L;
  if (cu < 0.45) return STONE_D;
  if (((y % 8) + 8) % 8 < 0.4) return MORTAR;
  return mixRGB(STONE, STONE_L, hash(Math.floor(u / 2), Math.floor(y / 8)) * 0.3);
};

export const bigBen: StructureModel = {
  frame: { x: -40, y: 0, w: 78, h: 86 },
  at: { x: 40, y: 38 },
  view: { yaw: -7, pitch: 7 },
  build(): Part[] {
    const wing = bakeLoc(transform(box(WX1 - WX0, WH, WD, STONE, [4, 2, 2]), { t: [(WX0 + WX1) / 2, WH / 2, 0] }));
    // parapet: small merlons along the front and back edges of the wing roof
    const merlons: Mesh[] = [];
    for (let x = WX0 + 2; x < TX0 - 1; x += 4) {
      merlons.push(transform(box(2, 2, 2, STONE_L), { t: [x, WH + 1, WD / 2 - 1] }));
      merlons.push(transform(box(2, 2, 2, STONE_L), { t: [x, WH + 1, -WD / 2 + 1] }));
    }
    // clock recess in the wing facade: model x -26..10, y 4..20 (scene 54..90 × 104..120)
    const recess = clockRecess(-26, 10, 4, 20, WD / 2, STONE_D);
    // the tower, with string courses and a belfry cornice
    const tower = bakeLoc(merge(
      transform(box(TX1 - TX0, TH, TD, STONE, [2, 6, 2]), { t: [TCX, TH / 2, 0] }),
    ));
    const courses = merge(
      transform(box(TX1 - TX0 + 1.2, 1, TD + 1.2, STONE_D), { t: [TCX, 44, 0] }),
      transform(box(TX1 - TX0 + 1.2, 1.2, TD + 1.2, STONE_D), { t: [TCX, 59.6, 0] }),
      transform(box(TX1 - TX0 + 2, 1.4, TD + 2, STONE_D), { t: [TCX, TH + 0.7, 0] }),
    );
    // corner pinnacles on the belfry cornice
    const pinnacles = merge(...[[TX0 + 0.8, TD / 2 - 0.8], [TX1 - 0.8, TD / 2 - 0.8], [TX0 + 0.8, -TD / 2 + 0.8], [TX1 - 0.8, -TD / 2 + 0.8]].map(([px, pz]) =>
      transform(cylinder(0.9, 3, 4, STONE_L, 0), { t: [px, TH + 1.4 + 1.5, pz] })));
    // spire: a green-grey pyramid to y 76, a slim spire to 80, gold tip to 82
    const spireCol: RGB | ((x: number, y: number, z: number) => RGB) = (_x, y) => mixRGB(ROOF, ROOF_D, Math.max(0, Math.min(1, y / 10 + 0.5)));
    const spire = merge(
      transform(cylinder(11, 10, 4, spireCol, 1.6), { t: [TCX, TH + 1.4 + 5, 0], r: [0, 45, 0] }),
      transform(cylinder(1.6, 4.5, 8, ROOF_D, 0.7), { t: [TCX, TH + 1.4 + 10 + 2.25, 0] }),
      transform(cylinder(0.9, 1.4, 8, GOLD), { t: [TCX, 80.6, 0] }),
      transform(cylinder(0.5, 1.6, 8, GOLD, 0), { t: [TCX, 82.1, 0] }),
    );
    // the dial: an ornate square surround, a gold ring and a blank cream face (front and right faces)
    const dialAt = (rot: [number, number, number], t: [number, number, number]) => transform(merge(
      transform(box(14.5, DIAL_R * 2 + 3, 0.6, STONE_D), { t: [0, 0, 0.3] }),
      transform(cylinder(DIAL_R, 0.6, 28, GOLD), { t: [0, 0, 0.9], r: [90, 0, 0] }),
      transform(cylinder(DIAL_R - 1.1, 0.4, 28, DIAL), { t: [0, 0, 1.2], r: [90, 0, 0] }),
    ), { r: rot, t });
    const dials = merge(
      dialAt([0, 0, 0], [DIAL_X, DIAL_Y, TD / 2]),
      dialAt([0, 90, 0], [TX1, DIAL_Y, 0]),
    );
    return [
      part(wing, { tex: withHole(wingTex, -26, 10, 4, 20, WD / 2), ks: 0.12, shininess: 8 }),
      part(merge(...merlons), { ks: 0.12, shininess: 8 }),
      part(recess, { ks: 0.1 }),
      part(tower, { tex: towerTex, ks: 0.12, shininess: 8 }),
      part(merge(courses, pinnacles), { ks: 0.12, shininess: 8 }),
      part(spire, { ks: 0.3, shininess: 24 }),
      part(dials, { ks: 0.45, shininess: 30 }),
    ];
  },
};
