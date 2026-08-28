import { box, cylinder, empty, hex, merge, part, transform, type Mesh, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";

/**
 * Eiffel Tower, Paris: a bell-shaped iron lattice from an apex at y 80 to four legs at the
 * ground, three decks, an open arch between the legs (the fish swims through it) and the clock
 * plate hung between the first and second decks. Model space: ground y = 0, x = 0 at scene 80.
 *
 * Built as two lattice ribbons (front and back planes, tapering in x and z) whose texture cuts
 * out everything between the X-braces, so you see the far truss through the near one.
 */
const IRON = hex("#6b4a2a"), IRON_L = hex("#9a6f42"), IRON_D = hex("#3f2a16"), DECK = hex("#8a6a3a"), DECK_L = hex("#a8875a");
const PANEL = hex("#0e1422");

const TOP = 80;
/** Half-width at model height y — the old pixel art's bell curve: ~1 at the apex, 32 at the ground. */
const halfAt = (y: number) => { const t = Math.max(0, Math.min(1, (TOP - y) / TOP)); return 1 + 31 * (0.55 * t * t + 0.45 * t); };
const DEPTH = 0.4; // plan depth as a fraction of width (a shallow tower reads better head-on)
const depthAt = (y: number) => halfAt(y) * DEPTH;
const ARCH_Y = 17.2; // arch springs from here at the legs' inner edge; the passage box is y 2..16
const archTop = (x: number) => ARCH_Y + 1.0 - 1.0 * (x / 16) * (x / 16);
const legW = (y: number) => Math.max(3.5, halfAt(y) * 0.28);

const bakeLoc = (m: Mesh): Mesh => ({ ...m, loc: m.pos.slice() });

/** A ruled strip: consecutive left/right point pairs, joined by quads (smooth-shaded). */
function ribbon(rows: [[number, number, number], [number, number, number]][], color: RGB): Mesh {
  const m = empty();
  for (const [l, r] of rows) { m.pos.push(...l, ...r); m.loc.push(...l, ...r); m.col.push(...color, ...color); }
  for (let i = 0; i < rows.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; m.idx.push(a, c, b, b, c, d); }
  return m;
}

/** Truss lattice in world x/y: X-braces on a 4-unit pitch, horizontal ties every 8, solid edge rails and legs, open arch. */
const lattice: TexFn = (x, y) => {
  const hw = halfAt(y), ax = Math.abs(x);
  if (ax > hw + 0.2) return null;
  const leg = legW(y);
  if (y < ARCH_Y + 1.5 && ax < hw - leg) {
    // between the legs: open arch, with a rail along its curve
    const a = archTop(x);
    if (y < a) return null;
    if (y < a + 1.0) return IRON_L;
  }
  if (y < ARCH_Y + 1.5 && ax >= hw - leg) {
    // solid legs, lightly braced, with clean edge rails
    if (ax > hw - 1.3) return x < 0 ? IRON_L : IRON_D;
    if (ax < hw - leg + 0.8) return IRON_D;
    const d1 = (((x + y) % 4) + 4) % 4, d2 = (((x - y) % 4) + 4) % 4;
    if (d1 < 0.6 || d2 < 0.6) return IRON_D;
    return IRON;
  }
  if (ax > hw - 1.1) return x < 0 ? IRON_L : IRON; // edge rails
  const d1 = (((x + y) % 4) + 4) % 4, d2 = (((x - y) % 4) + 4) % 4;
  const tie = (((y % 8) + 8) % 8) < 0.7;
  const b1 = d1 < 0.95, b2 = d2 < 0.95;
  if (b1 && b2) return IRON_L; // node
  if (b1 || b2) return IRON;
  if (tie) return IRON_D;
  return null;
};

export const eiffelTower: StructureModel = {
  frame: { x: -35, y: 0, w: 70, h: 84 },
  at: { x: 45, y: 40 },
  view: { yaw: 0, pitch: 7 },
  build(): Part[] {
    // the two lattice planes
    const rows = (sign: number) => {
      const out: [[number, number, number], [number, number, number]][] = [];
      // the back plane is trimmed a touch so its rails hide behind the front ones once pitch lifts it
      for (let y = 0; y <= TOP; y += 2) { const hw = halfAt(y) - (sign < 0 ? 0.9 : 0), z = sign * depthAt(y); out.push([[-hw, y, z], [hw, y, z]]); }
      return out;
    };
    const front = ribbon(rows(1), IRON), back = ribbon(rows(-1), IRON);
    // decks: solid plates that overhang the truss
    const deck = (y0: number, y1: number, extra: number) => {
      const hw = halfAt(y0) + extra, d = depthAt(y0) + extra;
      return transform(box(hw * 2, y1 - y0, d * 2, DECK), { t: [0, (y0 + y1) / 2, 0] });
    };
    const decks = merge(deck(54, 56, 2), deck(36, 38, 3), deck(ARCH_Y + 1.0, 20, 3));
    const rails = merge(
      transform(box(halfAt(56) * 2 + 4, 0.7, 0.7, DECK_L), { t: [0, 56.4, depthAt(56) + 2] }),
      transform(box(halfAt(38) * 2 + 6, 0.7, 0.7, DECK_L), { t: [0, 38.4, depthAt(38) + 3] }),
      transform(box(halfAt(20) * 2 + 6, 0.7, 0.7, DECK_L), { t: [0, 20.4, depthAt(20) + 3] }),
    );
    // clock plate between the first and second decks: model x -18..18, y 20..36 (scene 62..98 × 88..104)
    const PZ = 9.5;
    const plate = bakeLoc(transform(box(38, 17, 6.5, IRON, [2, 2, 1]), { t: [0, 28.2, PZ - 3.25] }));
    const plateTex: TexFn = (x, y, z) => (z > PZ - 0.5 && x > -19 && x < 19 && y > 19 && y < 37 ? null : (((y % 4) + 4) % 4 < 0.5 ? IRON_D : IRON));
    const recess = merge(
      transform(box(38, 1, 1, IRON_L), { t: [0, 36.5, PZ - 0.1] }),
      transform(box(38, 1, 1, IRON_L), { t: [0, 19.5, PZ - 0.1] }),
      transform(box(1, 16, 1, IRON_L), { t: [-18.5, 28, PZ - 0.1] }),
      transform(box(1, 16, 1, IRON_L), { t: [18.5, 28, PZ - 0.1] }),
      transform(box(36.4, 16.4, 0.6, PANEL), { t: [0, 28, PZ - 0.7] }),
    );
    // apex: a small cap and a mast
    const apex = merge(
      transform(box(2.2, 2.5, 2.2, IRON), { t: [0, TOP + 1, 0] }),
      transform(cylinder(0.35, 2.5, 6, IRON_D), { t: [0, TOP + 2.7, 0] }),
    );
    return [
      part(back, { tex: lattice, ks: 0.2, shininess: 12 }),
      part(front, { tex: lattice, ks: 0.25, shininess: 14 }),
      part(decks, { ks: 0.2, shininess: 12 }),
      part(rails, { ks: 0.3 }),
      part(plate, { tex: plateTex, ks: 0.15 }),
      part(recess, { ks: 0.1 }),
      part(apex, { ks: 0.2 }),
    ];
  },
};
