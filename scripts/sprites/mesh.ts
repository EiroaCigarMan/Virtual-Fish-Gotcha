/**
 * Tiny mesh DSL for the sprite pipeline. Everything is measured in *logical scene pixels*
 * (the 160×144 grid the engine reasons in); y points up, z toward the viewer.
 *
 * A Mesh is flat arrays: `pos` (world), `loc` (the position at generation time — what
 * textures and colour functions see, so patterns stay put when a part is moved) and
 * `col` (per-vertex albedo, 0..1). Normals are derived at render time from face winding,
 * so generators decide smooth vs flat purely by whether they share vertices.
 */
export type RGB = [number, number, number];
export type ColorFn = RGB | ((x: number, y: number, z: number) => RGB);
export type TexFn = (x: number, y: number, z: number) => RGB | null;

export interface Mesh {
  pos: number[];
  loc: number[];
  col: number[];
  idx: number[];
}

export interface Part {
  mesh: Mesh;
  /** Per-pixel albedo in local space; return null to cut the pixel out entirely. */
  tex?: TexFn;
  /** Specular strength (default 0.35) and exponent (default 28). */
  ks?: number;
  shininess?: number;
  /** Multiplier on the ambient+diffuse term — >1 for self-lit things (lamps, screens). */
  emissive?: number;
}

export const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scaleRGB = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Deterministic hash → 0..1, for texture noise. */
export function hash(x: number, y: number, z = 0): number {
  let h = Math.imul(Math.floor(x * 1000) | 0, 374761393) ^ Math.imul(Math.floor(y * 1000) | 0, 668265263) ^ Math.imul(Math.floor(z * 1000) | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function colorAt(c: ColorFn, x: number, y: number, z: number): RGB {
  return typeof c === "function" ? c(x, y, z) : c;
}

export function empty(): Mesh {
  return { pos: [], loc: [], col: [], idx: [] };
}

function pushVert(m: Mesh, x: number, y: number, z: number, c: ColorFn): number {
  const i = m.pos.length / 3;
  m.pos.push(x, y, z);
  m.loc.push(x, y, z);
  const [r, g, b] = colorAt(c, x, y, z);
  m.col.push(r, g, b);
  return i;
}

/**
 * Surface of revolution around the X axis. `profile` = [x, radius] pairs from one end to the
 * other; `squash` scales z (fish are laterally compressed). Smooth-shaded (shared vertices).
 */
export function lathe(profile: [number, number][], seg: number, color: ColorFn, squash = 1): Mesh {
  const m = empty();
  const rows = profile.length;
  for (let i = 0; i < rows; i++) {
    const [x, r] = profile[i];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pushVert(m, x, r * Math.cos(a), r * Math.sin(a) * squash, color);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2;
      // profile runs along +x; wind so normals point outward
      m.idx.push(a, c, b, b, c, d);
    }
  }
  return m;
}

/** UV sphere scaled to an ellipsoid, centred at the origin. Smooth. */
export function ellipsoid(rx: number, ry: number, rz: number, seg = 16, rings = 10, color: ColorFn = [1, 1, 1]): Mesh {
  const m = empty();
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI; // 0 top → π bottom
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      pushVert(m, rx * Math.sin(phi) * Math.cos(th), ry * Math.cos(phi), rz * Math.sin(phi) * Math.sin(th), color);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2;
      m.idx.push(a, b, c, b, d, c);
    }
  }
  return m;
}

/**
 * Axis-aligned box, centred at the origin, faces optionally subdivided (so colour functions
 * can paint gradients). Flat-shaded: no vertex sharing across faces.
 */
export function box(w: number, h: number, d: number, color: ColorFn, sub: [number, number, number] = [1, 1, 1]): Mesh {
  const m = empty();
  const hw = w / 2, hh = h / 2, hd = d / 2;
  // each face: origin corner, u vector, v vector, subdivisions along u and v
  type Face = { o: [number, number, number]; u: [number, number, number]; v: [number, number, number]; nu: number; nv: number };
  const faces: Face[] = [
    { o: [-hw, -hh, hd], u: [w, 0, 0], v: [0, h, 0], nu: sub[0], nv: sub[1] }, // front (+z)
    { o: [hw, -hh, -hd], u: [-w, 0, 0], v: [0, h, 0], nu: sub[0], nv: sub[1] }, // back
    { o: [hw, -hh, hd], u: [0, 0, -d], v: [0, h, 0], nu: sub[2], nv: sub[1] }, // right (+x)
    { o: [-hw, -hh, -hd], u: [0, 0, d], v: [0, h, 0], nu: sub[2], nv: sub[1] }, // left
    { o: [-hw, hh, hd], u: [w, 0, 0], v: [0, 0, -d], nu: sub[0], nv: sub[2] }, // top (+y)
    { o: [-hw, -hh, -hd], u: [w, 0, 0], v: [0, 0, d], nu: sub[0], nv: sub[2] }, // bottom
  ];
  for (const f of faces) {
    const base = m.pos.length / 3;
    for (let i = 0; i <= f.nu; i++) {
      for (let j = 0; j <= f.nv; j++) {
        const s = i / f.nu, t = j / f.nv;
        pushVert(m, f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t, f.o[2] + f.u[2] * s + f.v[2] * t, color);
      }
    }
    for (let i = 0; i < f.nu; i++) {
      for (let j = 0; j < f.nv; j++) {
        const a = base + i * (f.nv + 1) + j, b = a + (f.nv + 1), c = a + 1, d2 = b + 1;
        m.idx.push(a, b, c, c, b, d2);
      }
    }
  }
  return m;
}

