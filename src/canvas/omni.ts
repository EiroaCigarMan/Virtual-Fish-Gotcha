/**
 * The Omni's LED facade. A 40×36 grid of cells over the display area; slides are composed into
 * the grid (pixel graphics, a scrolling message, the date/time, the weather) and every lit cell
 * is drawn as a small glowing square. Which slide is up comes from game/omni.ts (wall-clock
 * aligned, 15 minutes each).
 */
import { FONT_3X5 } from "./pixelFont";
import type { Box } from "./clock";
import { slideAt, type Weather, type WeatherIcon } from "../game/omni";
import { formatClock } from "../game/time";
import type { TimeFormat } from "../game/types";

export interface OmniLive {
  now: Date;
  fmt: TimeFormat;
  /** Scene seconds — drives scrolling and the graphics rotation. */
  t: number;
  night: boolean;
  message: string;
  weather: Weather | null;
}

const COLS = 40, ROWS = 36;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

type Grid = Map<number, string>; // cell index → colour
const key = (x: number, y: number) => y * COLS + x;

function plot(g: Grid, x: number, y: number, c: string) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
  g.set(key(x, y), c);
}

/** Letter `text` with the 3×5 font at integer `scale` (cells); returns the width in cells. */
function textWidth(text: string, scale: number, gap = 1): number {
  let w = 0;
  for (const ch of text) { const gl = FONT_3X5[ch]; if (gl) w += gl[0].length * scale + gap; }
  return Math.max(0, w - gap);
}
function letter(g: Grid, text: string, x0: number, y0: number, scale: number, color: string, gap = 1) {
  let x = x0;
  for (const ch of text) {
    const gl = FONT_3X5[ch];
    if (!gl) continue;
    for (let r = 0; r < gl.length; r++) for (let c = 0; c < gl[r].length; c++) {
      if (gl[r][c] !== "1") continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) plot(g, x + c * scale + dx, y0 + r * scale + dy, color);
    }
    x += gl[0].length * scale + gap;
  }
}

/** Small pixel art, '.' = off, letters index the palette. */
function art(g: Grid, rows: string[], pal: Record<string, string>, x0: number, y0: number, scale = 1) {
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const col = pal[rows[r][c]];
    if (!col) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) plot(g, x0 + c * scale + dx, y0 + r * scale + dy, col);
  }
}

const AMBER = "#ffb84d", WHITE = "#fff2d6", CYAN = "#7ff3ff", RED = "#ff4d6d", GREEN = "#7dff9a", BLUE = "#4d8dff", GOLD = "#ffe27a", GREY = "#b9c4d8";

const GRAPHICS: { rows: string[]; pal: Record<string, string> }[] = [
  { pal: { s: GOLD }, rows: [ // star
    ".......s.......", "......sss......", "......sss......", ".....sssss.....", "sssssssssssssss", ".sssssssssssss.", "..sssssssssss..", "...sssssssss...", "...ssss.ssss...", "..sss.....sss..", ".ss.........ss."] },
  { pal: { h: RED, l: "#ff9aae" }, rows: [ // heart
    "..hhh.....hhh..", ".hlhhh...hhhhh.", "hhlhhhh.hhhhhhh", "hhhhhhhhhhhhhhh", "hhhhhhhhhhhhhhh", ".hhhhhhhhhhhhh.", "..hhhhhhhhhhh..", "...hhhhhhhhh...", "....hhhhhhh....", ".....hhhhh.....", "......hhh......", ".......h......."] },
  { pal: { o: AMBER, w: WHITE, k: "#1a1a2e", f: GOLD }, rows: [ // fish
    "......ooo......", "f....ooooo.....", "ff..ooooooowk..", "fffoooooooooooo", "ff..ooooooooo..", "f....ooooo.....", "......ooo......"] },
  { pal: { b: BLUE, w: WHITE, r: RED }, rows: [ // Texas flag
    "bbbbbwwwwwwwwwwwwww", "bbbbbwwwwwwwwwwwwww", "bbwbbwwwwwwwwwwwwww", "bwwwbwwwwwwwwwwwwww", "bbwbbwwwwwwwwwwwwww", "bbbbbrrrrrrrrrrrrrr", "bbbbbrrrrrrrrrrrrrr", "bbbbbrrrrrrrrrrrrrr", "bbbbbrrrrrrrrrrrrrr", "bbbbbrrrrrrrrrrrrrr"] },
  { pal: { y: GOLD, k: "#1a1a2e" }, rows: [ // smiley
    "....yyyyyyy....", "..yyyyyyyyyyy..", ".yyyyyyyyyyyyy.", "yyyykyyyyykyyyy", "yyyykyyyyykyyyy", "yyyyyyyyyyyyyyy", "yyyyyyyyyyyyyyy", "yykyyyyyyyyykyy", ".yykyyyyyyykyy.", "..yykkkkkkkyy..", "....yyyyyyy...."] },
];

