import { box, cylinder, hash, hex, merge, mixRGB, part, transform, type Part, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";
import { bakeLoc, clockRecess, withHole } from "./common";

/**
 * The Omni Dallas: a wide, gently curved slab of dark glass — much wider than it is tall —
 * whose whole facade is wrapped in horizontal LED strips, one per floor, that the hotel lights
 * up with words and pictures. Here the strips are the runtime's LED field (scene 38..122 ×
 * 71..103, one cell per logical unit); the bake supplies the glass, the strip lines, the
 * windows, the "OMNI HOTEL" crown and the podium with the clock recess (x −18..18, y 2..18).
 * Night frame: every window dark — after dark only the LED strips and the neon sign glow. Model space: ground y = 0, x = 0 at scene 80.
 */
const SLAB = hex("#232a3a"), SLAB_L = hex("#3b4458"), CROWN = hex("#454c60"), CROWN_L = hex("#8a92a8");
const GLASS = hex("#1d2839"), GLASS_L = hex("#31465f"), WIN_OFF = hex("#0d1420");
const STRIP = hex("#101724"), STRIP_EDGE = hex("#2b3448");
const PODIUM = hex("#5a5f6e"), PODIUM_L = hex("#8d93a4");

/** The LED field in model space (x, y) — the runtime draws over exactly this box. */
export const OMNI_FIELD = { x0: -42, x1: 42, y0: 21, y1: 53 };

export const omniHotel: StructureModel = {
  frame: { x: -46, y: 0, w: 92, h: 62 },
  at: { x: 34, y: 62 },
  view: { yaw: 0, pitch: 6 },
  nightFrames: 1,
  build(opts): Part[] {
    const night = !!opts?.night;
    const PD = 16;
    // podium (lobby + convention block) with the clock recess
    const podium = bakeLoc(transform(box(52, 20, PD, PODIUM, [4, 2, 2]), { t: [0, 10, 0] }));
    const podiumTex: TexFn = (x, y, z) => {
      if (y > 19.4) return PODIUM_L;
      if (z > PD / 2 - 0.3 && y < 1.5) return GLASS;
      return ((y % 5) + 5) % 5 < 0.5 ? mixRGB(PODIUM, STRIP, 0.5) : PODIUM;
    };
    // the slab: a shallow arc of a very fat cylinder so the facade bows toward the viewer
    const R = 140, DEPTH = 14, H = 36;
    const slab = bakeLoc(transform(cylinder(R, H, 160, SLAB, R, 6), { t: [0, 20 + H / 2, -R + DEPTH / 2] }));
    const slabTex: TexFn = (x, y, z) => {
      if (z < -DEPTH / 2 - 0.5 || Math.abs(x) > 45) return null; // front arc only
      if (y > 20 + H - 0.6) return CROWN_L; // roof edge
      // floor strips every 2 units: a dark LED channel with a lit edge line (the strip itself is
      // drawn live); between them, dark glass with windows
      const fy = ((y - OMNI_FIELD.y0) % 2 + 2) % 2;
      const inField = y > OMNI_FIELD.y0 && y < OMNI_FIELD.y1 && Math.abs(x) < 42.5;
      if (inField && fy < 0.55) return fy < 0.15 ? STRIP_EDGE : STRIP;
      // windows: 2-unit bays
      const cu = ((x % 2.2) + 2.2) % 2.2;
      if (cu > 0.35 && cu < 1.95 && fy > 0.8 && fy < 1.85) {
        const i = Math.floor(x / 2.2) + Math.floor(y / 2) * 53;
        if (night) return WIN_OFF; // no window lights: the LED strips and the neon sign are the show
        return hash(i, 0) < 0.4 ? GLASS_L : GLASS;
      }
      return mixRGB(SLAB, SLAB_L, 0.5 + z / DEPTH);
    };
    // crown: a low parapet block carrying the sign (lettered live)
    const crown = bakeLoc(transform(box(30, 4, 6, CROWN, [2, 1, 1]), { t: [0, 20 + H + 2, DEPTH / 2 - 3] }));
    const crownTex: TexFn = (_x, y) => (y > 20 + H + 3.6 ? CROWN_L : CROWN);
    const cap = merge(transform(box(0.8, 4, 0.8, CROWN_L), { t: [-16, 20 + H + 2, DEPTH / 2 - 3] }), transform(box(0.8, 4, 0.8, CROWN_L), { t: [16, 20 + H + 2, DEPTH / 2 - 3] }));
    return [
      part(podium, { tex: withHole(podiumTex, -18, 18, 2, 18, PD / 2), ks: 0.15, shininess: 10, emissive: night ? 0.7 : 1 }),
      part(clockRecess(-18, 18, 2, 18, PD / 2, PODIUM_L), { ks: 0.1 }),
      part(slab, { tex: slabTex, ks: 0.35, shininess: 22, emissive: night ? 1.0 : 1 }),
      part(crown, { tex: crownTex, ks: 0.2, emissive: night ? 0.9 : 1 }),
      part(cap, { ks: 0.2 }),
    ];
  },
};
