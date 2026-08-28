import { box, cylinder, extrude, hash, hex, merge, mixRGB, part, smoothstep, transform, type ColorFn, type Mesh, type Part, type RGB, type TexFn, type Xform } from "../../mesh";
import type { View } from "../../raster";
import type { StructureModel } from "../../types";

/**
 * The Parthenon: three marble steps, eight fluted Doric columns in front of a dark cella, a deep
 * entablature with a triglyph/metope frieze either side of the clock recess (scene 62..98 × 86..102),
 * and a pediment with a shadowed tympanum. Model space: ground y = 0 (scene 124), x = 0 at scene 80.
 */
const MARBLE = hex("#e8e2d0"), MARBLE_D = hex("#b8b09a"), MARBLE_DD = hex("#8a8270"), SHADE = hex("#5c5648"), FRIEZE = hex("#c9bfa6");
const RECESS = hex("#0e1422");
const VIEW: View = { yaw: -7, pitch: 7 };
/** Clock box in sprite space (== model space at z = 0): scene 62..98 × 86..102. */
const CLOCK: SBox = { x0: -18, x1: 18, y0: 22, y1: 38 };

// ---- local helpers: sprite-space recesses -------------------------------------------------
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
/** A camera-facing slab whose projection is exactly `b`, centred at view depth `d` (behind the facade). */
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
const grain = (x: number, y: number, z: number) =>
  0.78 + 0.14 * hash(Math.floor(x / 3), Math.floor(y / 3), Math.floor(z / 3)) + 0.08 * hash(Math.floor(x * 1.5), Math.floor(y * 1.5), Math.floor(z * 1.5));
const marble: TexFn = (x, y, z) => mixRGB(MARBLE_D, MARBLE, grain(x, y, z));

const COL_X = Array.from({ length: 8 }, (_, i) => -31.5 + i * 9);
const COL_Z = 6.5;
/** 12 flutes per shaft: grooves darken toward their centre line. */
const fluted: TexFn = (x, y, z) => {
  const cx = COL_X.reduce((b, c) => (Math.abs(c - x) < Math.abs(b - x) ? c : b));
  const a = Math.atan2(z - COL_Z, x - cx) / (Math.PI * 2);
  const g = (((a * 12) % 1) + 1) % 1;
  const ridge = smoothstep(0, 0.42, Math.min(g, 1 - g));
  return mixRGB(MARBLE_DD, MARBLE, (0.25 + 0.75 * ridge) * grain(x, y, z));
};

const ENT_Z = 9; // entablature / pediment front face
/** Architrave + triglyph/metope frieze + a shadow line under the cornice, on the front face only. */
const entablature: TexFn = (x, y, z) => {
  if (z < ENT_Z - 0.1) return marble(x, y, z);
  if (y >= 26 && y < 26.6) return MARBLE_D; // taenia
  if (y >= 26.6 && y < 35) {
    const u = (((x + 3) % 6) + 6) % 6;
    if (u < 2.4) return (u >= 0.5 && u < 1.0) || (u >= 1.4 && u < 1.9) ? MARBLE_DD : MARBLE_D; // triglyph
    return mixRGB(FRIEZE, MARBLE, 0.35 * hash(Math.floor((x + 3) / 6), 2)); // metope
  }
  if (y >= 35 && y < 35.8) return MARBLE_DD; // shadow under the cornice
  return marble(x, y, z);
};
/** Recessed tympanum inside a marble raking cornice. */
const pediment: TexFn = (x, y, z) => {
  if (z > ENT_Z - 0.1) {
    const edge = 39 * (1 - (y - 38) / 10);
    if (y > 39.6 && Math.abs(x) < edge - 2.6) return mixRGB(SHADE, MARBLE_DD, 0.35 + 0.2 * hash(Math.floor(x / 2), Math.floor(y / 2)));
  }
  return marble(x, y, z);
};

export const parthenon: StructureModel = {
  frame: { x: -42, y: 0, w: 84, h: 52 },
  at: { x: 38, y: 72 },
  view: VIEW,
  build(): Part[] {
    // stylobate: three steps, each narrower and shallower than the one below
    const steps = merge(
      put(box(80, 4, 22, MARBLE, [4, 1, 2]), { t: [0, 2, 0] }),
      put(box(76, 2, 20, MARBLE, [4, 1, 2]), { t: [0, 5, 0] }),
      put(box(72, 2, 18, MARBLE, [4, 1, 2]), { t: [0, 7, 0] }),
    );
    // the cella: a dark block behind the colonnade
    const cella = put(box(64, 14, 12, SHADE, [4, 2, 1]), { t: [0, 15, -2] });
    // eight Doric columns: tapered fluted shaft, echinus, square abacus (y 8..22)
    const shafts: Mesh[] = [], caps: Mesh[] = [];
    for (const cx of COL_X) {
      shafts.push(put(cylinder(2.3, 12, 16, MARBLE, 2.0, 2), { t: [cx, 14, COL_Z] }));
      caps.push(put(cylinder(2.0, 0.8, 16, MARBLE, 2.7), { t: [cx, 20.4, COL_Z] }));
      caps.push(put(box(5.4, 1.2, 5.4, MARBLE), { t: [cx, 21.4, COL_Z] }));
    }
    // entablature y 22..38 (the recess is cut into its front), cornice ledge, pediment to the apex at y 48
    const entab = put(box(78, 16, 18, MARBLE, [6, 2, 2]), { t: [0, 30, 0] });
    const cornice = put(box(80, 1.2, 19.4, MARBLE, [4, 1, 2]), { t: [0, 38.6, 0] });
    const ped = put(extrude([[-39, 38], [39, 38], [0, 48]], 18, MARBLE), {});
    // clock recess: hole cut in sprite space, dark panel behind the facade
    const panel = facing(CLOCK, 8.4, VIEW, RECESS);
    const rec = (t: TexFn) => withRecess(t, CLOCK, VIEW, MARBLE, MARBLE_DD);
    return [
      part(steps, { tex: marble, ks: 0.22, shininess: 16 }),
      part(cella, { ks: 0.05, shininess: 6 }),
      part(merge(...shafts), { tex: fluted, ks: 0.25, shininess: 18 }),
      part(merge(...caps), { tex: marble, ks: 0.22, shininess: 16 }),
      part(entab, { tex: rec(entablature), ks: 0.22, shininess: 16 }),
      part(cornice, { tex: rec(marble), ks: 0.22, shininess: 16 }),
      part(ped, { tex: rec(pediment), ks: 0.22, shininess: 16 }),
      part(panel, { ks: 0 }),
    ];
  },
};
