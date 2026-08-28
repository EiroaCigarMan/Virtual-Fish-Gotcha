import { deform, ellipsoid, extrude, hex, lathe, merge, mixRGB, part, smoothstep, transform, type Part, type RGB, type TexFn } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag, scales } from "./common";

/**
 * Betta (Siamese fighting fish): a deep, short body dwarfed by a huge flowing veil tail with a
 * scalloped trailing edge, a tall dorsal, a long anal fin under the body and trailing pelvic
 * fins. Crimson body; fins grade from pink at the base to blue at the tips.
 */
const BODY = hex("#c8344a"), HI = hex("#e85a6a"), SHADE = hex("#7a1f33");
const FIN = hex("#e06b8a"), FIN_TIP = hex("#3b5bd6"), MOUTH = hex("#ff8aa0");

const RX = 5.5, RY = 3.4, NOSE = 5.5, TAIL_X = -4.8;

const bodyColor = (_x: number, y: number): RGB => (y > 0 ? mixRGB(BODY, HI, Math.min(1, y / RY)) : mixRGB(BODY, SHADE, Math.min(1, -y / RY)));

/** Fin albedo by elliptical distance from the body core: pink near the body, blue toward the tips. */
const finTex: TexFn = (x, y) => {
  const d = Math.hypot(x / RX, y / RY) - 1;
  return mixRGB(FIN, FIN_TIP, smoothstep(0.2, 1.15, d));
};

/** Veil tail: attached at the caudal peduncle, fanning out to a rounded, scalloped trailing edge near x = -9.8. */
function veilTail(): [number, number][] {
  const pts: [number, number][] = [[TAIL_X, 1.1], [-6.6, 5.6]];
  const half = 5.6, lobes = 6, steps = 26;
  for (let i = 0; i <= steps; i++) {
    const y = half - (i / steps) * half * 2;
    const round = 1.7 * Math.pow(Math.abs(y) / half, 2); // corners pulled in → rounded fan
    const scallop = 0.6 * Math.cos((y / (half * 2)) * Math.PI * 2 * lobes); // wavy edge
    pts.push([-9.4 + round - scallop, y]);
  }
  pts.push([-6.6, -5.6], [TAIL_X, -1.1]);
  return pts;
}

export const betta: FishModel = {
  frame: { w: 22, h: 16 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [3.5, 0.9, 1.8],
  mouth: [5.45, -0.2, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[NOSE, 0], [5.2, 1.1], [4.3, 2.3], [2.6, 3.1], [0.6, 3.4], [-1.4, 3.2], [-3.0, 2.5], [-4.2, 1.6], [-5.0, 1.0]],
      20, bodyColor, 0.62,
    );
    const tail = extrude(veilTail(), 0.3, FIN, [-5.4, 0]);
    const dorsal = extrude([[2.4, 2.9], [1.6, 5.4], [-0.6, 6.5], [-3.0, 6.0], [-4.0, 4.2], [-3.6, 2.2]], 0.3, FIN);
    const anal = extrude([[1.8, -2.9], [-3.8, -1.6], [-4.6, -4.6], [-2.4, -6.3], [0.4, -5.4]], 0.3, FIN);
    // trailing pelvic (ventral) fins under the throat, one per side
    const pelvicBase: [number, number][] = [[0.5, 0], [-0.5, 0], [-1.3, -2.7], [-0.2, -2.6]];
    const flap = Math.sin((k / n) * Math.PI * 2) * 16;
    const pelvic = transform(extrude(pelvicBase, 0.2, FIN), { r: [0, 0, flap * 0.4], t: [2.1, -2.6, 0.5] });
    const pelvicFar = transform(extrude(pelvicBase, 0.2, FIN), { r: [0, 0, -flap * 0.4], t: [2.1, -2.6, -0.5] });
    const pectoralBase: [number, number][] = [[0, 0], [-1.0, -1.9], [-2.3, -1.1]];
    const pectoral = transform(extrude(pectoralBase, 0.25, FIN), { r: [0, 0, flap], t: [2.9, -0.5, 1.9] });
    const pectoralFar = transform(extrude(pectoralBase, 0.25, FIN), { r: [0, 0, -flap], t: [2.9, -0.5, -1.9] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.85, 0.85, 0.6, 12, 8, hex("#ffffff")), { t: [3.5, 0.9, z] }),
      transform(ellipsoid(0.42, 0.42, 0.42, 10, 6, hex("#15162a")), { t: [3.75, 0.9, z * 1.22] }),
    );
    const mouth = transform(ellipsoid(0.5, 0.32, 0.45, 10, 6, MOUTH), { t: [5.4, -0.2, 0] });
    const wag = swimWag(k, n, TAIL_X, NOSE, 0.75); // slow, elegant
    return [
      part(deform(body, wag), { tex: scales(bodyColor, 3.0), ks: 0.45, shininess: 22 }),
      part(deform(merge(tail, dorsal, anal), wag), { tex: finTex, ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar, pelvic, pelvicFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(1.8), eye(-1.8)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
