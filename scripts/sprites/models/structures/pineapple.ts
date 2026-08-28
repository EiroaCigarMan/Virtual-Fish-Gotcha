import { box, cylinder, deform, ellipsoid, extrude, hash, hex, merge, mixRGB, part, smoothstep, transform, type ColorFn, type Mesh, type Part, type RGB, type TexFn, type Xform } from "../../mesh";
import type { View } from "../../raster";
import type { StructureModel } from "../../types";

/**
 * The pineapple under the sea: an ellipsoid body in a diamond-lattice skin, a crown of leaf blades,
 * an arched blue door, two wood-rimmed portholes, and the clock recess set into the skin
 * (scene 62..98 × 94..110). Model space: ground y = 0 (scene 124), x = 0 at scene 80.
 */
const SKIN = hex("#e8a030"), SKIN_L = hex("#f8c860"), SKIN_D = hex("#b87418");
const LEAF = hex("#3f9a4a"), LEAF_L = hex("#6cc46e"), LEAF_D = hex("#2a6b33");
const DOOR = hex("#3a5a9a"), DOOR_D = hex("#23407a"), WIN = hex("#9ad8f0"), WIN_D = hex("#4a8ab0"), GLINT = hex("#eefaff");
const WOOD = hex("#8a5a2a"), WOOD_D = hex("#5e3c1a");
const RECESS = hex("#0e1422");
/** Night: a string of coloured bulbs round the rim and over the door, warm light in the windows, darker skin, dark leaves. */
const BULBS: RGB[] = [hex("#fff1c8"), hex("#ff3a3a"), hex("#3aff5a"), hex("#4a7aff"), hex("#ffe23a")];
const WARM = hex("#ffd88a"), WARM_L = hex("#fff2cc"), WARM_D = hex("#c08a40");
const LEAF_N = hex("#1d4a26"), LEAF_NL = hex("#2f6b38"), LEAF_ND = hex("#132e18"), DOOR_N = hex("#1e3260"), DOOR_ND = hex("#101d3a");
const VIEW: View = { yaw: -7, pitch: 7 };
/** Clock box in sprite space: scene 62..98 × 94..110. */
const CLOCK: SBox = { x0: -18, x1: 18, y0: 14, y1: 30 };
/** Body ellipsoid: centre (0, 22), radii 22 × 24 × 18, cut at the ground. */
const CY = 22, RX = 22, RY = 24, RZ = 18;

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
/** A camera-facing slab whose projection is exactly `b`, centred at view depth `d` (behind the skin). */
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

// ---- body ---------------------------------------------------------------------------------
/** z of the body's front surface above (x, y). */
const surfZ = (x: number, y: number) => RZ * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2 - (x / RX) ** 2));
/** Drape a world-placed mesh over the skin: each vertex's z becomes surface + lift + its own offset. */
function onSkin(m: Mesh, lift: number): Mesh {
  const out = deform(m, (x, y, z) => [x, y, surfZ(x, y) + lift + z]);
  out.loc = out.pos.slice();
  return out;
}
/** Diamond lattice wrapped around the body: dark grooves, a light facet toward the upper-left of each bump. */
const skin: TexFn = (x, y, z) => {
  if (y < 0) return null; // cut at the sand
  const u = Math.atan2(z, x) * RX;
  const a = (u + y) / 6, b = (u - y) / 6;
  const fa = a - Math.floor(a), fb = b - Math.floor(b);
  const d = Math.min(fa, 1 - fa, fb, 1 - fb);
  const foot = smoothstep(5, 0, y) * 0.3;
  if (d < 0.14) return mixRGB(SKIN_D, hex("#8a5410"), foot);
  const tone = 0.9 + 0.2 * hash(Math.floor(a), Math.floor(b));
  const ca = fa - 0.5; // + toward the upper-left of the cell
  let c: RGB = ca > 0.14 ? mixRGB(SKIN, SKIN_L, 0.85) : ca < -0.2 ? mixRGB(SKIN, SKIN_D, 0.4) : SKIN;
  c = [c[0] * tone, c[1] * tone, c[2] * tone];
  return mixRGB(c, SKIN_D, foot);
};

