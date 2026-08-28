/**
 * Every structure the fish can swim around. The landmark itself is a baked sprite (see
 * scripts/sprites/models/structures); at runtime each one adds its live pieces — the shared
 * LED clock panel, the AM/PM pip, and any moving detail (Big Ben's hands, City Hall's sign).
 * `bounds` is the sprite's box; `passages` are openings the fish is invited to swim through.
 */
import { type Atlas, PX, STRUCTURE } from "./atlas";
import { type Box, CLOCK_H, CLOCK_W, disc, drawClockPanel, drawMeridiemPip, rect } from "./clock";
import { drawOmniDisplay, type OmniLive } from "./omni";
import { drawText, textWidth } from "./pixelFont";
import type { StructureId, TimeFormat } from "../game/types";
import type { Weather } from "../game/omni";

/** What changes frame to frame and isn't in the sprite: the clock, night, the Omni's message + weather. */
export interface Live { t: number; night: boolean; omniMessage: string; weather: Weather | null }
export const DEFAULT_LIVE: Live = { t: 0, night: false, omniMessage: "", weather: null };

export interface Structure {
  id: StructureId;
  /** Rectangle the fish treats as "the structure" (the sprite's box). */
  bounds: Box;
  /** Open spaces inside the structure the fish is invited to swim through (drawn behind). */
  passages?: Box[];
  /** Where the clock panel sits. */
  clock: Box;
  /** Where the AM/PM pip sits. */
  pip: [number, number];
  /** Colour of the panel's outer frame, matched to the structure's material. */
  edge: string;
  /** Live details drawn over the sprite before the clock. */
  extras?(ctx: CanvasRenderingContext2D, now: Date, fmt: TimeFormat, live: Live): void;
  /** Which baked night frame to show (for landmarks with night frames); `t` = scene seconds. */
  nightFrame?(now: Date, t: number): number;
}

const CX = 80;
const clockBox = (y: number, x = CX - CLOCK_W / 2): Box => ({ x, y, w: CLOCK_W, h: CLOCK_H });
const boundsOf = (id: StructureId): Box => { const s = STRUCTURE[id]; return { x: s.x, y: s.y, w: s.w, h: s.h }; };

const def = (id: StructureId, rest: Omit<Structure, "id" | "bounds">): Structure => ({ id, get bounds() { return boundsOf(id); }, ...rest });