const ICONS: Record<WeatherIcon, { rows: string[]; pal: Record<string, string> }> = {
  sun: { pal: { s: GOLD }, rows: ["s...s...s", ".s..s..s.", "..sssss..", "..sssss..", "sssssssss", "..sssss..", "..sssss..", ".s..s..s.", "s...s...s"] },
  cloud: { pal: { c: GREY }, rows: ["...ccc...", "..ccccc..", ".ccccccc.", "ccccccccc", "ccccccccc", ".ccccccc."] },
  rain: { pal: { c: GREY, b: CYAN }, rows: ["...ccc...", "..ccccc..", "ccccccccc", ".ccccccc.", ".b..b..b.", "b..b..b..", ".b..b..b."] },
  storm: { pal: { c: GREY, y: GOLD }, rows: ["...ccc...", "..ccccc..", "ccccccccc", ".ccccccc.", "....yy...", "...yy....", "..yyyy...", "....y...."] },
  snow: { pal: { c: GREY, w: WHITE }, rows: ["...ccc...", "..ccccc..", "ccccccccc", ".ccccccc.", ".w..w..w.", "w..w..w..", ".w..w..w."] },
  fog: { pal: { c: GREY }, rows: ["ccccccccc", ".........", ".ccccccc.", ".........", "ccccccccc", ".........", "..ccccc.."] },
};

function compose(live: OmniLive): Grid {
  const g: Grid = new Map();
  const ms = live.now.getTime();
  const slide = slideAt(ms, !!live.weather);
  if (slide === "graphics") {
    const i = Math.floor(live.t / 4) % GRAPHICS.length;
    const gr = GRAPHICS[i];
    const s = 2;
    const w = gr.rows[0].length * s, h = gr.rows.length * s;
    art(g, gr.rows, gr.pal, Math.floor((COLS - w) / 2), Math.floor((ROWS - h) / 2), s);
  } else if (slide === "message") {
    const text = live.message || "HELLO";
    const scale = 2, w = textWidth(text, scale);
    // scroll right → left at 10 cells/s, with a gap before it comes round again
    const period = w + COLS + 8;
    const off = Math.floor((live.t * 10) % period);
    letter(g, text, COLS - off, Math.floor((ROWS - 5 * scale) / 2), scale, WHITE);
  } else if (slide === "datetime") {
    const { display, meridiem } = formatClock(live.now, live.fmt);
    const tw = textWidth(display, 2);
    const mw = meridiem ? textWidth(meridiem, 1) + 2 : 0;
    const x0 = Math.floor((COLS - tw - mw) / 2);
    letter(g, display, x0, 6, 2, CYAN);
    if (meridiem) letter(g, meridiem, x0 + tw + 2, 11, 1, CYAN);
    const d = `${MONTHS[live.now.getMonth()]} ${live.now.getDate()}`;
    letter(g, d, Math.floor((COLS - textWidth(d, 1)) / 2), 22, 1, AMBER);
    const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][live.now.getDay()];
    letter(g, wd, Math.floor((COLS - textWidth(wd, 1)) / 2), 29, 1, AMBER);
  } else if (slide === "weather" && live.weather) {
    const w = live.weather;
    const ic = ICONS[w.icon];
    art(g, ic.rows, ic.pal, 3, 6, 1);
    const temp = `${w.tempF}F`;
    letter(g, temp, 16, 7, 2, AMBER);
    letter(g, w.label, Math.floor((COLS - textWidth(w.label, 1)) / 2), 24, 1, GREEN);
  }
  return g;
}

/** Draw the facade's slide over `box` (scene units) — the display area of the Omni sprite. */
export function drawOmniDisplay(ctx: CanvasRenderingContext2D, box: Box, live: OmniLive): void {
  const g = compose(live);
  const cw = box.w / COLS, ch = box.h / ROWS;
  ctx.save();
  // a faint overall glow when the panel is busy at night
  if (live.night && g.size > 0) {
    ctx.fillStyle = "rgba(255,200,120,0.05)";
    ctx.fillRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
  }
  const alpha = live.night ? 1 : 0.85;
  for (const [k, color] of g) {
    const x = box.x + (k % COLS) * cw, y = box.y + Math.floor(k / COLS) * ch;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = color;
    ctx.fillRect(x - cw * 0.25, y - ch * 0.25, cw * 1.5, ch * 1.5);
    ctx.globalAlpha = alpha;
    ctx.fillRect(x + cw * 0.1, y + ch * 0.1, cw * 0.8, ch * 0.8);
  }
  ctx.restore();
}
