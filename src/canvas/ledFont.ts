/**
 * Seven-segment LED glyphs drawn as vector shapes, so they stay crisp at any scale. Digits,
 * ':' and '/'. Every digit first paints its unlit segments faintly (the "ghost" of a real LED
 * display), then the lit ones with a soft glow pass under a crisp pass.
 */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
  "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
};

export interface LedStyle {
  /** Digit box height and width, segment thickness, gap between glyphs — logical px. */
  h: number; w: number; t: number; gap: number;
  /** Italic lean, as x shift per unit of height (0 = upright). */
  skew?: number;
}

const punctWidth = (st: LedStyle) => st.t * 1.4;

export function ledWidth(text: string, st: LedStyle): number {
  let w = 0;
  for (const ch of text) w += (ch === ":" || ch === "/" ? punctWidth(st) : st.w) + st.gap;
  return Math.max(0, w - st.gap);
}

/** A bevelled bar from (x0,y0) to (x1,y1) with thickness t — the classic hexagonal LED segment. */
function bar(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy * t / 2, ny = ux * t / 2;
  const b = t / 2; // bevel length
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + ux * b + nx, y0 + uy * b + ny);
  ctx.lineTo(x1 - ux * b + nx, y1 - uy * b + ny);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - ux * b - nx, y1 - uy * b - ny);
  ctx.lineTo(x0 + ux * b - nx, y0 + uy * b - ny);
  ctx.closePath();
  ctx.fill();
}

/** Segment endpoints for a digit box at (x, y) with style st; segments shortened so joints don't touch. */
function segment(seg: string, x: number, y: number, st: LedStyle): [number, number, number, number] {
  const { w, h, t } = st;
  const g = t * 0.35; // joint gap
  const mid = y + h / 2;
  switch (seg) {
    case "a": return [x + t / 2 + g, y + t / 2, x + w - t / 2 - g, y + t / 2];
    case "g": return [x + t / 2 + g, mid, x + w - t / 2 - g, mid];
    case "d": return [x + t / 2 + g, y + h - t / 2, x + w - t / 2 - g, y + h - t / 2];
    case "f": return [x + t / 2, y + t / 2 + g, x + t / 2, mid - g];
    case "b": return [x + w - t / 2, y + t / 2 + g, x + w - t / 2, mid - g];
    case "e": return [x + t / 2, mid + g, x + t / 2, y + h - t / 2 - g];
    case "c": return [x + w - t / 2, mid + g, x + w - t / 2, y + h - t / 2 - g];
  }
  return [x, y, x, y];
}

/**
 * Draw `text` with its top-left at (x, y). `lit` is the segment colour; `ghost` (optional) the
 * unlit-segment colour. Returns the drawn width.
 */
export function drawLed(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, st: LedStyle, lit: string, ghost?: string): number {
  const skew = st.skew ?? 0;
  ctx.save();
  // lean the whole run: x' = x - skew * (y - baseline)
  ctx.transform(1, 0, -skew, 1, skew * (y + st.h), 0);
  let cx = x;
  const paint = (ch: string, color: string, thick: number, onlyLit: boolean) => {
    ctx.fillStyle = color;
    if (ch === ":") {
      const pw = punctWidth(st);
      const r = thick / 2;
      for (const fy of [0.3, 0.7]) { ctx.beginPath(); ctx.arc(cx + pw / 2, y + st.h * fy, r, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (ch === "/") {
      const pw = punctWidth(st);
      bar(ctx, cx + thick * 0.3, y + st.h - thick * 0.8, cx + pw - thick * 0.3, y + thick * 0.8, thick);
      return;
    }
    const segs = SEGMENTS[ch];
    if (!segs) return;
    const set = onlyLit ? segs : "abcdefg";
    for (const s of set) {
      const [x0, y0, x1, y1] = segment(s, cx, y, { ...st, t: st.t });
      bar(ctx, x0, y0, x1, y1, thick);
    }
  };
  for (const ch of text) {
    const w = ch === ":" || ch === "/" ? punctWidth(st) : st.w;
    if (ghost && SEGMENTS[ch]) paint(ch, ghost, st.t, false);
    // glow: a fatter, translucent pass under the crisp one
    ctx.globalAlpha = 0.28;
    paint(ch, lit, st.t * 1.9, true);
    ctx.globalAlpha = 1;
    paint(ch, lit, st.t, true);
    cx += w + st.gap;
  }
  ctx.restore();
  return cx - x - st.gap;
}
