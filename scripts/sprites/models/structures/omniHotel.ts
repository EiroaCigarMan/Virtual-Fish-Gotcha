import { box, cylinder, hash, hex, merge, mixRGB, part, transform, type Part, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";
import { bakeLoc, clockRecess, withHole } from "./common";

/**
 * The Omni Dallas: a broad, gently curved convention hotel whose whole facade is an LED skin.
 * Modelled as a wide slab with a shallow curve (a fat cylinder segment) carrying a big dark
 * display area (model x −20..20, y 24..60 → scene 60..100 × 64..100) that the runtime draws
 * on, a lit crown, a low podium with the clock recess (x −18..18, y 2..18), and window bands
 * either side of the display. Night frame: windows lit, the display's dark glass glows faintly.
 * Model space: ground y = 0, x = 0 at scene 80.
 */
const SLAB = hex("#3a4056"), SLAB_L = hex("#5a627c"), SLAB_D = hex("#262a3a"), CROWN = hex("#8a92a8");
const GLASS = hex("#26344c"), GLASS_L = hex("#3d5675"), WIN_LIT = hex("#ffe6a6"), WIN_OFF = hex("#101826");
const DISPLAY = hex("#070a12"), DISPLAY_GRID = hex("#101826"), DISPLAY_NIGHT = hex("#0b1020");
const PODIUM = hex("#5a5f6e"), PODIUM_L = hex("#8d93a4");

export const DISPLAY_BOX = { x0: -20, x1: 20, y0: 24, y1: 60 };

export const omniHotel: StructureModel = {
  frame: { x: -32, y: 0, w: 64, h: 74 },
  at: { x: 48, y: 50 },
  view: { yaw: 0, pitch: 6 },
  nightFrames: 1,
  build(opts): Part[] {
    const night = !!opts?.night;
    const PD = 16;
    // podium with the clock recess
    const podium = bakeLoc(transform(box(44, 20, PD, PODIUM, [4, 2, 2]), { t: [0, 10, 0] }));
    const podiumTex: TexFn = (x, y, z) => {
      if (y > 19.4) return PODIUM_L;
      if (z > PD / 2 - 0.3 && y < 1.5) return GLASS;
      return ((y % 5) + 5) % 5 < 0.5 ? mixRGB(PODIUM, SLAB_D, 0.5) : PODIUM;
    };
    // the curved slab: a wide, shallow cylinder segment (only its front is kept by the tex)
    const R = 90, DEPTH = 14;
    const slab = bakeLoc(transform(cylinder(R, 48, 96, SLAB, R, 8), { t: [0, 20 + 24, -R + DEPTH / 2] }));
    const slabTex: TexFn = (x, y, z) => {
      if (z < -DEPTH / 2 - 0.5 || Math.abs(x) > 26.5) return null; // keep the front arc of the drum only
      if (y > 67.4) return CROWN;
      const inDisplay = x > DISPLAY_BOX.x0 && x < DISPLAY_BOX.x1 && y > DISPLAY_BOX.y0 && y < DISPLAY_BOX.y1;
      if (inDisplay) {
        // LED skin: a faint cell grid on near-black glass
        const cx = ((x % 2) + 2) % 2, cy = ((y % 2) + 2) % 2;
        const grid = cx < 0.25 || cy < 0.25;
        return night ? (grid ? DISPLAY_NIGHT : mixRGB(DISPLAY, DISPLAY_NIGHT, 0.5)) : grid ? DISPLAY_GRID : DISPLAY;
      }
      // window bands either side of the display and above it
      const cu = ((x % 2.6) + 2.6) % 2.6, ry = ((y % 3) + 3) % 3;
      if (cu > 0.5 && cu < 2.1 && ry > 0.6 && ry < 2.4 && y > 21 && y < 66) {
        const i = Math.floor(x / 2.6) + Math.floor(y / 3) * 29;
        if (night) return hash(i, 5) < 0.55 ? WIN_LIT : WIN_OFF;
        return hash(i, 0) < 0.4 ? GLASS_L : GLASS;
      }
      return mixRGB(SLAB, SLAB_L, 0.5 + z / DEPTH);
    };
    // display bezel: a thin lit frame so the panel reads as a screen
    const bezel = merge(
      transform(box(42, 0.8, 1, SLAB_L), { t: [0, DISPLAY_BOX.y1 + 0.4, DEPTH / 2 + 0.2] }),
      transform(box(42, 0.8, 1, SLAB_L), { t: [0, DISPLAY_BOX.y0 - 0.4, DEPTH / 2 + 0.2] }),
      transform(box(0.8, 36, 1, SLAB_L), { t: [DISPLAY_BOX.x0 - 0.4, 42, DEPTH / 2 + 0.2] }),
      transform(box(0.8, 36, 1, SLAB_L), { t: [DISPLAY_BOX.x1 + 0.4, 42, DEPTH / 2 + 0.2] }),
    );
    const crownSign = transform(box(14, 2.2, 1, night ? WIN_LIT : CROWN), { t: [0, 69.6, DEPTH / 2 - 1] });
    return [
      part(podium, { tex: withHole(podiumTex, -18, 18, 2, 18, PD / 2), ks: 0.15, shininess: 10, emissive: night ? 0.7 : 1 }),
      part(clockRecess(-18, 18, 2, 18, PD / 2, PODIUM_L), { ks: 0.1 }),
      part(slab, { tex: slabTex, ks: 0.35, shininess: 20, emissive: night ? 1.05 : 1 }),
      part(bezel, { ks: 0.4, shininess: 20, emissive: night ? 1.3 : 1 }),
      part(crownSign, { ks: 0.3, emissive: night ? 2 : 1 }),
    ];
  },
};
