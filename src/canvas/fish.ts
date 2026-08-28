/**
 * Drawing a fish from the baked sheet: frame pick, facing flip, mood tint (a cached, tinted copy
 * of the species' strip) and the little mood overlays at the eye and mouth.
 */
import { type Atlas, FISH, FISH_ROW_Y, PX } from "./atlas";
import type { Platform } from "./platform";
import type { FishMood, SpeciesId } from "../game/types";

/** Mix the sprite toward a colour: muted when bored, greenish when dirty, grey when sad. */
const MOOD_TINT: Record<FishMood, { toward: string; t: number } | null> = {
  content: null,
  sleepy: null,
  hungry: null,
  bored: { toward: "#9a8a7a", t: 0.25 },
  dirty: { toward: "#6a7a20", t: 0.4 },
  sad: { toward: "#6a6a7a", t: 0.5 },
};

export class FishPainter {
  private tinted = new Map<string, CanvasImageSource>();
  private platform: Platform;
  constructor(platform: Platform) { this.platform = platform; }

  /** The species' strip, tinted for the mood (cached per species+mood). */
  private strip(atlas: Atlas, species: SpeciesId, mood: FishMood): { img: CanvasImageSource; sy: number } {
    const tint = MOOD_TINT[mood];
    const sp = FISH[species];
    if (!tint) return { img: atlas.fish, sy: FISH_ROW_Y[sp.row] * PX };
    const key = `${species}:${mood}`;
    let img = this.tinted.get(key);
    if (!img) {
      const c = this.platform.createCanvas(sp.w * sp.frames * PX, sp.h * PX);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(atlas.fish, 0, FISH_ROW_Y[sp.row] * PX, sp.w * sp.frames * PX, sp.h * PX, 0, 0, sp.w * sp.frames * PX, sp.h * PX);
      ctx.globalCompositeOperation = "source-atop";
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(tint.toward.slice(i, i + 2), 16));
      ctx.fillStyle = `rgba(${r},${g},${b},${tint.t})`;
      ctx.fillRect(0, 0, c.width, c.height);
      img = c;
      this.tinted.set(key, img);
    }
    return { img, sy: 0 };
  }

  /**
   * Draw frame `frameT` of a species centred at (x, y) in logical units. `t` is scene time
   * (drives the blink / gulp cadence).
   */
  draw(ctx: CanvasRenderingContext2D, atlas: Atlas, species: SpeciesId, mood: FishMood, x: number, y: number, facing: 1 | -1, frameT: number, t: number): void {
    const sp = FISH[species];
    const n = sp.frames;
    const k = ((Math.floor(frameT) % n) + n) % n;
    const { img, sy } = this.strip(atlas, species, mood);
    ctx.save();
    ctx.translate(x, y);
    if (facing === -1) ctx.scale(-1, 1);
    ctx.drawImage(img, k * sp.w * PX, sy, sp.w * PX, sp.h * PX, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    // mood details, in frame coordinates (the flip above handles facing)
    const ex = sp.eye[0] - sp.w / 2, ey = sp.eye[1] - sp.h / 2;
    const mx = sp.mouth[0] - sp.w / 2, my = sp.mouth[1] - sp.h / 2;
    const eyeR = Math.max(0.6, sp.h * 0.07);
    ctx.fillStyle = "#1d1a2a";
    if (mood === "sad" || mood === "bored") { // droopy lid over the top of the eye
      ctx.beginPath(); ctx.arc(ex, ey - eyeR * 0.15, eyeR * 1.05, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    }
    if (mood === "sleepy" && Math.floor(t * 0.8) % 3 === 0) { // slow blink
      ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 1.1, eyeR * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (mood === "hungry" && Math.floor(t * 3) % 2 === 0) { // gulping mouth
      ctx.fillStyle = "#6b1e12";
      ctx.beginPath(); ctx.ellipse(mx, my + eyeR * 0.4, eyeR * 0.55, eyeR * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
