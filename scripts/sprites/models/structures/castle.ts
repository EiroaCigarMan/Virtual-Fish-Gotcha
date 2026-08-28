import { box, cone, cylinder, hash, hex, merge, mixRGB, part, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { StructureModel } from "../../types";

/**
 * The original keep, remodelled: a 44-wide body with two round towers, conical red roofs,
 * an arched door and a recess for the clock panel (scene 62..98 × 92..108).
 * Model space: ground y = 0 (scene 124), x = 0 at scene 80.
 */
const STONE = hex("#9496ac"), STONE_D = hex("#6c6e86"), MORTAR = hex("#575a72");
const ROOF = hex("#c9463d"), ROOF_L = hex("#e0665a"), DARK = hex("#1c1d30"), WOOD = hex("#6b4424");

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

export const castle: StructureModel = {
  frame: { x: -31, y: 0, w: 62, h: 66 },
  at: { x: 49, y: 58 },
  view: { yaw: -7, pitch: 7 },
  build(): Part[] {
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
    const roofAt = (x: number) => merge(
      transform(cone(5.3, 9, 18, ROOF), { t: [x, TH + 2 + 4.5, 0] }),
      transform(cylinder(0.35, 4, 6, STONE_D), { t: [x, TH + 11 + 2, 0] }), // pole
      transform(box(0.2, 2, 3, ROOF_L), { t: [x, TH + 14, 1.5] }), // pennant
    );
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
    const door = merge(
      transform(box(doorW, doorH - doorW / 2, 1.2, DARK), { t: [0, (doorH - doorW / 2) / 2, BD / 2 - 0.3] }),
      transform(cylinder(doorW / 2, 1.2, 16, DARK), { t: [0, doorH - doorW / 2, BD / 2 - 0.3], r: [90, 0, 0] }),
      transform(box(doorW - 2, doorH - 4, 0.6, WOOD, [2, 3, 1]), { t: [0, (doorH - 4) / 2, BD / 2 + 0.2] }),
    );
    // clock recess: scene 62..98 × 92..108 → model x -18..18, y 16..32; framed by a stone lip
    const recess = merge(
      transform(box(38, 18, 0.8, STONE_D), { t: [0, 24, BD / 2 + 0.2] }),
      transform(box(36, 16, 1.0, DARK), { t: [0, 24, BD / 2 + 0.4] }),
    );
    // side windows (dark slits)
    const win = (x: number, y: number) => transform(box(3, 4, 0.8, DARK), { t: [x, y, BD / 2 + 0.2] });
    const towerWin = (x: number, y: number) => transform(box(1.8, 3, 0.8, DARK), { t: [x, y, 4.0] });
    const frontU = (x: number) => x;
    return [
      part(body, { tex: bricks(frontU), ks: 0.12, shininess: 8 }),
      part(merge(...merlons), { tex: bricks(frontU), ks: 0.12, shininess: 8 }),
      part(merge(towerAt(-24), towerAt(24)), { tex: bricks((x, _y, z) => Math.atan2(z, x - (x < 0 ? -24 : 24)) * 4.2), ks: 0.18, shininess: 12 }),
      part(merge(towerMerlons(-24), towerMerlons(24)), { ks: 0.12, shininess: 8 }),
      part(merge(roofAt(-24), roofAt(24)), { ks: 0.4, shininess: 30 }),
      part(door, { ks: 0.1 }),
      part(recess, { ks: 0.1 }),
      part(merge(win(-16, 12), win(16, 12), towerWin(-24, 32), towerWin(24, 32), towerWin(-24, 20), towerWin(24, 20)), { ks: 0.05 }),
    ];
  },
};
