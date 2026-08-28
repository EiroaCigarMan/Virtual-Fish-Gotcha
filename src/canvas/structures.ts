/**
 * Every structure the fish can swim around. The landmark itself is a baked sprite (see
 * scripts/sprites/models/structures); at runtime each one adds its live pieces — the shared
 * LED clock panel, the AM/PM pip, and any moving detail (Big Ben's hands, City Hall's sign).
 * `bounds` is the sprite's box; `passages` are openings the fish is invited to swim through.
 */
import { type Atlas, PX, STRUCTURE } from "./atlas";
import { type Box, CLOCK_H, CLOCK_W, disc, drawClockPanel, drawMeridiemPip, rect } from "./clock";
import { drawText, textWidth } from "./pixelFont";
import type { StructureId, TimeFormat } from "../game/types";

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
  extras?(ctx: CanvasRenderingContext2D, now: Date, fmt: TimeFormat): void;
}

const CX = 80;
const clockBox = (y: number, x = CX - CLOCK_W / 2): Box => ({ x, y, w: CLOCK_W, h: CLOCK_H });
const boundsOf = (id: StructureId): Box => { const s = STRUCTURE[id]; return { x: s.x, y: s.y, w: s.w, h: s.h }; };

const def = (id: StructureId, rest: Omit<Structure, "id" | "bounds">): Structure => ({ id, get bounds() { return boundsOf(id); }, ...rest });

export const STRUCTURE_REGISTRY: Record<StructureId, Structure> = {
  castle: def("castle", { clock: clockBox(92), pip: [42, 66], edge: "#5c5e73" }),
  reunionTower: def("reunionTower", { clock: clockBox(106), pip: [96, 42], edge: "#6a7290" }),
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
  dallasCityHall: def("dallasCityHall", {
    clock: clockBox(90, 58), pip: [80, 44], edge: "#8b8579",
    extras(ctx) {
      // the picket sign in the plaza, lettered at runtime so it stays crisp text
      const S = { x: 97, y: 88, w: 27, h: 27 };
      ["SAVE", "DALLAS", "CITY", "HALL!"].forEach((line, i) => {
        const w = textWidth(line, 1);
        drawText(ctx, line, S.x + 1 + Math.floor((S.w - 2 - w) / 2), S.y + 2 + i * 6, 1, "#8f1d1d");
      });
    },
  }),
};

/** Draw a structure (sprite + live details + clock) onto a context already in logical units. */
export function drawStructure(ctx: CanvasRenderingContext2D, atlas: Atlas, id: StructureId, now: Date, fmt: TimeFormat, bg = "#1c1730"): void {
  const s = STRUCTURE[id];
  const st = STRUCTURE_REGISTRY[id];
  ctx.drawImage(atlas.structures, 0, s.sy * PX, s.w * PX, s.h * PX, s.x, s.y, s.w, s.h);
  st.extras?.(ctx, now, fmt);
  const meridiem = drawClockPanel(ctx, st.clock, now, fmt, st.edge);
  drawMeridiemPip(ctx, st.pip[0], st.pip[1], meridiem, bg);
}

export { rect };
