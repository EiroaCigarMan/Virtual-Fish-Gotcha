import { box, cone, cylinder, hash, hex, merge, mixRGB, part, scaleRGB, smoothstep, transform, type Mesh, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";

/**
 * The original keep, remodelled: a 44-wide body with two round towers, conical red roofs,
 * an arched door and a recess for the clock panel (scene 62..98 × 92..108).
 * Model space: ground y = 0 (scene 124), x = 0 at scene 80.
 *
 * Night (2 frames): every window lit warm with a soft spill onto the stone around it; the
 * stone itself a little darker. Frame 1 is the candle flicker — a couple of windows burn low
 * and the spill draws in — so the runtime can alternate the two.
 */
const STONE = hex("#9496ac"), STONE_D = hex("#6c6e86"), MORTAR = hex("#575a72");
const ROOF = hex("#c9463d"), ROOF_L = hex("#e0665a"), DARK = hex("#1c1d30"), WOOD = hex("#6b4424");
const WIN_LIT = hex("#ffd080"), WIN_LOW = hex("#c89850"), GLOW = hex("#ffc070");

/** Copy world positions into `loc` so a part's tex sees world coordinates. */
const bakeLoc = (m: Mesh): Mesh => ({ ...m, loc: m.pos.slice() });

/** Brick texture on a planar face: rows every 4 units, headers staggered. */
function bricks(u: (x: number, y: number, z: number) => number): TexFn {
  return (x, y, z) => {
    const uu = u(x, y, z);
    const row = Math.floor(y / 4);
    const my = ((y % 4) + 4) % 4;
    const mx = (((uu + (row % 2 ? 3 : 0)) % 6) + 6) % 6;
    if (my < 0.55 || mx < 0.55) return MORTAR;
    const tone = 0.9 + hash(row, Math.floor((uu + (row % 2 ? 3 : 0)) / 6)) * 0.2;
    return mixRGB(STONE_D, STONE, tone) as RGB;
  };
}

/** A lit opening for the night spill: centre, half-size and how hard it burns (0..1). */
interface Lamp { cx: number; cy: number; hw: number; hh: number; k: number }
/** Warm light from `lamps` falling on a texel at (x, y): a soft falloff over `r` units past each opening's edge. */
function spill(c: RGB, x: number, y: number, lamps: Lamp[], r: number): RGB {
  let t = 0;
  for (const l of lamps) {
    const d = Math.max(Math.abs(x - l.cx) - l.hw, Math.abs(y - l.cy) - l.hh, 0);
    t = Math.max(t, l.k * smoothstep(r, 0, d));
  }
  return t > 0 ? scaleRGB(mixRGB(c, GLOW, t), 1 + 0.7 * t) : c;
}

export const castle: StructureModel = {
  frame: { x: -31, y: 0, w: 62, h: 66 },
  at: { x: 49, y: 58 },
  view: { yaw: -7, pitch: 7 },
  nightFrames: 2,
  build(opts): Part[] {
    const night = !!opts?.night, flicker = night && (opts?.frame ?? 0) === 1;
    const BW = 44, BH = 40, BD = 22;
    const body = transform(box(BW, BH, BD, STONE, [4, 4, 2]), { t: [0, BH / 2, 0] });
    // battlements along the front and back edge of the roof
    const merlons: Part["mesh"][] = [];
    for (let i = -20; i <= 20; i += 6) {
      merlons.push(transform(box(3, 3, 3, STONE), { t: [i, BH + 1.5, BD / 2 - 1.5] }));
      merlons.push(transform(box(3, 3, 3, STONE), { t: [i, BH + 1.5, -BD / 2 + 1.5] }));
    }
    const TH = 48;
    const towerAt = (x: number) => merge(
      transform(cylinder(4.2, TH, 18, STONE, 4.2, 6), { t: [x, TH / 2, 0] }),
      transform(cylinder(4.9, 2, 18, STONE_D), { t: [x, TH + 1, 0] }), // capstone ring
    );
    const coneAt = (x: number) => transform(cone(5.3, 9, 18, ROOF), { t: [x, TH + 2 + 4.5, 0] });
    const poleAt = (x: number) => merge(
      transform(cylinder(0.35, 4, 6, STONE_D), { t: [x, TH + 11 + 2, 0] }), // pole
      transform(box(0.2, 2, 3, ROOF_L), { t: [x, TH + 14, 1.5] }), // pennant
    );
    const roofAt = (x: number) => merge(coneAt(x), poleAt(x));
    const towerMerlons = (x: number) => {
      const out: Part["mesh"][] = [];
      for (let a = 0; a < 6; a++) {
        const th = (a / 6) * Math.PI * 2;
        out.push(transform(box(1.8, 2.2, 1.8, STONE), { t: [x + Math.cos(th) * 4.2, 48 + 2 + 1.1, Math.sin(th) * 4.2], r: [0, (-th * 180) / Math.PI, 0] }));
      }
      return merge(...out);
    };
    // door: dark arched recess (a box + half cylinder), with a wooden door inside
    const doorW = 8, doorH = 12;
    const doorArch = merge(
      transform(box(doorW, doorH - doorW / 2, 1.2, DARK), { t: [0, (doorH - doorW / 2) / 2, BD / 2 - 0.3] }),
      transform(cylinder(doorW / 2, 1.2, 16, DARK), { t: [0, doorH - doorW / 2, BD / 2 - 0.3], r: [90, 0, 0] }),
    );
    const doorWood = transform(box(doorW - 2, doorH - 4, 0.6, WOOD, [2, 3, 1]), { t: [0, (doorH - 4) / 2, BD / 2 + 0.2] });
    const door = merge(doorArch, doorWood);
    // clock recess: scene 62..98 × 92..108 → model x -18..18, y 16..32; framed by a stone lip
    const recess = merge(
      transform(box(38, 18, 0.8, STONE_D), { t: [0, 24, BD / 2 + 0.2] }),
      transform(box(36, 16, 1.0, DARK), { t: [0, 24, BD / 2 + 0.4] }),
    );
    // side windows (dark slits)
    const win = (x: number, y: number, c: RGB = DARK) => transform(box(3, 4, 0.8, c), { t: [x, y, BD / 2 + 0.2] });
    const towerWin = (x: number, y: number, c: RGB = DARK) => transform(box(1.8, 3, 0.8, c), { t: [x, y, 4.0] });
    const frontU = (x: number) => x;
    const towerU = (x: number, _y: number, z: number) => Math.atan2(z, x - (x < 0 ? -24 : 24)) * 4.2;
    if (!night) {
      return [
        part(body, { tex: bricks(frontU), ks: 0.12, shininess: 8 }),
        part(merge(...merlons), { tex: bricks(frontU), ks: 0.12, shininess: 8 }),
        part(merge(towerAt(-24), towerAt(24)), { tex: bricks(towerU), ks: 0.18, shininess: 12 }),
        part(merge(towerMerlons(-24), towerMerlons(24)), { ks: 0.12, shininess: 8 }),
        part(merge(roofAt(-24), roofAt(24)), { ks: 0.4, shininess: 30 }),
        part(door, { ks: 0.1 }),
        part(recess, { ks: 0.1 }),
        part(merge(win(-16, 12), win(16, 12), towerWin(-24, 32), towerWin(24, 32), towerWin(-24, 20), towerWin(24, 20)), { ks: 0.05 }),
      ];
    }
    // ---- night: lit windows, warm spill on the stone, everything else a shade darker ----
    const R = flicker ? 2.6 : 3.6; // spill reach
    const burn = (low: boolean) => (low ? 0.4 : 0.75);
    const lowRight = flicker, lowTower = flicker; // frame 1: the right side window and the left tower's low slit burn low
    const bodyBricks = bricks(frontU);
    const bodyLamps: Lamp[] = [
      { cx: -16, cy: 12, hw: 1.5, hh: 2, k: burn(false) },
      { cx: 16, cy: 12, hw: 1.5, hh: 2, k: burn(lowRight) },
      { cx: 0, cy: 5, hw: 4, hh: 5, k: 0.4 }, // light spilling out of the doorway
    ];
    // body loc is box-local (y centred on BH/2); the front face is z > BD/2 - 0.3
    const bodyTexNight: TexFn = (x, y, z) => { const c = bodyBricks(x, y, z); return z > BD / 2 - 0.3 ? spill(c, x, y + BH / 2, bodyLamps, R) : c; };
    const towerLamps: Lamp[] = [
      { cx: -24, cy: 32, hw: 0.9, hh: 1.5, k: burn(false) }, { cx: 24, cy: 32, hw: 0.9, hh: 1.5, k: burn(false) },
      { cx: -24, cy: 20, hw: 0.9, hh: 1.5, k: burn(lowTower) }, { cx: 24, cy: 20, hw: 0.9, hh: 1.5, k: burn(false) },
    ];
    const towerBricks = bricks(towerU);
    const towerTexNight: TexFn = (x, y, z) => { const c = towerBricks(x, y, z); return z > 1.5 ? spill(c, x, y, towerLamps, R) : c; };
    // a small lit window in the wooden door, its glow on the planks around it
    const doorWin = transform(box(2, 2.2, 0.3, WIN_LIT), { t: [0, 6, BD / 2 + 0.2 + 0.45] });
    const doorLamps: Lamp[] = [{ cx: 0, cy: 6, hw: 1, hh: 1.1, k: 0.8 }];
    const woodTexNight: TexFn = (x, y) => spill(WOOD, x, y, doorLamps, flicker ? 1.8 : 2.4);
    const lit = (low: boolean) => (low ? WIN_LOW : WIN_LIT);
    return [
      part(body, { tex: bodyTexNight, ks: 0.12, shininess: 8, emissive: 0.7 }),
      part(merge(...merlons), { tex: bodyBricks, ks: 0.12, shininess: 8, emissive: 0.7 }),
      part(bakeLoc(merge(towerAt(-24), towerAt(24))), { tex: towerTexNight, ks: 0.18, shininess: 12, emissive: 0.7 }),
      part(merge(towerMerlons(-24), towerMerlons(24)), { ks: 0.12, shininess: 8, emissive: 0.7 }),
      part(merge(coneAt(-24), coneAt(24)), { ks: 0.4, shininess: 30, emissive: 0.7 }),
      part(merge(poleAt(-24), poleAt(24)), { ks: 0.4, shininess: 30 }),
      part(doorArch, { ks: 0.1, emissive: 0.7 }),
      part(bakeLoc(doorWood), { tex: woodTexNight, ks: 0.1, emissive: 0.8 }),
      part(recess, { ks: 0.1 }),
      part(merge(
        win(-16, 12, WIN_LIT), win(16, 12, lit(lowRight)),
        towerWin(-24, 32, WIN_LIT), towerWin(24, 32, WIN_LIT), towerWin(-24, 20, lit(lowTower)), towerWin(24, 20, WIN_LIT),
        doorWin,
      ), { ks: 0.05, emissive: 1.35 }),
    ];
  },
};
