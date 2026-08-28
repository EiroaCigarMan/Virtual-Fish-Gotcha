import { deform, ellipsoid, extrude, hex, lathe, merge, mixRGB, part, transform, type Part, type RGB } from "../../mesh";
import type { FishModel } from "../../types";
import { swimWag, scales } from "./common";

const TOP = hex("#e5731a"), MID = hex("#f7962a"), BELLY = hex("#ffc45e"), FIN = hex("#ffd27a"), FIN_D = hex("#f0a040");

const bodyColor = (_x: number, y: number): RGB => (y > 0 ? mixRGB(MID, TOP, Math.min(1, y / 3.2)) : mixRGB(MID, BELLY, Math.min(1, -y / 3)));

export const goldfish: FishModel = {
  frame: { w: 20, h: 14 },
  view: { yaw: -14, pitch: 6 },
  frames: 4,
  eye: [4.2, 1.0, 1.9],
  mouth: [6.6, -0.3, 0],
  build(k, n): Part[] {
    const body = lathe(
      [[6.6, 0], [6.2, 1.1], [5.2, 2.2], [3.2, 3.1], [1.0, 3.4], [-1.0, 3.2], [-3.0, 2.4], [-4.5, 1.3], [-5.3, 0.7]],
      20, bodyColor, 0.62,
    );
    const tail = extrude(
      [[-5, 0.9], [-9.2, 3.5], [-9.7, 1.7], [-8.1, 0], [-9.7, -1.7], [-9.2, -3.5], [-5, -0.9]],
      0.35, (x) => mixRGB(FIN_D, FIN, Math.min(1, (-5 - x) / 4)), [-5.2, 0],
    );
    const dorsal = extrude([[1.6, 2.9], [0.2, 4.7], [-2.2, 4.5], [-3.1, 2.2]], 0.3, FIN_D);
    const anal = extrude([[-1.2, -2.9], [-2.4, -4.3], [-3.4, -2.1]], 0.3, FIN_D);
    const pectoralBase: [number, number][] = [[0, 0], [-1.2, -2.3], [-2.8, -1.4]];
    const flap = Math.sin(((k / n) * Math.PI * 2)) * 18;
    const pectoral = transform(extrude(pectoralBase, 0.25, FIN), { r: [0, 0, flap], t: [3.1, -0.4, 1.9] });
    const pectoralFar = transform(extrude(pectoralBase, 0.25, FIN), { r: [0, 0, -flap], t: [3.1, -0.4, -1.9] });
    const eye = (z: number) => merge(
      transform(ellipsoid(0.85, 0.85, 0.6, 12, 8, hex("#ffffff")), { t: [4.2, 1.0, z] }),
      transform(ellipsoid(0.42, 0.42, 0.42, 10, 6, hex("#15162a")), { t: [4.45, 1.0, z * 1.22] }),
    );
    const mouth = transform(ellipsoid(0.55, 0.35, 0.5, 10, 6, hex("#c9531a")), { t: [6.55, -0.3, 0] });
    const wag = swimWag(k, n, -5, 6.6);
    return [
      part(deform(body, wag), { tex: scales(bodyColor, 3.0), ks: 0.45, shininess: 22 }),
      part(deform(merge(tail, dorsal, anal), wag), { ks: 0.25, shininess: 16 }),
      part(merge(pectoral, pectoralFar), { ks: 0.25, shininess: 16 }),
      part(merge(eye(1.9), eye(-1.9)), { ks: 0.8, shininess: 60 }),
      part(mouth, { ks: 0.2 }),
    ];
  },
};
