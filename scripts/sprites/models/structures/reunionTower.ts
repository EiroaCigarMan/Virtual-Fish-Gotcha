import { box, cylinder, ellipsoid, hash, hex, merge, mixRGB, part, transform, type Mesh, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";

/**
 * Reunion Tower, Dallas: a low hotel/convention base (scene 56..104 × 104..124) carrying the
 * clock panel, three slim banded columns rising out of it into a geodesic ball of warm lamps
 * (centre scene (80, 54), r 12) and a short mast. Model space: ground y = 0, x = 0 at scene 80.
 */
const SHAFT = hex("#4a4640"), SHAFT_L = hex("#6e6a62"), SHAFT_D = hex("#2c2a26"), BAND = hex("#5c5850");
const BALL = hex("#1b2440"), BALL_EDGE = hex("#2c3a66"), LAMP = hex("#fff3c2"), LAMP_GOLD = hex("#ffd45a"), LAMP_DIM = hex("#9a7a2a");
const BASE = hex("#3a3f55"), BASE_L = hex("#6a7290"), WIN = hex("#ffe9a8"), WIN_DIM = hex("#8a7a50"), GLASS = hex("#2a3550");
const PANEL = hex("#0e1422");

/** Copy world positions into `loc` so a part's tex sees world coordinates. */
const bakeLoc = (m: Mesh): Mesh => ({ ...m, loc: m.pos.slice() });

/**
 * Clock recess: a 1-unit lip proud of the facade (+0.4) and a dark panel inset 0.4 behind it,
 * covering exactly x0..x1 × y0..y1. The facade must be cut out over the lip's outer rect
 * (see `withHole`) so the inset panel shows.
 */
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

const BW = 48, BH = 20, BD = 20; // base
const COLS = [-3, 0, 3], COL_TOP = 66;
const BX = 0, BY = 70, BR = 12; // ball

/** Base facade: dark blue-grey, a light cornice, a glass strip at the foot, lit windows on the flanks and side. */
const baseTex: TexFn = (x, y, z) => {
  if (y > BH - 0.7) return BASE_L; // cornice / roof edge
  const front = z > BD / 2 - 0.3, side = Math.abs(x) > BW / 2 - 0.3;
  if (front && y < 1.2) return GLASS; // lobby glass at the foot
  // window grid: columns every 3 units along the facade, rows every 4
  const u = front ? x : z;
  const cu = ((u % 3) + 3) % 3, ry = ((y % 4) + 4) % 4;
  const flank = front ? Math.abs(x) > BW / 2 - 4.6 : true;
  if ((front || side) && flank && cu > 0.5 && cu < 2.5 && ry > 1 && ry < 3.2 && y > 2 && y < BH - 1.5) {
    const i = Math.floor(u / 3) + Math.floor(y / 4) * 7;
    return hash(i, 1) < 0.7 ? WIN : WIN_DIM;
  }
  return BASE;
};

/** Banded columns: a dark band every 4 units, a lighter left face. */
const colTex: TexFn = (x, y) => {
  const cx = Math.round(x / 3) * 3, lx = x - cx;
  if (((y % 4) + 4) % 4 < 0.9) return BAND;
  if (lx < -0.55) return SHAFT_L;
  if (lx > 0.7) return SHAFT_D;
  return SHAFT;
};

/**
 * Geodesic lamp net on the ball: a triangular lattice in (lon, lat) space, lamps dotted along
 * the three line families and brighter where they cross; dark navy between.
 */
const ballTex: TexFn = (x, y, z) => {
  const px = x - BX, py = y - BY, pz = z;
  const lat = Math.asin(Math.max(-1, Math.min(1, py / BR))), lon = Math.atan2(px, pz);
  const u = lon * BR, v = lat * BR;
  const P = 4.2, LW = 0.42;
  const fams: [number, number][] = [[0, 1], [0.866, -0.5], [-0.866, -0.5]];
  let onLine = 0, bestD = 9, along = 0;
  for (const [nx, ny] of fams) {
    const c = u * nx + v * ny;
    const d = Math.abs(c / P - Math.round(c / P)) * P;
    if (d < LW) { onLine++; if (d < bestD) { bestD = d; along = u * -ny + v * nx; } }
  }
  if (onLine >= 2) return LAMP; // node
  if (onLine === 1) {
    const s = Math.abs(along / 2.1 - Math.round(along / 2.1)) * 2.1;
    if (s < 0.5) return hash(Math.round(along / 2.1), Math.round(u + v)) < 0.5 ? LAMP : LAMP_GOLD;
    return mixRGB(LAMP_DIM, BALL_EDGE, 0.55);
  }
  // rim sparkle so the silhouette twinkles
  if (Math.abs(pz) < BR * 0.25 && hash(Math.floor(u * 2), Math.floor(v * 2)) > 0.985) return LAMP_GOLD;
  return mixRGB(BALL, BALL_EDGE, 0.5 - pz / BR / 2);
};

export const reunionTower: StructureModel = {
  frame: { x: -27, y: 0, w: 54, h: 88 },
  at: { x: 53, y: 36 },
  view: { yaw: -7, pitch: 7 },
  build(): Part[] {
    const base = bakeLoc(transform(box(BW, BH, BD, BASE, [4, 2, 2]), { t: [0, BH / 2, 0] }));
    // clock recess in the base facade: model x -18..18, y 2..18 (scene 62..98 × 106..122)
    const recess = clockRecess(-18, 18, 2, 18, BD / 2, BASE_L);
    const columns = bakeLoc(merge(...COLS.map((x) => transform(box(2, COL_TOP - BH + 2, 2, SHAFT), { t: [x, (COL_TOP + BH - 2) / 2 + 1, 0] }))));
    const ball = bakeLoc(transform(ellipsoid(BR, BR, BR, 32, 20, BALL), { t: [BX, BY, 0] }));
    const mast = merge(
      transform(cylinder(0.7, 6, 8, SHAFT_D), { t: [BX, BY + BR + 2.4, 0] }),
      transform(box(1.2, 1, 1.2, LAMP_GOLD), { t: [BX, BY + BR + 5.6, 0] }),
    );
    return [
      part(base, { tex: withHole(baseTex, -18, 18, 2, 18, BD / 2), ks: 0.2, shininess: 14 }),
      part(recess, { ks: 0.1 }),
      part(columns, { tex: colTex, ks: 0.15, shininess: 10 }),
      part(ball, { tex: ballTex, ks: 0.25, shininess: 20, emissive: 1.3 }),
      part(mast, { ks: 0.2, emissive: 1.2 }),
    ];
  },
};
