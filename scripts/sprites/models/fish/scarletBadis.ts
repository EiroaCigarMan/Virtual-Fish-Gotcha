import { deform, ellipsoid, extrude, hex, lathe, merge, mixRGB, part, smoothstep, transform, type Part, type RGB } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag, scales } from "./common";

/**
 * Scarlet badis: a compact red fish with pale blue vertical bars, a tall dorsal running the
 * length of the back and a matching anal fin.
 */
const BODY = hex("#d8402e"), HI = hex("#ff7a5a"), BAR = hex("#9ad0e8"), FIN = hex("#e85a4a"), MOUTH = hex("#ff9a7a");

const NOSE = 4.0, TAIL_X = -3.4, RY = 1.9, BAR_PITCH = 1.4;

const base = (_x: number, y: number): RGB => (y > 0 ? mixRGB(BODY, HI, Math.min(1, (y / RY) * 0.8)) : mixRGB(BODY, hex("#a83020"), Math.min(1, -y / RY) * 0.45));

/** Vertical bars by x (pitch ~1.4), kept off the face. */
const bars = (x: number): number => {
  if (x > 2.6) return 0;
  const u = (((x + 20) % BAR_PITCH) + BAR_PITCH) % BAR_PITCH;
  return (1 - smoothstep(0.2, 0.32, Math.abs(u - 0.6))) * (1 - smoothstep(1.8, 2.6, x));
};

const bodyPattern = (x: number, y: number): RGB => mixRGB(base(x, y), BAR, bars(x) * 0.85);

export const scarletBadis: FishModel = {
  frame: { w: 13, h: 9 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [2.7, 0.5, 1.1],
  mouth: [3.95, -0.1, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [3.7, 0.8], [2.8, 1.5], [1.2, RY], [-0.6, RY], [-2.0, 1.5], [-3.0, 1.0], [-3.5, 0.6]],
      18, base, 0.62,
    );
    const tail = extrude(
      [[TAIL_X, 0.6], [-4.8, 2.0], [-5.5, 1.0], [-5.6, 0], [-5.5, -1.0], [-4.8, -2.0], [TAIL_X, -0.6]],
      0.3, FIN, [-3.9, 0],
    );
    const dorsal = extrude([[2.6, 1.6], [1.8, 3.4], [-0.4, 3.9], [-2.6, 3.5], [-3.4, 2.3], [-3.2, 0.9]], 0.3, FIN);
    const anal = extrude([[1.2, -1.8], [-3.2, -0.9], [-3.4, -2.5], [-1.6, -3.7], [0.2, -3.2]], 0.3, FIN);
    const pectoralBase: [number, number][] = [[0, 0], [-0.7, -1.4], [-1.7, -0.8]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 18;
    const pectoral = transform(extrude(pectoralBase, 0.22, FIN), { r: [0, 0, flap], t: [2.2, -0.3, 1.15] });
    const pectoralFar = transform(extrude(pectoralBase, 0.22, FIN), { r: [0, 0, -flap], t: [2.2, -0.3, -1.15] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.6, 0.6, 0.42, 12, 8, hex("#ffffff")), { t: [2.7, 0.5, z] }),
      transform(ellipsoid(0.3, 0.3, 0.3, 10, 6, hex("#15162a")), { t: [2.88, 0.5, z * 1.24] }),
    );
    const mouth = transform(ellipsoid(0.36, 0.24, 0.32, 10, 6, MOUTH), { t: [3.9, -0.1, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 0.8);
    return [
      part(deform(body, wag), { tex: scales(bodyPattern, 4.0), ks: 0.45, shininess: 22 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(1.1), eye(-1.1)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