export const STRUCTURE_REGISTRY: Record<StructureId, Structure> = {
  castle: def("castle", { clock: clockBox(92), pip: [42, 66], edge: "#5c5e73" }),
  reunionTower: def("reunionTower", {
    clock: clockBox(106), pip: [96, 42], edge: "#6a7290",
    // lamp programs rotate by the minute: steady → chase (thirds at 3 Hz) → sweep (band rising at 1.5 Hz)
    nightFrame(now, t) {
      const mode = now.getMinutes() % 3;
      if (mode === 0) return 0;
      if (mode === 1) return 1 + (Math.floor(t * 3) % 3);
      return 4 + (Math.floor(t * 1.5) % 3);
    },
  }),
  eiffelTower: def("eiffelTower", {
    passages: [{ x: 64, y: 108, w: 32, h: 14 }],
    clock: clockBox(88), pip: [80, 32], edge: "#9a6f42",
  }),
  bigBen: def("bigBen", {
    clock: clockBox(104, 54), pip: [106, 36], edge: "#8c7a55",
    extras(ctx, now) {
      // the famous dial — live hands
      const cx = 106, cy = 70;
      const h = now.getHours() % 12, m = now.getMinutes();
      const hand = (ang: number, len: number, w: number) => {
        ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = w; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke();
      };
      hand(((h + m / 60) / 12) * Math.PI * 2, 3.2, 0.9);
      hand((m / 60) * Math.PI * 2, 4.6, 0.6);
      disc(ctx, cx, cy, 0.6, "#1a1a2e");
    },
  }),
  parthenon: def("parthenon", { clock: clockBox(86), pip: [80, 68], edge: "#8a8270" }),
  stonehenge: def("stonehenge", {
    passages: [{ x: 65, y: 96, w: 30, h: 26 }],
    clock: clockBox(78), pip: [80, 72], edge: "#5d594e",
  }),
  pineapple: def("pineapple", { clock: clockBox(94), pip: [80, 48], edge: "#8a5a2a" }),
  dallasCityHall: def("dallasCityHall", { clock: clockBox(90, 58), pip: [80, 44], edge: "#8b8579" }),
  dallasSkyline: def("dallasSkyline", {
    // open water between the small Reunion Tower and the podium, and between Renaissance Tower and the Omni
    passages: [{ x: 43, y: 96, w: 18, h: 26 }, { x: 100, y: 96, w: 16, h: 26 }],
    clock: clockBox(106), pip: [110, 40], edge: "#9a9dab",
    nightFrame: (_now, t) => Math.floor(t * 0.7) % 2, // windows twinkle between two lit patterns
  }),
  omniHotel: def("omniHotel", {
    clock: clockBox(106), pip: [116, 58], edge: "#8d93a4",
    // the LED field covers the whole facade: scene 38..122 × 71..103 (one cell per unit)
    extras(ctx, now, fmt, live) {
      const omni: OmniLive = { now, fmt, t: live.t, night: live.night, message: live.omniMessage, weather: live.weather };
      drawOmniDisplay(ctx, { x: 38, y: 71, w: 84, h: 32 }, omni);
      // the crown sign: plain by day, neon after dark (a soft halo, a coloured bloom, then the crisp letters)
      const sign = "OMNI HOTEL", sc = 0.6, gap = 0.6;
      const w = textWidth(sign, sc, gap), sx = 80 - w / 2, sy = 64.4;
      if (live.night) {
        const halo = ctx.createRadialGradient(80, sy + 1.5, 1, 80, sy + 1.5, 20);
        halo.addColorStop(0, "rgba(94,233,255,0.28)"); halo.addColorStop(1, "rgba(94,233,255,0)");
        ctx.fillStyle = halo; ctx.fillRect(56, sy - 8, 48, 19);
        ctx.globalAlpha = 0.22;
        for (const [dx, dy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [-0.35, -0.35], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35]]) drawText(ctx, sign, sx + dx, sy + dy, sc, "#5ee9ff", gap);
        ctx.globalAlpha = 1;
        drawText(ctx, sign, sx, sy, sc, "#eafdff", gap);
      } else {
        drawText(ctx, sign, sx, sy, sc, "#d9dde8", gap);
      }
    },
  }),
};

/**
 * Draw a structure (sprite + live details + clock) onto a context already in logical units.
 * At night a landmark with baked night frames shows one (chosen by its `nightFrame`); any other
 * landmark is drawn from the night-tinted sheet when the atlas carries one.
 */
export function drawStructure(ctx: CanvasRenderingContext2D, atlas: Atlas, id: StructureId, now: Date, fmt: TimeFormat, bg = "#1c1730", night = false, t = 0, live: Live = DEFAULT_LIVE): void {
  const s = STRUCTURE[id];
  const st = STRUCTURE_REGISTRY[id];
  if (night && s.night?.length) {
    const k = Math.min(s.night.length - 1, Math.max(0, st.nightFrame?.(now, t) ?? 0));
    ctx.drawImage(atlas.structures, 0, s.night[k] * PX, s.w * PX, s.h * PX, s.x, s.y, s.w, s.h);
  } else {
    ctx.drawImage(night && atlas.structuresNight ? atlas.structuresNight : atlas.structures, 0, s.sy * PX, s.w * PX, s.h * PX, s.x, s.y, s.w, s.h);
  }
  st.extras?.(ctx, now, fmt, { ...live, t, night });
  const meridiem = drawClockPanel(ctx, st.clock, now, fmt, st.edge);
  drawMeridiemPip(ctx, st.pip[0], st.pip[1], meridiem, bg);
}

export { rect };