/**
 * Cylinder / truncated cone around the Y axis, centred at the origin (y from -h/2 to h/2).
 * Sides smooth, caps flat.
 */
export function cylinder(rBottom: number, h: number, seg: number, color: ColorFn, rTop = rBottom, ySub = 1): Mesh {
  const m = empty();
  for (let i = 0; i <= ySub; i++) {
    const t = i / ySub, y = -h / 2 + h * t, r = lerp(rBottom, rTop, t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pushVert(m, r * Math.cos(a), y, r * Math.sin(a), color);
    }
  }
  for (let i = 0; i < ySub; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2;
      m.idx.push(a, c, b, b, c, d);
    }
  }
  // caps (separate vertices → flat)
  for (const [y, r, up] of [[h / 2, rTop, 1], [-h / 2, rBottom, -1]] as const) {
    if (r <= 0) continue;
    const center = pushVert(m, 0, y, 0, color);
    const ring: number[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      ring.push(pushVert(m, r * Math.cos(a), y, r * Math.sin(a), color));
    }
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      if (up > 0) m.idx.push(center, ring[j2], ring[j]);
      else m.idx.push(center, ring[j], ring[j2]);
    }
  }
  return m;
}

/** Cone = cylinder with rTop 0. */
export const cone = (r: number, h: number, seg: number, color: ColorFn) => cylinder(r, h, seg, color, 0);

/**
 * Extrude a 2-D polygon (in the x/y plane, counter-clockwise) to thickness `depth` centred on
 * z = 0. Faces are fanned from `fan` (defaults to the polygon's centroid), so the polygon must
 * be star-shaped from that point — plenty for fins, signs, leaves and pediments.
 */
export function extrude(poly: [number, number][], depth: number, color: ColorFn, fan?: [number, number]): Mesh {
  const m = empty();
  const n = poly.length;
  const c: [number, number] = fan ?? [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  const hd = depth / 2;
  for (const [z, sign] of [[hd, 1], [-hd, -1]] as const) {
    const center = pushVert(m, c[0], c[1], z, color);
    const ring = poly.map(([x, y]) => pushVert(m, x, y, z, color));
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      if (sign > 0) m.idx.push(center, a, b);
      else m.idx.push(center, b, a);
    }
  }
  // sides, flat
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
    const a = pushVert(m, x0, y0, hd, color), b = pushVert(m, x1, y1, hd, color);
    const c2 = pushVert(m, x0, y0, -hd, color), d = pushVert(m, x1, y1, -hd, color);
    m.idx.push(a, c2, b, b, c2, d);
  }
  return m;
}

/** A flat quad in the x/y plane (both sides), handy for thin panels. */
export function quad(w: number, h: number, color: ColorFn, sub: [number, number] = [1, 1]): Mesh {
  return box(w, h, 0.01, color, [sub[0], sub[1], 1]);
}

export interface Xform {
  t?: [number, number, number];
  /** Euler degrees, applied X then Y then Z. */
  r?: [number, number, number];
  s?: number | [number, number, number];
}

/** Returns a transformed copy (loc is preserved). */
export function transform(m: Mesh, x: Xform): Mesh {
  const out: Mesh = { pos: m.pos.slice(), loc: m.loc.slice(), col: m.col.slice(), idx: m.idx.slice() };
  const s = x.s === undefined ? [1, 1, 1] : typeof x.s === "number" ? [x.s, x.s, x.s] : x.s;
  const [rx, ry, rz] = (x.r ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180);
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const t = x.t ?? [0, 0, 0];
  for (let i = 0; i < out.pos.length; i += 3) {
    let px = out.pos[i] * s[0], py = out.pos[i + 1] * s[1], pz = out.pos[i + 2] * s[2];
    // X
    let y1 = py * cx - pz * sx, z1 = py * sx + pz * cx; py = y1; pz = z1;
    // Y
    let x1 = px * cy + pz * sy; z1 = -px * sy + pz * cy; px = x1; pz = z1;
    // Z
    x1 = px * cz - py * sz; y1 = px * sz + py * cz; px = x1; py = y1;
    out.pos[i] = px + t[0]; out.pos[i + 1] = py + t[1]; out.pos[i + 2] = pz + t[2];
  }
  // mirror flips winding
  const flips = s.filter((v) => v < 0).length % 2 === 1;
  if (flips) for (let i = 0; i < out.idx.length; i += 3) { const tmp = out.idx[i + 1]; out.idx[i + 1] = out.idx[i + 2]; out.idx[i + 2] = tmp; }
  return out;
}

/** Free-form vertex deformation of a copy (positions only). */
export function deform(m: Mesh, fn: (x: number, y: number, z: number) => [number, number, number]): Mesh {
  const out: Mesh = { pos: m.pos.slice(), loc: m.loc, col: m.col, idx: m.idx };
  for (let i = 0; i < out.pos.length; i += 3) {
    const [x, y, z] = fn(out.pos[i], out.pos[i + 1], out.pos[i + 2]);
    out.pos[i] = x; out.pos[i + 1] = y; out.pos[i + 2] = z;
  }
  return out;
}

export function merge(...meshes: Mesh[]): Mesh {
  const out = empty();
  for (const m of meshes) {
    const base = out.pos.length / 3;
    out.pos.push(...m.pos); out.loc.push(...m.loc); out.col.push(...m.col);
    for (const i of m.idx) out.idx.push(i + base);
  }
  return out;
}

export const part = (mesh: Mesh, opts: Omit<Part, "mesh"> = {}): Part => ({ mesh, ...opts });

/** Vertex normals from face winding (accumulated per shared vertex). */
export function normals(m: Mesh): Float32Array {
  const n = new Float32Array(m.pos.length);
  const p = m.pos;
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}