// ---- fittings -----------------------------------------------------------------------------
/** One leaf blade: a convex spike extruded 1.2 thick, curved and leaned outward, rooted at (bx, 44, bz). */
function leaf(bx: number, bz: number, h: number, lean: number, ry: number, base: RGB, tip: RGB): Mesh {
  const poly: [number, number][] = [[-1.9, 0], [1.9, 0], [1.4, h * 0.4], [0, h], [-1.4, h * 0.4]];
  const col: ColorFn = (_x, y) => mixRGB(base, tip, Math.min(1, y / h));
  const dir = Math.sign(lean);
  const m = deform(extrude(poly, 1.2, col), (x, y, z) => [x + dir * (y / h) ** 2 * 3, y, z]);
  return put(m, { r: [0, ry, -lean], t: [bx, 44, bz] });
}
const doorTex: TexFn = (x, y) => {
  const r = y < 8 ? Math.abs(x) : Math.hypot(x, y - 8);
  if (r > 3.3) return DOOR_D; // frame
  if (Math.abs(x) < 1.4 && y > 6.6 && y < 9.6) return Math.abs(x) < 0.25 || Math.abs(y - 8.1) < 0.25 ? DOOR_D : WIN; // little window
  if (Math.hypot(x - 2.4, y - 4.2) < 0.55) return SKIN_L; // knob
  if (Math.abs(x) < 0.25 && y < 6) return DOOR_D; // plank seam
  return DOOR;
};
const PORT: [number, number][] = [[-13, 36], [13, 36]];
const nearest = (x: number, y: number) => PORT.reduce((b, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? p : b));
const rimTex: TexFn = (x, y, z) => {
  const [px, py] = nearest(x, y);
  const r = Math.hypot(x - px, y - py), a = Math.atan2(y - py, x - px);
  return r > 3.8 ? WOOD_D : mixRGB(WOOD, WOOD_D, 0.25 * hash(Math.floor(a * 6), Math.floor(z)));
};
const glassTex: TexFn = (x, y) => {
  const [px, py] = nearest(x, y);
  const r = Math.hypot(x - px, y - py);
  if (Math.hypot(x - px + 1.1, y - py - 1.1) < 0.7) return GLINT;
  return r < 2.1 ? WIN : WIN_D;
};
/** The crown: back row `a`→`b`, front rows `b`→`c`, all leaning outward. */
function crown(a: RGB, b: RGB, c: RGB): Mesh {
  return merge(
    leaf(-7, -5, 15, -32, 25, a, b), leaf(7, -5, 15, 32, -25, a, b), leaf(0, -7, 13, 0, 0, a, b),
    leaf(-2, -6, 18, -8, 10, a, b), leaf(2.5, -6, 17, 10, -10, a, b),
    leaf(-4.5, -1, 21, -18, 15, b, c), leaf(4.5, -1, 21, 18, -15, b, c),
    leaf(-10, -2, 14, -45, 30, b, c), leaf(10, -2, 14, 45, -30, b, c),
    leaf(0, 3, 25, 0, 0, b, c), leaf(-3, 4, 17, -12, 12, b, c), leaf(3, 4, 17, 12, -12, b, c),
  );
}

// ---- night ----------------------------------------------------------------------------------
/** Door after dark: darker paint, the little window lit warm from inside. */
const doorTexNight: TexFn = (x, y) => {
  const c = doorTex(x, y);
  if (c === DOOR) return DOOR_N;
  if (c === DOOR_D) return DOOR_ND;
  if (c === WIN) return WARM_L;
  if (c === SKIN_L) return SKIN;
  return c;
};
/** Portholes glowing warm from inside. */
const glassTexNight: TexFn = (x, y, z) => {
  const c = glassTex(x, y, z);
  if (c === GLINT) return WARM_L;
  if (c === WIN) return WARM;
  return mixRGB(WARM, WARM_D, 0.5);
};
const rimTexNight: TexFn = (x, y, z) => mixRGB(rimTex(x, y, z), DOOR_ND, 0.35);
/**
 * The bulb string: small spheres every ~2.5 units along the body's outline (from the sand on the
 * right, over the crown, down to the sand on the left) and then over the door arch, colours
 * cycling through BULBS and shifted `k` steps so alternating frames chase.
 */
