import { deform, ellipsoid, extrude, hash, hex, lathe, merge, mixRGB, part, smoothstep, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag } from "./common";

/**
 * Pea puffer: a round little ball of a fish, yellow-green with dark spots over a pale belly,
 * a big eye, a stubby tail and tiny whirring fins.
 */
const BODY = hex("#b8c84a"), SPOT = hex("#3a4a10"), BELLY = hex("#e4f07a"), FIN = hex("#d8e070"), MOUTH = hex("#8a9a30");

const NOSE = 3.8, TAIL_X = -4.0, RY = 3.2;

/** Jittered-grid blob: returns the cell's hash when (x, y) falls inside that cell's disc, else null. */
function blob(x: number, y: number, cell: number, r: number, seed: number): number | null {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  const px = (cx + 0.3 + hash(cx, cy, seed) * 0.4) * cell, py = (cy + 0.3 + hash(cx, cy, seed + 1) * 0.4) * cell;
  return Math.hypot(x - px, y - py) < r ? hash(cx, cy, seed + 2) : null;
}

const base = (_x: number, y: number): RGB => {
  const top = mixRGB(BODY, hex("#9ab038"), Math.min(1, Math.max(0, y / RY)) * 0.5);
  return mixRGB(top, BELLY, smoothstep(-0.1, -1.3, y));
};

const bodyTex: TexFn = (x, y, z) => {
  const c = base(x, y);
  const speck = 0.95 + hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z)) * 0.1;
  if (y > -0.7 && x < 3.0) {
    const s = blob(x + 0.5, y + 0.2, 1.45, 0.5, 7);
    if (s !== null && s > 0.42) return mixRGB(SPOT, c, 0.1);
    const s2 = blob(x - 0.2, y - 0.5, 1.9, 0.32, 41);
    if (s2 !== null && s2 > 0.6) return mixRGB(SPOT, c, 0.2);
  }
  return [c[0] * speck, c[1] * speck, c[2] * speck];
};

export const peaPuffer: FishModel = {
  frame: { w: 13, h: 11 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [2.1, 1.1, 2.2],
  mouth: [3.75, -0.35, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [3.5, 1.2], [2.6, 2.4], [1.2, 3.1], [-0.4, RY], [-2.0, 2.8], [-3.2, 1.9], [-3.9, 1.0], [-4.2, 0.6]],
      20, base, 0.8,
    );
    const tail = extrude([[TAIL_X, 0.6], [-5.3, 1.4], [-5.6, 0], [-5.3, -1.4], [TAIL_X, -0.6]], 0.3, FIN, [-4.4, 0]);
    const dorsal = extrude([[-1.4, 2.9], [-2.2, 3.9], [-3.3, 3.6], [-3.4, 2.0]], 0.25, FIN);
    const anal = extrude([[-1.6, -2.8], [-2.6, -3.7], [-3.4, -2.0]], 0.25, FIN);
    const pectoralBase: [number, number][] = [[0, 0], [-0.5, -1.0], [-1.3, -0.5]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 26;
    const pectoral = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, flap], t: [1.4, -0.4, 2.3] });
    const pectoralFar = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, -flap], t: [1.4, -0.4, -2.3] });
    const eye = (z: number) => merge(
      transform(ellipsoid(1.0, 1.0, 0.7, 14, 9, hex("#ffffff")), { t: [2.1, 1.1, z] }),
      transform(ellipsoid(0.5, 0.5, 0.5, 10, 6, hex("#15162a")), { t: [2.4, 1.1, z * 1.2] }),
    );
    const mouth = transform(ellipsoid(0.34, 0.22, 0.32, 10, 6, MOUTH), { t: [3.72, -0.35, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 0.8);
    return [
      part(deform(body, wag), { tex: bodyTex, ks: 0.4, shininess: 20 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(2.2), eye(-2.2)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
