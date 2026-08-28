import { deform, ellipsoid, extrude, hash, hex, lathe, merge, mixRGB, part, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag } from "./common";

/**
 * Endler's livebearer: a small slim fish, orange with green patches and a couple of black
 * spots, and a yellow tail.
 */
const BODY = hex("#f0a830"), HI = hex("#ffd36a"), GREEN = hex("#2fbf71"), BLACK = hex("#1a1a2e");
const TAIL = hex("#ffd36a"), FIN = hex("#ffd36a"), MOUTH = hex("#e07030");

const NOSE = 4.6, TAIL_X = -3.6, RY = 1.5;

/** Jittered-grid blob: returns the cell's hash when (x, y) falls inside that cell's disc, else null. */
function blob(x: number, y: number, cell: number, r: number, seed: number): number | null {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  const px = (cx + 0.3 + hash(cx, cy, seed) * 0.4) * cell, py = (cy + 0.3 + hash(cx, cy, seed + 1) * 0.4) * cell;
  return Math.hypot(x - px, y - py) < r ? hash(cx, cy, seed + 2) : null;
}

const base = (_x: number, y: number): RGB => (y > 0 ? mixRGB(BODY, HI, Math.min(1, (y / RY) * 0.8)) : mixRGB(BODY, hex("#d08828"), Math.min(1, -y / RY) * 0.5));

const bodyTex: TexFn = (x, y, z) => {
  const c = base(x, y);
  if (x > 3.2) return c; // clear face
  const g = blob(x + 0.4, y, 1.7, 0.75, 11);
  if (g !== null && g > 0.5) return mixRGB(GREEN, c, 0.15);
  const b = blob(x - 0.6, y + 0.3, 1.9, 0.38, 29);
  if (b !== null && b > 0.55 && x > -2.6) return BLACK;
  const speck = 0.96 + hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z)) * 0.08;
  return [c[0] * speck, c[1] * speck, c[2] * speck];
};

export const endler: FishModel = {
  frame: { w: 14, h: 9 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [3.1, 0.35, 0.95],
  mouth: [4.55, -0.05, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [4.3, 0.7], [3.4, 1.2], [1.8, 1.5], [0, 1.5], [-1.8, 1.3], [-3.0, 0.9], [-3.8, 0.5]],
      16, base, 0.7,
    );
    const tail = extrude(
      [[TAIL_X, 0.5], [-5.3, 1.9], [-5.9, 0.9], [-5.7, -0.9], [-5.3, -1.9], [TAIL_X, -0.5]],
      0.3, (x) => mixRGB(hex("#f0b840"), TAIL, Math.min(1, (TAIL_X - x) / 2)), [-4.0, 0],
    );
    const dorsal = extrude([[0.6, 1.4], [0.0, 2.6], [-1.4, 2.5], [-1.9, 1.1]], 0.25, FIN);
    const anal = extrude([[-0.6, -1.4], [-1.4, -2.4], [-2.4, -0.9]], 0.25, FIN);
    const pectoralBase: [number, number][] = [[0, 0], [-0.6, -1.1], [-1.4, -0.6]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 18;
    const pectoral = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, flap], t: [2.2, -0.3, 1.0] });
    const pectoralFar = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, -flap], t: [2.2, -0.3, -1.0] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.5, 0.5, 0.36, 12, 8, hex("#ffffff")), { t: [3.1, 0.35, z] }),
      transform(ellipsoid(0.25, 0.25, 0.25, 10, 6, hex("#15162a")), { t: [3.25, 0.35, z * 1.25] }),
    );
    const mouth = transform(ellipsoid(0.3, 0.2, 0.28, 10, 6, MOUTH), { t: [4.5, -0.05, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 1.0);
    return [
      part(deform(body, wag), { tex: bodyTex, ks: 0.45, shininess: 22 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(0.95), eye(-0.95)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
