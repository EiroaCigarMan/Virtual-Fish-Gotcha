import { box, deform, hash, hex, merge, mixRGB, part, smoothstep, transform, type ColorFn, type Mesh, type Part, type RGB, type TexFn, type Xform } from "../../mesh";
import type { View } from "../../raster";
import type { StructureModel } from "../../types";

/**
 * Stonehenge: the great trilithon (two tapered sarsens carrying a deep lintel that holds the clock,
 * scene 62..98 × 78..94) with a wide-open passage beneath it for the fish, a pair of smaller
 * lintelled uprights either side further back, and a fallen stone. Weathered grey with lichen
 * blotches and moss at the foot. Model space: ground y = 0 (scene 124), x = 0 at scene 80.
 */
const STONE = hex("#8f8a7c"), STONE_L = hex("#b3ae9e"), STONE_D = hex("#5d594e"), MOSS = hex("#5f7a45"), LICHEN = hex("#aca77c");
const RECESS = hex("#0e1422");
/** Night: deep cool grey stone, ground floodlight (#cfe0ff), silver moonlight on the lintel tops, dark moss. */
const NIGHT_D = hex("#232a3a"), NIGHT_L = hex("#586275"), FLOOD = hex("#cfe0ff"), MOON = hex("#dfe6f2"), MOSS_N = hex("#1a271a");
const VIEW: View = { yaw: -5, pitch: 7 };
/** Clock box in sprite space: scene 62..98 × 78..94. */
const CLOCK: SBox = { x0: -18, x1: 18, y0: 30, y1: 46 };

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

// ---- material -----------------------------------------------------------------------------
/** Weathered sarsen: two scales of blotching, grit, lichen patches, moss creeping up from the ground. */
const stone: TexFn = (x, y, z) => {
  // three offset cell grids at unrelated scales so the blotches don't read as tiles
  const blotch = (hash(Math.floor(x / 2.1), Math.floor(y / 2.7), Math.floor(z / 2.3)) + hash(Math.floor((x + 1.3) / 3.7), Math.floor((y + 0.9) / 3.1), Math.floor(z / 3.4)) + hash(Math.floor((x + 0.6) / 1.6), Math.floor((y + 1.7) / 1.9), Math.floor(z / 1.7))) / 3;
  const grit = hash(Math.floor(x * 1.6), Math.floor(y * 1.6), Math.floor(z * 1.6));
  let c = mixRGB(STONE_D, STONE_L, 0.32 + 0.4 * blotch + 0.18 * grit);
  if (blotch > 0.66) c = mixRGB(c, LICHEN, 0.45);
  const moss = smoothstep(4.5, 0.5, y) * (0.45 + 0.55 * hash(Math.floor(x / 1.5), 3, Math.floor(z / 1.5)));
  return mixRGB(c, MOSS, moss);
};

/**
 * Night sarsen: the day blotching remapped onto a deep cool grey, then floodlit from the ground
 * (full strength below `floodLo`, faded out by `floodHi`, strongest on the camera-facing side
 * around `zFront`), moon-silvered on faces above `moonY`, and the moss kept dark.
 */
function stoneNight(floodLo: number, floodHi: number, zFront: number, floodK = 1, moonY = Infinity): TexFn {
  return (x, y, z) => {
    const d = stone(x, y, z);
    const t = Math.max(0, Math.min(1, (0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2] - 0.3) / 0.4));
    let c = mixRGB(NIGHT_D, NIGHT_L, t);
    const facing = 0.45 + 0.55 * smoothstep(zFront - 5, zFront - 0.5, z);
    const f = floodK * (1 - smoothstep(floodLo, floodHi, y)) * facing;
    c = mixRGB(c, [FLOOD[0] * (0.58 + 0.3 * t), FLOOD[1] * (0.58 + 0.3 * t), FLOOD[2] * (0.58 + 0.3 * t)], f);
    if (y > moonY) c = mixRGB(c, [MOON[0] * (0.8 + 0.2 * t), MOON[1] * (0.8 + 0.2 * t), MOON[2] * (0.8 + 0.2 * t)], 0.85);
    const moss = smoothstep(4.5, 0.5, y) * (0.45 + 0.55 * hash(Math.floor(x / 1.5), 3, Math.floor(z / 1.5)));
    return mixRGB(c, MOSS_N, moss);
  };
}

