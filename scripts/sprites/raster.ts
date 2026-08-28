/**
 * Software rasterizer for baking sprites: orthographic camera, z-buffer, Gouraud lighting with
 * a per-vertex Blinn-Phong highlight and a faint rim — the early-2000s console look — plus
 * optional per-pixel procedural texturing (with cut-outs). Renders at 2× and box-filters down,
 * so silhouettes get proper coverage alpha.
 *
 * Pure math on plain arrays: deterministic, no GL, no browser.
 */
import { normals, type Part, type RGB } from "./mesh";

/** Physical output pixels per logical scene pixel (the engine draws at 4×). */
export const PX = 4;
const SS = 2; // supersampling factor

export interface View {
  /** Degrees. Yaw turns the model around the vertical axis (negative = nose toward viewer for a right-facing fish). */
  yaw: number;
  /** Degrees. Positive tips the top toward the viewer. */
  pitch: number;
}

/** The box of model space (logical px, y up) that becomes the sprite. */
export interface Frame { x: number; y: number; w: number; h: number }

export interface Rendered {
  width: number;
  height: number;
  /** RGBA, straight alpha, row-major, physical pixels. */
  data: Uint8ClampedArray;
}

export interface LightRig {
  dir: [number, number, number];
  ambient: number;
  diffuse: number;
  rim: number;
  rimColor: RGB;
}

export const DEFAULT_LIGHT: LightRig = {
  dir: [-0.45, 0.62, 0.64],
  ambient: 0.4,
  diffuse: 0.66,
  rim: 0.14,
  rimColor: [0.75, 0.88, 1],
};

