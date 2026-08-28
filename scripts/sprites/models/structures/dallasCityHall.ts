import { box, cylinder, extrude, hash, hex, merge, mixRGB, part, transform, type ColorFn, type Mesh, type Part, type RGB, type TexFn, type Xform } from "../../mesh";
import type { View } from "../../raster";
import type { StructureModel } from "../../types";

/**
 * Dallas City Hall (I. M. Pei), seen head-on from the plaza: a buff-concrete inverted pyramid,
 * half-width 20 + y/4 from the ground to the roof at y 72, with six recessed glass bands, a
 * lobby of recessed glass behind three fat columns, a rooftop mast, and the clock recess in the
 * fourth band (scene 58..94 × 90..106). A blank picket sign stands in the plaza to the right
 * (scene 97..124 × 88..115) — the runtime letters it. Model space: ground y = 0, x = 0 at scene 80.
 */
const CONC = hex("#b9b3a6"), CONC_L = hex("#dcd6c8"), CONC_D = hex("#8b8579"), SOFFIT = hex("#6d6862");
const GLASS = hex("#2b3a4e"), GLASS_L = hex("#40587a"), MULL = hex("#9a9488");
const POST = hex("#8a5a2a"), POST_D = hex("#5e3c1a"), BOARD = hex("#f2e8d5"), BOARD_D = hex("#c0b295");
const RECESS = hex("#0e1422");
const VIEW: View = { yaw: -7, pitch: 7 };
/** Clock box in sprite space: scene 58..94 × 90..106. */
const CLOCK: SBox = { x0: -22, x1: 14, y0: 18, y1: 34 };
/** Sign board and post in sprite space (scene 97..124 × 88..115; post 109..112 × 115..124). */
const SIGN: SBox = { x0: 17, x1: 44, y0: 9, y1: 36 };
const POST_BOX: SBox = { x0: 29, x1: 32, y0: 0, y1: 9 };

