import { deform, ellipsoid, extrude, hash, hex, lathe, merge, mixRGB, part, smoothstep, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag } from "./common";

/**
 * Chili rasbora: a tiny red torpedo with a dark lateral stripe down the midline, small fins
 * and a forked tail.
 */
const BODY = hex("#e8503a"), HI = hex("#ff8a6a"), STRIPE = hex("#3a1a1a"), FIN = hex("#f08a7a"), MOUTH = hex("#ff6a5a");

const NOSE = 3.6, TAIL_X = -2.9, RY = 1.05;

const base = (_x: number, y: number): RGB => (y > 0 ? mixRGB(BODY, HI, Math.min(1, (y / RY) * 0.85)) : mixRGB(BODY, hex("#c84030"), Math.min(1, -y / RY) * 0.4));

const bodyTex: TexFn = (x, y, z) => {
  const c = base(x, y);
  // lateral stripe: solid on the flank, fading out toward the nose
  const band = 1 - smoothstep(0.28, 0.42, Math.abs(y));
  const fade = 1 - smoothstep(2.4, 3.3, x);
  const speck = 0.96 + hash(Math.floor(x * 3), Math.floor(y * 3), Math.floor(z)) * 0.08;
  const out = mixRGB(c, STRIPE, band * fade);
  return [out[0] * speck, out[1] * speck, out[2] * speck];
};

export const chiliRasbora: FishModel = {
  frame: { w: 11, h: 7 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [2.5, 0.28, 0.66],
  mouth: [3.55, -0.05, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [3.3, 0.5], [2.4, 0.9], [1.0, RY], [-0.6, 1.0], [-1.8, 0.8], [-2.6, 0.5], [-3.0, 0.3]],
      16, base, 0.66,
    );
    const tail = extrude(
      [[TAIL_X, 0.3], [-4.3, 1.3], [-4.6, 0.5], [-4.1, 0], [-4.6, -0.5], [-4.3, -1.3], [TAIL_X, -0.3]],
      0.25, FIN, [-3.2, 0],
    );
    const dorsal = extrude([[0.7, 0.95], [0.1, 1.9], [-1.0, 1.8], [-1.4, 0.7]], 0.2, FIN);
    const anal = extrude([[-0.3, -0.95], [-0.9, -1.7], [-1.7, -0.6]], 0.2, FIN);
    const pectoralBase: [number, number][] = [[0, 0], [-0.4, -0.8], [-1.0, -0.45]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 18;
    const pectoral = transform(extrude(pectoralBase, 0.18, FIN), { r: [0, 0, flap], t: [1.7, -0.25, 0.62] });
    const pectoralFar = transform(extrude(pectoralBase, 0.18, FIN), { r: [0, 0, -flap], t: [1.7, -0.25, -0.62] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.42, 0.42, 0.3, 12, 8, hex("#ffffff")), { t: [2.5, 0.28, z] }),
      transform(ellipsoid(0.21, 0.21, 0.21, 10, 6, hex("#15162a")), { t: [2.62, 0.28, z * 1.25] }),
    );
    const mouth = transform(ellipsoid(0.24, 0.16, 0.22, 10, 6, MOUTH), { t: [3.52, -0.05, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 0.75);
    return [
      part(deform(body, wag), { tex: bodyTex, ks: 0.45, shininess: 22 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(0.66), eye(-0.66)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
