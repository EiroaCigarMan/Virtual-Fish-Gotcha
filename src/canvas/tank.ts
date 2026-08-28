/**
 * Tank geometry + glass. The scene is 160×144 logical px either way; the tank decides where
 * the water is (via `halfW(y)`, the half-width of the water at row y), where the sand, rim and
 * surface sit, and how the glass is drawn. Structures stand on the same sand line in both.
 */
import type { TankShape } from "../game/types";

export interface TankGeom {
  shape: TankShape;
  cx: number;
  /** Top of the glass, water surface, top of the sand, bottom of the interior. */
  rimY: number; waterY: number; sandY: number; floorY: number;
  /** Half-width of the interior at row y (0 outside). */
  halfW(y: number): number;
  /** Clip to the interior (call inside save/restore). */
  clipInterior(ctx: CanvasRenderingContext2D): void;
  /** Fill the interior with the current fillStyle. */
  fillInterior(ctx: CanvasRenderingContext2D): void;
  /** The glass itself, drawn over everything. */
  drawGlass(ctx: CanvasRenderingContext2D, airColor: string): void;
  /** Where the table top starts. */
  tableY: number;
}

const BOWL = { cx: 80, cy: 78, r: 62, rimY: 24, waterY: 36, sandY: 124 };

export const bowl: TankGeom = {
  shape: "bowl",
  cx: BOWL.cx,
  rimY: BOWL.rimY, waterY: BOWL.waterY, sandY: BOWL.sandY, floorY: BOWL.cy + BOWL.r,
  tableY: BOWL.cy + BOWL.r - 2,
  halfW(y) {
    const dy = y - BOWL.cy;
    const v = BOWL.r * BOWL.r - dy * dy;
    return v <= 0 ? 0 : Math.sqrt(v);
  },
  clipInterior(ctx) {
    ctx.beginPath(); ctx.arc(BOWL.cx, BOWL.cy, BOWL.r - 1.5, 0, Math.PI * 2); ctx.clip();
  },
  fillInterior(ctx) {
    ctx.beginPath(); ctx.arc(BOWL.cx, BOWL.cy, BOWL.r - 1.5, 0, Math.PI * 2); ctx.fill();
  },
  drawGlass(ctx, airColor) {
    const { cx, cy, r } = BOWL;
    // inner shading: brighter upper-left (refraction), darker toward the right edge
    ctx.save();
    this.clipInterior(ctx);
    const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.3, r * 0.2, cx, cy, r);
    shade.addColorStop(0, "rgba(255,255,255,0.06)"); shade.addColorStop(0.75, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,30,0.28)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 160, 144);
    ctx.restore();
    // wall
    const wall = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    wall.addColorStop(0, "#e9f7ff"); wall.addColorStop(0.5, "#a9d8ea"); wall.addColorStop(1, "#7fb6cc");
    ctx.strokeStyle = wall; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 0.4, 0, Math.PI * 2); ctx.stroke();
    // rim (the lip)
    const rimHw = this.halfW(BOWL.rimY) + 2;
    ctx.fillStyle = "#eaf8ff";
    ctx.beginPath(); ctx.ellipse(cx, BOWL.rimY - 0.5, rimHw, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = airColor;
    ctx.beginPath(); ctx.ellipse(cx, BOWL.rimY - 0.5, rimHw - 2.2, 1.1, 0, 0, Math.PI * 2); ctx.fill();
    // highlights
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, Math.PI * 1.5, Math.PI * 1.62); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, Math.PI * 0.12, Math.PI * 0.42); ctx.stroke();
  },
};

/** Square-cornered aquarium: flat glass, wider water, same sand line. */
const SQ = { x0: 11, x1: 149, rimY: 22, waterY: 34, sandY: 124, floorY: 139 };

export const square: TankGeom = {
  shape: "square",
  cx: (SQ.x0 + SQ.x1) / 2,
  rimY: SQ.rimY, waterY: SQ.waterY, sandY: SQ.sandY, floorY: SQ.floorY,
  tableY: SQ.floorY + 1,
  halfW(y) {
    return y < SQ.rimY || y > SQ.floorY ? 0 : (SQ.x1 - SQ.x0) / 2 - 1.5;
  },
  clipInterior(ctx) {
    ctx.beginPath(); ctx.rect(SQ.x0 + 1.5, SQ.rimY + 1, SQ.x1 - SQ.x0 - 3, SQ.floorY - SQ.rimY - 1); ctx.clip();
  },
  fillInterior(ctx) {
    ctx.fillRect(SQ.x0 + 1.5, SQ.rimY + 1, SQ.x1 - SQ.x0 - 3, SQ.floorY - SQ.rimY - 1);
  },
  drawGlass(ctx, airColor) {
    void airColor;
    const { x0, x1, rimY, floorY } = SQ;
    // inner shading: light falls from the upper left; the far wall darkens to the right
    ctx.save();
    this.clipInterior(ctx);
    const shade = ctx.createLinearGradient(x0, 0, x1, 0);
    shade.addColorStop(0, "rgba(255,255,255,0.07)"); shade.addColorStop(0.35, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,30,0.22)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 160, 144);
    ctx.restore();
    // walls: a bevelled frame
    const wall = ctx.createLinearGradient(x0, rimY, x1, floorY);
    wall.addColorStop(0, "#e9f7ff"); wall.addColorStop(0.5, "#a9d8ea"); wall.addColorStop(1, "#7fb6cc");
    ctx.strokeStyle = wall; ctx.lineWidth = 2.4; ctx.lineJoin = "miter";
    ctx.strokeRect(x0 + 0.3, rimY + 0.3, x1 - x0 - 0.6, floorY - rimY - 0.6);
    // top rim: a flat bar with a lit edge
    ctx.fillStyle = "#eaf8ff"; ctx.fillRect(x0 - 1.5, rimY - 2, x1 - x0 + 3, 2.6);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x0 - 1.5, rimY + 0.4, x1 - x0 + 3, 0.6);
    // base trim
    ctx.fillStyle = "#6f9cae"; ctx.fillRect(x0 - 1.5, floorY - 0.8, x1 - x0 + 3, 2.2);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x0 - 1.5, floorY - 0.8, x1 - x0 + 3, 0.5);
    // vertical highlights on the front pane
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x0 + 5, rimY + 8); ctx.lineTo(x0 + 5, rimY + 44); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 + 8.5, rimY + 50); ctx.lineTo(x0 + 8.5, rimY + 66); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x1 - 5, rimY + 14); ctx.lineTo(x1 - 5, rimY + 40); ctx.stroke();
  },
};

export const TANK_GEOMS: Record<TankShape, TankGeom> = { bowl, square };
