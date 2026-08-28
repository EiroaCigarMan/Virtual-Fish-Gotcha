import { box, merge, transform, hex, type Mesh, type RGB, type TexFn } from "../../mesh";

export const PANEL = hex("#0e1422");

/** Copy world positions into `loc` so a part's tex sees world coordinates. */
export const bakeLoc = (m: Mesh): Mesh => ({ ...m, loc: m.pos.slice() });

/**
 * Clock recess: a 1-unit lip proud of the facade (+0.4) and a dark panel inset 0.4 behind it,
 * covering exactly x0..x1 × y0..y1. Cut the facade out over the lip's outer rect (`withHole`)
 * so the inset panel shows.
 */
export function clockRecess(x0: number, x1: number, y0: number, y1: number, zFace: number, lip: RGB): Mesh {
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fz = zFace - 0.1;
  return merge(
    transform(box(w + 2, 1, 1, lip), { t: [cx, y1 + 0.5, fz] }),
    transform(box(w + 2, 1, 1, lip), { t: [cx, y0 - 0.5, fz] }),
    transform(box(1, h, 1, lip), { t: [x0 - 0.5, cy, fz] }),
    transform(box(1, h, 1, lip), { t: [x1 + 0.5, cy, fz] }),
    transform(box(w + 0.4, h + 0.4, 0.6, PANEL), { t: [cx, cy, zFace - 0.7] }),
  );
}

export const withHole = (tex: TexFn, x0: number, x1: number, y0: number, y1: number, zFace: number): TexFn =>
  (x, y, z) => (z > zFace - 0.5 && x > x0 - 1 && x < x1 + 1 && y > y0 - 1 && y < y1 + 1 ? null : tex(x, y, z));