/** A standing stone: a subdivided box, tapered toward the top and lumped by a position hash, footed on the ground. */
function boulder(w: number, h: number, d: number, x: number, z: number, taper = 0.12, lump = 0.35): Mesh {
  const m = deform(box(w, h, d, STONE, [2, 4, 2]), (px, py, pz) => {
    const t = py / h + 0.5; // 0 at the foot, 1 at the top
    const s = 1 - taper * t;
    const n = (k: number) => (hash(px + 11 * k, py, pz) - 0.5) * 2 * lump;
    return [px * s + n(1), py + n(2) * 0.5 * t, pz * s + n(3)];
  });
  return put(m, { t: [x, h / 2, z] });
}
/** A lintel: lightly lumped slab, centred on (x, y, z). */
function slab(w: number, h: number, d: number, x: number, y: number, z: number, lump = 0.22): Mesh {
  const m = deform(box(w, h, d, STONE, [4, 2, 2]), (px, py, pz) => {
    const n = (k: number) => (hash(px + 7 * k, py, pz) - 0.5) * 2 * lump;
    return [px + n(1), py + n(2), pz + n(3)];
  });
  return put(m, { t: [x, y, z] });
}

export const stonehenge: StructureModel = {
  frame: { x: -46, y: 0, w: 92, h: 50 },
  at: { x: 34, y: 74 },
  view: VIEW,
  nightFrames: 1,
  build(opts): Part[] {
    const night = !!opts?.night;
    // the great trilithon: uprights x -24..-16 and 16..24 (y 0..32), lintel x -26..26 × y 29..47
    const uprights = merge(boulder(8, 32, 9, -20, 0), boulder(8, 32, 9, 20, 0));
    const lintel = slab(52, 18, 10, 0, 38, 0);
    // outer ring, further back: two lintelled pairs (right pair sits 2 units left of the pixel art so the yaw keeps it in frame)
    const BZ = -16;
    const ring = merge(
      boulder(5, 20, 5, -35.5, BZ, 0.1, 0.3), boulder(5, 22, 5, -26.5, BZ, 0.1, 0.3), slab(16, 3, 5.5, -31, 21.5, BZ),
      boulder(5, 22, 5, 33.5, BZ, 0.1, 0.3), boulder(5, 20, 5, 40.5, BZ, 0.1, 0.3), slab(12.5, 3, 5.5, 37, 21.5, BZ),
    );
    // a fallen stone lying in front on the right (x 24..34, y 0..3), tumbled a little
    const fallen = put(deform(box(10, 3, 5, STONE, [2, 1, 1]), (px, py, pz) => [px + (hash(px, py, pz) - 0.5) * 0.4, py, pz + (hash(pz, px, py) - 0.5) * 0.4]), { r: [0, 18, 3], t: [29, 1.6, 8] });
    // clock recess in the lintel's face: hole cut in sprite space, dark panel behind
    const panel = facing(CLOCK, 6.0, VIEW, RECESS);
    if (night) {
      // floodlights: two low fixtures on the ground in front of the trilithon (outside the passage box)
      const lamps = merge(transform(box(2.4, 0.8, 1.6, FLOOD), { t: [-19, 0.4, 7] }), transform(box(2.4, 0.8, 1.6, FLOOD), { t: [19, 0.4, 7] }));
      return [
        part(uprights, { tex: stoneNight(8, 30, 4.5), ks: 0.08, shininess: 6, emissive: 1.3 }),
        part(lintel, { tex: withRecess(stoneNight(29, 47, 5, 0.3, 46.4), CLOCK, VIEW, mixRGB(NIGHT_L, MOON, 0.35), NIGHT_D), ks: 0.08, shininess: 6, emissive: 0.7 }),
        part(ring, { tex: stoneNight(6, 22, -13.5, 0.75, 22.6), ks: 0.08, shininess: 6, emissive: 1.0 }),
        part(fallen, { tex: stoneNight(1, 4, 10, 0.8), ks: 0.08, shininess: 6, emissive: 1.1 }),
        part(panel, { ks: 0 }),
        part(lamps, { ks: 0, emissive: 2.4 }),
      ];
    }
    return [
      part(uprights, { tex: stone, ks: 0.08, shininess: 6 }),
      part(lintel, { tex: withRecess(stone, CLOCK, VIEW, STONE_L, STONE_D), ks: 0.08, shininess: 6 }),
      part(ring, { tex: stone, ks: 0.08, shininess: 6 }),
      part(fallen, { tex: stone, ks: 0.08, shininess: 6 }),
      part(panel, { ks: 0 }),
    ];
  },
};
