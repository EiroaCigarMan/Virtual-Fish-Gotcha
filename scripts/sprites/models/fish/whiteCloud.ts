import { deform, ellipsoid, extrude, hash, hex, lathe, merge, mixRGB, part, smoothstep, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag } from "./common";

/**
 * White Cloud Mountain minnow: a slim silver-olive fish with a pale gold lateral stripe, a
 * lighter belly and red fins and tail.
 */
const BODY = hex("#8a9a6a"), STRIPE = hex("#e8e0a0"), BELLY = hex("#c8d8a8"), FIN = hex("#e04a3a"), MOUTH = hex("#c05040");

const NOSE = 4.5, TAIL_X = -3.7, RY = 1.35;

const base = (_x: number, y: number): RGB => {
  const top = mixRGB(BODY, hex("#6a7a4e"), Math.min(1, Math.max(0, y / RY)) * 0.55);
  return mixRGB(top, BELLY, smoothstep(-0.35, -1.1, y));
};

const bodyTex: TexFn = (x, y, z) => {
  const c = base(x, y);
  const band = (1 - smoothstep(0.16, 0.34, Math.abs(y - 0.08))) * (1 - smoothstep(3.0, 3.8, x));
  const speck = 0.96 + hash(Math.floor(x * 3), Math.floor(y * 3), Math.floor(z)) * 0.08;
  const out = mixRGB(c, STRIPE, band * 0.95);
  return [out[0] * speck, out[1] * speck, out[2] * speck];
};

export const whiteCloud: FishModel = {
  frame: { w: 14, h: 8 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [3.1, 0.3, 0.85],
  mouth: [4.45, -0.05, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [4.2, 0.6], [3.3, 1.1], [1.8, RY], [0, RY], [-1.8, 1.15], [-3.0, 0.8], [-3.8, 0.45]],
      16, base, 0.68,
    );
    const tail = extrude(
      [[TAIL_X, 0.45], [-5.4, 1.8], [-5.9, 0.9], [-5.1, 0], [-5.9, -0.9], [-5.4, -1.8], [TAIL_X, -0.45]],
      0.25, FIN, [-4.1, 0],
    );
    const dorsal = extrude([[0.4, 1.3], [-0.2, 2.7], [-1.6, 2.6], [-2.0, 1.0]], 0.22, FIN);
    const anal = extrude([[-0.8, -1.25], [-1.4, -2.4], [-2.6, -0.8]], 0.22, FIN);
    const pectoralBase: [number, number][] = [[0, 0], [-0.5, -1.0], [-1.3, -0.55]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 18;
    const pectoral = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, flap], t: [2.1, -0.3, 0.88] });
    const pectoralFar = transform(extrude(pectoralBase, 0.2, FIN), { r: [0, 0, -flap], t: [2.1, -0.3, -0.88] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.48, 0.48, 0.34, 12, 8, hex("#ffffff")), { t: [3.1, 0.3, z] }),
      transform(ellipsoid(0.24, 0.24, 0.24, 10, 6, hex("#15162a")), { t: [3.25, 0.3, z * 1.25] }),
    );
    const mouth = transform(ellipsoid(0.28, 0.18, 0.26, 10, 6, MOUTH), { t: [4.42, -0.05, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 0.85);
    return [
      part(deform(body, wag), { tex: bodyTex, ks: 0.55, shininess: 26 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(0.85), eye(-0.85)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