// ---- local helpers: sprite-space recesses and panels -------------------------------------
interface SBox { x0: number; x1: number; y0: number; y1: number }
/** The renderer's view rotation (see raster.ts) so recesses can be defined in sprite space. */
function toScreen(x: number, y: number, z: number, v: View): [number, number, number] {
  const yw = (v.yaw * Math.PI) / 180, p = (v.pitch * Math.PI) / 180;
  const x1 = x * Math.cos(yw) + z * Math.sin(yw), z1 = -x * Math.sin(yw) + z * Math.cos(yw);
  return [x1, y * Math.cos(p) - z1 * Math.sin(p), y * Math.sin(p) + z1 * Math.cos(p)];
}
/** Inverse of toScreen: the model point that projects to (sx, sy) at view depth d. */
function fromScreen(sx: number, sy: number, d: number, v: View): [number, number, number] {
  const yw = (v.yaw * Math.PI) / 180, p = (v.pitch * Math.PI) / 180;
  const y = sy * Math.cos(p) + d * Math.sin(p), z1 = -sy * Math.sin(p) + d * Math.cos(p);
  return [sx * Math.cos(yw) - z1 * Math.sin(yw), y, sx * Math.sin(yw) + z1 * Math.cos(yw)];
}
/** transform, then bake loc = pos so textures see world (model) coordinates. */
function put(m: Mesh, xf: Xform): Mesh { const t = transform(m, xf); t.loc = t.pos.slice(); return t; }
/** A camera-facing slab whose projection is exactly `b`, centred at view depth `d`. Textures see the slab's own local coords. */
function facing(b: SBox, d: number, v: View, color: ColorFn, thick = 0.4): Mesh {
  return transform(box(b.x1 - b.x0, b.y1 - b.y0, thick, color), { r: [-v.pitch, -v.yaw, 0], t: fromScreen((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, d, v) });
}
/** Cut the clock box out of a world-space texture and paint a lighter lip (shadowed on the top/left reveal) around it. */
function withRecess(base: TexFn, b: SBox, v: View, lip: RGB, shade: RGB, lipW = 1.2): TexFn {
  return (x, y, z) => {
    const [sx, sy] = toScreen(x, y, z, v);
    if (sx >= b.x0 && sx < b.x1 && sy >= b.y0 && sy < b.y1) return null;
    if (sx >= b.x0 - lipW && sx < b.x1 + lipW && sy >= b.y0 - lipW && sy < b.y1 + lipW) {
      return (sx < b.x0 && sx >= b.x0 - 0.45) || (sy >= b.y1 && sy < b.y1 + 0.45) ? shade : lip;
    }
    return base(x, y, z);
  };
}

// ---- materials ----------------------------------------------------------------------------
const hw = (y: number) => 20 + y / 4;
const FRONT_Z = 15;
const conc: TexFn = (x, y, z) =>
  mixRGB(CONC_D, CONC_L, 0.5 + 0.1 * hash(Math.floor(x / 2.3), Math.floor(y / 1.7), Math.floor(z / 2)) + 0.08 * hash(Math.floor(x * 1.3), Math.floor(y * 1.3), Math.floor(z * 1.3)) + (Math.abs(((y % 6) + 6) % 6 - 3) < 0.2 ? -0.08 : 0));
const BANDS = [69, 59, 49, 39, 29, 19]; // top of each 4-unit glass band
/** Front face: lobby opening, six window bands (soffit / light top edge / glass with mullions / sill), parapet. */
const facade: TexFn = (x, y, z) => {
  if (z < FRONT_Z - 0.1) return conc(x, y, z);
  const h = hw(y);
  if (y < 12 && Math.abs(x) < h - 4) return null; // lobby: open to the glass behind
  if (y > 71.2) return CONC_L; // parapet
  for (const top of BANDS) {
    if (y >= top - 4.8 && y < top + 0.8 && Math.abs(x) < h - 6) {
      if (y >= top) return SOFFIT;
      if (y < top - 4) return CONC_L;
      if (y >= top - 0.8) return GLASS_L;
      return (((x % 5) + 5) % 5) < 0.5 ? MULL : GLASS;
    }
  }
  return conc(x, y, z);
};
const lobby: TexFn = (x, y) => {
  if (y > 11) return GLASS_L;
  if ((((x % 5) + 5) % 5) < 0.5 || (y > 7.4 && y < 8)) return MULL;
  return mixRGB(GLASS, GLASS_L, 0.25 * (1 - y / 12));
};
const column: TexFn = (x, y, z) => (y > 15.4 ? CONC_D : conc(x, y, z));

export const dallasCityHall: StructureModel = {
  frame: { x: -42, y: 0, w: 88, h: 78 },
  at: { x: 38, y: 46 },
  view: VIEW,
  build(): Part[] {
    // the inverted pyramid: a trapezoid extruded 30 deep, front face at z = 15
    const body = put(extrude([[-20, 0], [20, 0], [38, 72], [-38, 72]], FRONT_Z * 2, CONC), {});
    // recessed lobby glass (4 deep) and the three columns standing proud of the facade
    const glass = put(box(39, 12, 3, GLASS, [8, 3, 1]), { t: [0, 6, 9.5] });
    const cols = merge(...[-17, 0, 17].map((cx) => put(box(5, 16, 5, CONC, [1, 4, 1]), { t: [cx, 8, 13.5] })));
    const mast = put(cylinder(0.6, 6, 8, CONC_D), { t: [0, 75, -2] });
    // clock recess in the fourth band: hole cut in sprite space, dark panel behind the facade
    const panel = facing(CLOCK, 13.8, VIEW, RECESS);
    // the picket sign, squarely facing the camera so its projection is exactly the runtime's text box (z ≈ 20, clear of the facade)
    const board = facing(SIGN, 27, VIEW, BOARD, 1.0);
    const post = facing(POST_BOX, 26.5, VIEW, POST, 1.5);
    return [
      part(body, { tex: withRecess(facade, CLOCK, VIEW, CONC_L, CONC_D), ks: 0.12, shininess: 8 }),
      part(glass, { tex: lobby, ks: 0.5, shininess: 30 }),
      part(cols, { tex: column, ks: 0.12, shininess: 8 }),
      part(mast, { ks: 0.3 }),
      part(panel, { ks: 0 }),
      part(board, { tex: (x, y) => (Math.abs(x) > 12.5 || Math.abs(y) > 12.5 ? BOARD_D : BOARD), ks: 0.08, shininess: 6 }),
      part(post, { tex: (x) => (x > 0.5 ? POST_D : POST), ks: 0.1, shininess: 6 }),
    ];
  },
};
