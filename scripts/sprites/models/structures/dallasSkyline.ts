import { box, cylinder, ellipsoid, extrude, hash, hex, merge, mixRGB, part, transform, type Mesh, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";
import { bakeLoc, clockRecess, withHole } from "./common";

/**
 * The Dallas skyline at dusk, left to right as in the classic Trinity-side view: a small
 * Reunion Tower, open water, a street-level podium (the clock lives in it) carrying Fountain
 * Place's glass prism, Bank of America Plaza (the tallest, green argon outline at night) and
 * Renaissance Tower (X-braces, lit spire), open water again, then the Omni's curved hotel block
 * with its LED band. The two open stretches are passages the fish swim through.
 * Model space: ground y = 0, x = 0 at scene 80. Frame x −50..50.
 */
const CONC = hex("#6f7280"), CONC_L = hex("#9a9dab"), CONC_D = hex("#4a4c58");
const GLASS_D = hex("#1e2a3e"), GLASS = hex("#2c405c"), GLASS_L = hex("#4a6a8c"), MULLION = hex("#7c8aa0");
const GREEN_GLASS = hex("#2f6e6a"), GREEN_GLASS_L = hex("#4f9e94"), GREEN_GLASS_D = hex("#1f4a48");
const ARGON = hex("#5cffa8"), SPIRE_LIT = hex("#ffe9a0"), WIN_LIT = hex("#ffe8a8"), WIN_LIT2 = hex("#cfe0ff"), WIN_OFF = hex("#101826");
const OMNI = hex("#3a3f52"), OMNI_L = hex("#5c6278"), OMNI_BAND = hex("#2a3550"), OMNI_LED: RGB[] = [hex("#ff4d6d"), hex("#ffb84d"), hex("#4dd2ff"), hex("#7dff9a")];
const SHAFT = hex("#4a4640"), BALL = hex("#1b2440"), LAMP = hex("#fff3c2"), LAMP_GOLD = hex("#ffd45a"), LAMP_OFF = hex("#5a4a2a");

type Night = { on: boolean; frame: number };

/** Window grid on a box face: lit/unlit per window with a hash, denser + brighter at night. */
function windows(u: (x: number, y: number, z: number) => number, base: RGB, pitch: [number, number], night: Night, inset = 0.5): TexFn {
  return (x, y, z) => {
    const uu = u(x, y, z);
    const cu = ((uu % pitch[0]) + pitch[0]) % pitch[0], cy = ((y % pitch[1]) + pitch[1]) % pitch[1];
    if (cu < inset || cu > pitch[0] - inset || cy < inset || cy > pitch[1] - inset) return night.on ? mixRGB(base, WIN_OFF, 0.6) : base;
    const i = Math.floor(uu / pitch[0]) + Math.floor(y / pitch[1]) * 31;
    if (night.on) {
      const r = hash(i, night.frame * 7 + 3);
      return r < 0.45 ? WIN_LIT : r < 0.6 ? WIN_LIT2 : WIN_OFF;
    }
    return hash(i, 0) < 0.35 ? mixRGB(base, GLASS_L, 0.5) : mixRGB(base, GLASS_D, 0.35);
  };
}

const bldg = (w: number, h: number, d: number, x: number, color: RGB, z = 0, sub: [number, number, number] = [3, 6, 2]) =>
  bakeLoc(transform(box(w, h, d, color, sub), { t: [x, h / 2 + (z === 0 ? 0 : 0), z] }));

export const dallasSkyline: StructureModel = {
  frame: { x: -50, y: 0, w: 100, h: 88 },
  at: { x: 30, y: 36 },
  view: { yaw: 0, pitch: 6 },
  nightFrames: 2,
  build(opts): Part[] {
    const night: Night = { on: !!opts?.night, frame: opts?.frame ?? 0 };
    const parts: Part[] = [];

    // ---- podium: street-level block x −19..19, y 0..20, clock recess x −18..18, y 2..18 ----
    const PD = 18;
    const podium = bakeLoc(transform(box(38, 20, PD, CONC, [4, 2, 2]), { t: [0, 10, 0] }));
    const podiumTex: TexFn = (x, y, z) => {
      if (y > 19.3) return CONC_L;
      if (z > PD / 2 - 0.3 && y < 1.4) return GLASS_D; // street-level glass
      return ((y % 4) + 4) % 4 < 0.5 ? CONC_D : CONC;
    };
    parts.push(part(podium, { tex: withHole(podiumTex, -18, 18, 2, 18, PD / 2), ks: 0.15, shininess: 10, emissive: night.on ? 0.7 : 1 }));
    parts.push(part(clockRecess(-18, 18, 2, 18, PD / 2, CONC_L), { ks: 0.1 }));

    // ---- Fountain Place: a faceted green-glass prism x −19..−7, rising to 64 ----
    const fp = bakeLoc(transform(extrude([[-19, 20], [-7, 20], [-7, 50], [-13, 64], [-19, 56]], 12, GREEN_GLASS, [-13, 40]), { t: [0, 0, 0] }));
    const fpTex: TexFn = (x, y, z) => {
      const facet = y > 50 ? mixRGB(GREEN_GLASS_L, GREEN_GLASS, 0.5) : GREEN_GLASS;
      const row = ((y % 3) + 3) % 3, col = ((x % 3) + 3) % 3;
      if (row < 0.35 || col < 0.35) return night.on ? mixRGB(facet, WIN_OFF, 0.5) : mixRGB(facet, GREEN_GLASS_D, 0.6);
      if (night.on) { const r = hash(Math.floor(x / 3), Math.floor(y / 3) + night.frame * 11); return r < 0.35 ? mixRGB(WIN_LIT2, GREEN_GLASS_L, 0.4) : mixRGB(GREEN_GLASS_D, WIN_OFF, 0.5); }
      return z > 5 ? facet : mixRGB(facet, GREEN_GLASS_D, 0.4);
    };
    parts.push(part(fp, { tex: fpTex, ks: 0.5, shininess: 30, emissive: night.on ? 0.9 : 1 }));

    // ---- Bank of America Plaza: the tallest, x −5..7, to 86, dark glass; green argon outline at night ----
    const BA = { x0: -5, x1: 7, top: 82 };
    const bofa = bldg(12, BA.top - 20, 12, 1, GLASS, 0, [3, 8, 2]);
    // built from y 0 by bldg; lift it onto the podium
    const bofaUp = bakeLoc(transform(bofa, { t: [0, 20, 0] }));
    const bofaWin = windows((x) => x, GLASS, [2.4, 3], night);
    const bofaTex: TexFn = (x, y, z) => {
      const edge = Math.abs(x - BA.x0) < 0.7 || Math.abs(x - BA.x1) < 0.7 || (y > BA.top - 0.8 && y < BA.top + 1) || Math.abs(z - 6) < 0.6 && (Math.abs(x - BA.x0) < 1.1 || Math.abs(x - BA.x1) < 1.1);
      if (edge) return night.on ? ARGON : mixRGB(GLASS_L, ARGON, 0.25);
      if (y < 20.6) return CONC_L;
      return bofaWin(x, y, z);
    };
    parts.push(part(bofaUp, { tex: bofaTex, ks: 0.4, shininess: 24, emissive: night.on ? 1.15 : 1 }));

    // ---- Renaissance Tower: x 9..19, to 68, X-braces; a lit spire to 80 ----
    const ren = bakeLoc(transform(bldg(10, 48, 10, 14, GLASS, 0, [3, 8, 2]), { t: [0, 20, 0] }));
    const renWin = windows((x) => x, GLASS, [2.5, 3], night);
    const renTex: TexFn = (x, y, z) => {
      // two big X-braces on the front face (the real tower has lit X's)
      const lx = x - 14, ly = y - 20;
      const seg = Math.floor(ly / 25), yy = ly - seg * 25 - 12.5, xx = lx;
      const onX = Math.abs(Math.abs(xx / 5) - Math.abs(yy / 12.5)) < 0.09 && Math.abs(xx) < 4.8;
      if (z > 4.6 && onX) return night.on ? WIN_LIT : MULLION;
      return renWin(x, y, z);
    };
    parts.push(part(ren, { tex: renTex, ks: 0.4, shininess: 24, emissive: night.on ? 1.1 : 1 }));
    const spire = merge(
      transform(cylinder(2.2, 4, 10, CONC_D, 1.2), { t: [14, 70, 0] }),
      transform(cylinder(0.6, 8, 8, night.on ? SPIRE_LIT : CONC_L), { t: [14, 76, 0] }),
      transform(ellipsoid(1.0, 1.0, 1.0, 8, 6, night.on ? SPIRE_LIT : CONC_L), { t: [14, 80.4, 0] }),
    );
    parts.push(part(spire, { ks: 0.5, shininess: 30, emissive: night.on ? 2.2 : 1 }));

    // ---- background blocks (behind the podium towers, darker, no passages touched) ----
    const back1 = bakeLoc(transform(box(9, 40, 8, GLASS_D, [2, 4, 1]), { t: [-1, 40, -12] }));
    const back2 = bakeLoc(transform(box(8, 34, 8, GLASS_D, [2, 4, 1]), { t: [9, 37, -13] }));
    const backTex = windows((x) => x, GLASS_D, [2.2, 3], night);
    parts.push(part(merge(back1, back2), { tex: backTex, ks: 0.2, emissive: night.on ? 0.85 : 0.8 }));

    // ---- Reunion Tower (small), far left: base x −46..−36, three columns, ball at (−41, 46) r 7 ----
    const rbase = bakeLoc(transform(box(10, 8, 10, CONC, [2, 1, 1]), { t: [-41, 4, 0] }));
    parts.push(part(rbase, { tex: (x, y, z) => (y > 7.4 ? CONC_L : z > 4.7 && ((x % 2) + 2) % 2 < 1 && y > 2 && y < 6 ? (night.on ? WIN_LIT : GLASS_L) : CONC), ks: 0.15 }));
    const rcols = merge(...[-43, -41, -39].map((x) => transform(box(1.2, 34, 1.2, SHAFT), { t: [x, 8 + 17, 0] })));
    parts.push(part(rcols, { ks: 0.15, emissive: night.on ? 0.6 : 1 }));
    const ball = bakeLoc(transform(ellipsoid(7, 7, 7, 22, 14, BALL), { t: [-41, 46, 0] }));
    const ballTex: TexFn = (x, y, z) => {
      const px = x + 41, py = y - 46;
      const lat = Math.asin(Math.max(-1, Math.min(1, py / 7))), lon = Math.atan2(px, z);
      const u = lon * 7, v = lat * 7, P = 2.6;
      const onLine = [[0, 1], [0.866, -0.5], [-0.866, -0.5]].filter(([a, b]) => Math.abs(((u * a + v * b) / P) - Math.round((u * a + v * b) / P)) * P < 0.32).length;
      if (onLine >= 1) return night.on ? (night.frame === 0 || hash(Math.round(u), Math.round(v)) < 0.7 ? LAMP : LAMP_OFF) : (onLine >= 2 ? LAMP : LAMP_GOLD);
      return night.on ? mixRGB(BALL, hex("#0a0e1c"), 0.5) : BALL;
    };
    parts.push(part(ball, { tex: ballTex, ks: 0.25, shininess: 20, emissive: night.on ? 1.9 : 1.3 }));
    parts.push(part(transform(cylinder(0.5, 4, 6, SHAFT), { t: [-41, 55, 0] }), { ks: 0.2 }));

    // ---- the Omni: curved low hotel block x 36..48, y 0..30, with the LED band at y 22..26 ----
    const omni = bakeLoc(transform(cylinder(7, 30, 24, OMNI, 7, 6), { t: [42, 15, -1] }));
    const omniTex: TexFn = (x, y, z) => {
      if (z < -1) return null; // only the front half of the drum
      if (y > 29.3) return OMNI_L;
      if (y > 22 && y < 26) { // the LED skin: a band of colour cells
        const cell = Math.floor((x + z * 0.5) / 1.6) + Math.floor(y / 1.3) * 5;
        if (night.on) return OMNI_LED[(cell + night.frame * 2) % OMNI_LED.length];
        return mixRGB(OMNI_BAND, OMNI_L, 0.3);
      }
      const win = windows((x2, _y, z2) => x2 + z2 * 0.5, OMNI, [2, 2.6], night, 0.4);
      return win(x, y, z);
    };
    parts.push(part(omni, { tex: omniTex, ks: 0.3, shininess: 18, emissive: night.on ? 1.2 : 1 }));

    return parts;
  },
};

// keep the unused-import linter honest: these helpers are used above via other primitives
void mixRGB; void hash; void bldg;
export type { Mesh };