function bulbString(k: number): Mesh {
  const pts: [number, number, number][] = [];
  // rim: walk the x/y outline ellipse at a fine step and drop a bulb every 2.5 units of arc, slightly proud (×1.03) and toward the viewer
  const a0 = Math.asin(-CY / RY) + 0.08, a1 = Math.PI - Math.asin(-CY / RY) - 0.08;
  let acc = 2.5, px = RX * Math.cos(a0), py = CY + RY * Math.sin(a0);
  for (let a = a0; a <= a1; a += 0.002) {
    const x = RX * Math.cos(a), y = CY + RY * Math.sin(a);
    acc += Math.hypot(x - px, y - py); px = x; py = y;
    if (acc >= 2.5) { acc -= 2.5; pts.push([x * 1.03, CY + (y - CY) * 1.03, 1.2]); }
  }
  // door arch: r 5.2 about the arch centre (0, 8), left foot to right foot, lifted off the skin
  for (let i = 0; i <= 6; i++) {
    const t = Math.PI - (i / 6) * Math.PI, x = 5.2 * Math.cos(t), y = 8 + 5.2 * Math.sin(t);
    pts.push([x, y, surfZ(x, y) + 1.5]);
  }
  return merge(...pts.map((p, i) => transform(ellipsoid(0.6, 0.6, 0.6, 8, 5, BULBS[(i + k) % BULBS.length]), { t: p })));
}

export const pineapple: StructureModel = {
  frame: { x: -26, y: 0, w: 52, h: 74 },
  at: { x: 54, y: 50 },
  view: VIEW,
  nightFrames: 2,
  build(opts): Part[] {
    const night = !!opts?.night;
    const body = put(ellipsoid(RX, RY, RZ, 28, 16, SKIN), { t: [0, CY, 0] });
    const panel = facing(CLOCK, 6.5, VIEW, RECESS);
    // arched door, x -4..4 × y 0..12, draped on the skin
    const arch: [number, number][] = [[-4, 0], [4, 0]];
    for (let i = 0; i <= 8; i++) { const t = (i / 8) * Math.PI; arch.push([4 * Math.cos(t), 8 + 4 * Math.sin(t)]); }
    const door = onSkin(put(extrude(arch, 0.8, DOOR), {}), 0.5);
    // portholes: wood rim + glass disc, each draped on the skin
    const rims: Mesh[] = [], glass: Mesh[] = [];
    for (const [px, py] of PORT) {
      rims.push(onSkin(put(cylinder(4.3, 1.2, 20, WOOD), { r: [90, 0, 0], t: [px, py, 0] }), 0.7));
      glass.push(onSkin(put(cylinder(2.9, 0.6, 20, WIN_D), { r: [90, 0, 0], t: [px, py, 0] }), 1.3));
    }
    // the crown: back row dark, middle green, front light, all leaning outward
    const leaves = crown(LEAF_D, LEAF, LEAF_L);
    const cut = (t: TexFn) => withRecess(t, CLOCK, VIEW, SKIN_L, SKIN_D, 0); // fittings never paint over the clock box
    if (night) {
      return [
        part(body, { tex: withRecess(skin, CLOCK, VIEW, SKIN_L, SKIN_D), ks: 0.3, shininess: 20, emissive: 0.75 }),
        part(panel, { ks: 0 }),
        part(door, { tex: doorTexNight, ks: 0.2, shininess: 14, emissive: 1.2 }),
        part(merge(...rims), { tex: cut(rimTexNight), ks: 0.15, shininess: 10, emissive: 0.8 }),
        part(merge(...glass), { tex: cut(glassTexNight), ks: 0.2, shininess: 40, emissive: 1.6 }),
        part(crown(LEAF_ND, LEAF_N, LEAF_NL), { ks: 0.2, shininess: 12, emissive: 0.7 }),
        part(bulbString(opts?.frame ?? 0), { ks: 0, emissive: 2.5 }),
      ];
    }
    return [
      part(body, { tex: withRecess(skin, CLOCK, VIEW, SKIN_L, SKIN_D), ks: 0.3, shininess: 20 }),
      part(panel, { ks: 0 }),
      part(door, { tex: doorTex, ks: 0.2, shininess: 14 }),
      part(merge(...rims), { tex: cut(rimTex), ks: 0.15, shininess: 10 }),
      part(merge(...glass), { tex: cut(glassTex), ks: 0.6, shininess: 40 }),
      part(leaves, { ks: 0.2, shininess: 12 }),
    ];
  },
};
