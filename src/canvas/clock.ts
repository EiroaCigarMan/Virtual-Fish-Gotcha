/**
 * The shared LED clock panel every structure carries: a bevelled dark panel, the time in big
 * seven-segment digits and the date (mm/dd/yy) in a smaller row beneath. All vector, drawn in
 * logical units under the engine's 4× transform.
 */
import { drawLed, ledWidth, type LedStyle } from "./ledFont";
import { formatClock, formatDateMMDDYY } from "../game/time";
import type { TimeFormat } from "../game/types";

export interface Box { x: number; y: number; w: number; h: number }

/** Standard panel size shared by every structure (time row + date row). */
export const CLOCK_W = 36;
export const CLOCK_H = 16;

export const CLOCK_COLORS = {
  panel: "#0e1422",
  panelLight: "#182238",
  panelEdge: "#3a4a6a",
  glow: "#7ef9a2",
  glowDate: "#63d88c",
  ghost: "rgba(126,249,162,0.11)",
  sun: "#ffd45a",
  moon: "#a9c4ff",
};

const TIME_STYLE: LedStyle = { h: 7.6, w: 4.2, t: 0.95, gap: 1.15, skew: 0.06 };
const DATE_STYLE: LedStyle = { h: 3.3, w: 2.05, t: 0.5, gap: 0.62, skew: 0.06 };

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** Filled disc (anti-aliased). */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the clock panel (edge + bevelled panel + glass sheen + LED time + LED date) and returns
 * the meridiem ("AM" | "PM" | "") so the structure can place its sun/moon pip.
 */
export function drawClockPanel(ctx: CanvasRenderingContext2D, box: Box, now: Date, fmt: TimeFormat, edge = CLOCK_COLORS.panelEdge): string {
  // frame
  rect(ctx, box.x - 1, box.y - 1, box.w + 2, box.h + 2, edge);
  rect(ctx, box.x - 0.5, box.y - 0.5, box.w + 1, box.h + 1, "#060910");
  // panel with a vertical bevel gradient
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  g.addColorStop(0, CLOCK_COLORS.panelLight);
  g.addColorStop(0.5, CLOCK_COLORS.panel);
  g.addColorStop(1, "#0a0f1a");
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const { display, meridiem } = formatClock(now, fmt);
  const tw = ledWidth(display, TIME_STYLE);
  drawLed(ctx, display, box.x + (box.w - tw) / 2, box.y + 1.3, TIME_STYLE, CLOCK_COLORS.glow, CLOCK_COLORS.ghost);
  const date = formatDateMMDDYY(now);
  const dw = ledWidth(date, DATE_STYLE);
  drawLed(ctx, date, box.x + (box.w - dw) / 2, box.y + 10.6, DATE_STYLE, CLOCK_COLORS.glowDate, "rgba(126,249,162,0.06)");

  // glass sheen across the upper third
  const s = ctx.createLinearGradient(0, box.y, 0, box.y + box.h * 0.45);
  s.addColorStop(0, "rgba(255,255,255,0.10)");
  s.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = s;
  ctx.fillRect(box.x, box.y, box.w, box.h * 0.45);
  return meridiem;
}

/** AM = a small sun, PM = a crescent moon (bite in `bg`). No-op in 24h mode (empty meridiem). */
export function drawMeridiemPip(ctx: CanvasRenderingContext2D, x: number, y: number, meridiem: string, bg: string) {
  if (!meridiem) return;
  if (meridiem === "AM") {
    const g = ctx.createRadialGradient(x - 0.4, y - 0.4, 0.2, x, y, 1.9);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(1, CLOCK_COLORS.sun);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,212,90,0.6)"; ctx.lineWidth = 0.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4); ctx.lineTo(x + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1); ctx.stroke();
    }
  } else {
    void bg;
    // crescent: outer arc of the moon minus an inner arc offset to the upper right
    ctx.fillStyle = CLOCK_COLORS.moon;
    ctx.beginPath();
    ctx.arc(x, y, 1.9, Math.PI * 0.25, Math.PI * 1.75, false);
    ctx.arc(x + 0.8, y - 0.4, 1.55, Math.PI * 1.85, Math.PI * 0.15, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath(); ctx.arc(x - 0.7, y + 0.2, 0.45, 0, Math.PI * 2); ctx.fill();
  }
}