const norm3 = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Project a model-space point to sprite coordinates (logical px from the frame's top-left). */
export function project(p: [number, number, number], frame: Frame, view: View): [number, number] {
  const [x, y] = rotate(p, view);
  return [x - frame.x, frame.y + frame.h - y];
}

function rotate([x, y, z]: [number, number, number], view: View): [number, number, number] {
  const p = (view.pitch * Math.PI) / 180, yw = (view.yaw * Math.PI) / 180;
  // yaw about Y
  let x1 = x * Math.cos(yw) + z * Math.sin(yw), z1 = -x * Math.sin(yw) + z * Math.cos(yw);
  // pitch about X
  const y2 = y * Math.cos(p) - z1 * Math.sin(p), z2 = y * Math.sin(p) + z1 * Math.cos(p);
  return [x1, y2, z2];
}

export function render(parts: Part[], frame: Frame, view: View, light: LightRig = DEFAULT_LIGHT): Rendered {
  const S = PX * SS;
  const W = Math.round(frame.w * S), H = Math.round(frame.h * S);
  const rgb = new Float32Array(W * H * 3);
  const cov = new Uint8Array(W * H);
  const zb = new Float32Array(W * H).fill(-Infinity);
  const L = norm3(light.dir);
  const V: [number, number, number] = [0, 0, 1];
  const Hv = norm3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);

  for (const part of parts) {
    const m = part.mesh;
    const nv = m.pos.length / 3;
    const nrm = normals(m);
    const ks = part.ks ?? 0.35, shin = part.shininess ?? 28, emis = part.emissive ?? 1;
    // transform vertices + normals into view space
    const sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
    const nx = new Float32Array(nv), ny = new Float32Array(nv), nz = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const [x, y, z] = rotate([m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], view);
      sx[i] = (x - frame.x) * S; sy[i] = (frame.y + frame.h - y) * S; sz[i] = z;
      const [a, b, c] = rotate([nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]], view);
      nx[i] = a; ny[i] = b; nz[i] = c;
    }
    const lit = (i: number, flip: number): [number, number, number] => {
      const ax = nx[i] * flip, ay = ny[i] * flip, az = nz[i] * flip;
      const ndl = Math.max(0, ax * L[0] + ay * L[1] + az * L[2]);
      const ndh = Math.max(0, ax * Hv[0] + ay * Hv[1] + az * Hv[2]);
      const ndv = Math.max(0, az);
      const diffuse = (light.ambient + light.diffuse * ndl) * emis;
      const spec = ks * Math.pow(ndh, shin);
      const rim = light.rim * Math.pow(1 - ndv, 2.5);
      return [diffuse, spec, rim];
    };
    for (let t = 0; t < m.idx.length; t += 3) {
      const ia = m.idx[t], ib = m.idx[t + 1], ic = m.idx[t + 2];
      const ax = sx[ia], ay = sy[ia], bx = sx[ib], by = sy[ib], cx = sx[ic], cy = sy[ic];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-6) continue;
      // screen y points down, so a counter-clockwise (front-facing) triangle has negative area here
      const flip = area < 0 ? 1 : -1;
      const la = lit(ia, flip), lb = lit(ib, flip), lc = lit(ic, flip);
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const inv = 1 / area;
      for (let py = y0; py <= y1; py++) {
        const yy = py + 0.5;
        for (let px = x0; px <= x1; px++) {
          const xx = px + 0.5;
          let w0 = ((bx - xx) * (cy - yy) - (by - yy) * (cx - xx)) * inv;
          let w1 = ((cx - xx) * (ay - yy) - (cy - yy) * (ax - xx)) * inv;
          let w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sz[ia] + w1 * sz[ib] + w2 * sz[ic];
          const k = py * W + px;
          if (z <= zb[k]) continue;
          let r: number, g: number, b: number;
          if (part.tex) {
            const lx = w0 * m.loc[ia * 3] + w1 * m.loc[ib * 3] + w2 * m.loc[ic * 3];
            const ly = w0 * m.loc[ia * 3 + 1] + w1 * m.loc[ib * 3 + 1] + w2 * m.loc[ic * 3 + 1];
            const lz = w0 * m.loc[ia * 3 + 2] + w1 * m.loc[ib * 3 + 2] + w2 * m.loc[ic * 3 + 2];
            const c = part.tex(lx, ly, lz);
            if (!c) continue;
            [r, g, b] = c;
          } else {
            r = w0 * m.col[ia * 3] + w1 * m.col[ib * 3] + w2 * m.col[ic * 3];
            g = w0 * m.col[ia * 3 + 1] + w1 * m.col[ib * 3 + 1] + w2 * m.col[ic * 3 + 1];
            b = w0 * m.col[ia * 3 + 2] + w1 * m.col[ib * 3 + 2] + w2 * m.col[ic * 3 + 2];
          }
          const d = w0 * la[0] + w1 * lb[0] + w2 * lc[0];
          const s = w0 * la[1] + w1 * lb[1] + w2 * lc[1];
          const rm = w0 * la[2] + w1 * lb[2] + w2 * lc[2];
          zb[k] = z;
          cov[k] = 1;
          rgb[k * 3] = r * d + s + rm * light.rimColor[0];
          rgb[k * 3 + 1] = g * d + s + rm * light.rimColor[1];
          rgb[k * 3 + 2] = b * d + s + rm * light.rimColor[2];
        }
      }
    }
  }

  // box-filter down to PX per logical pixel; alpha = coverage
  const ow = W / SS, oh = H / SS;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let n = 0, r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const k = (y * SS + dy) * W + (x * SS + dx);
          if (!cov[k]) continue;
          n++; r += rgb[k * 3]; g += rgb[k * 3 + 1]; b += rgb[k * 3 + 2];
        }
      }
      const o = (y * ow + x) * 4;
      if (n === 0) continue;
      out[o] = Math.round(Math.min(1, r / n) * 255);
      out[o + 1] = Math.round(Math.min(1, g / n) * 255);
      out[o + 2] = Math.round(Math.min(1, b / n) * 255);
      out[o + 3] = Math.round((n / (SS * SS)) * 255);
    }
  }
  return { width: ow, height: oh, data: out };
}
