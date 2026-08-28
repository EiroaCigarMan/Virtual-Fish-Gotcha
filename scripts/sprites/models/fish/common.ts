import { hash, scaleRGB, type RGB, type TexFn } from "../../mesh";

/**
 * Side-to-side swim wag for frame k of n: the body bends in z with amplitude growing toward
 * the tail (x = tailX), nothing at the nose. Applied after modelling, before rendering.
 */
export function swimWag(k: number, n: number, tailX: number, noseX: number, amp = 1.6) {
  const phase = (k / n) * Math.PI * 2;
  const len = noseX - tailX;
  return (x: number, y: number, z: number): [number, number, number] => {
    const t = Math.max(0, Math.min(1, (noseX - x) / len)); // 0 nose → 1 tail base (and beyond)
    const w = Math.pow(Math.max(0, (noseX - x) / len - 0.15) / 0.85, 1.5) * (x < tailX ? 1 + (tailX - x) * 0.18 : 1);
    return [x, y, z + Math.sin(phase - t * 2.2) * amp * w];
  };
}

/** Scale texture: a crescent lattice that darkens a little along scale edges. */
export function scales(base: (x: number, y: number, z: number) => RGB, pitch = 3): TexFn {
  return (x, y, z) => {
    const c = base(x, y, z);
    const row = Math.floor(y * pitch / 2);
    const u = (x * pitch + (row % 2) * 0.5) % 1, v = (y * pitch / 2) % 1;
    const d = Math.hypot(u - 0.5, v - 0.5);
    const edge = d > 0.42 && d < 0.5 ? 0.9 : 1;
    const speck = 0.96 + hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z)) * 0.08;
    return scaleRGB(c, edge * speck);
  };
}
