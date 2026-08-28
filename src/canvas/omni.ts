/**
 * The Omni's LED facade. The whole front of the hotel is a field of cells (one per logical
 * unit, 84×32 on the current sprite) laid out as horizontal floor strips, like the real
 * building's LED bands. Slides are composed into the grid (pixel graphics, a scrolling message,
 * the date/time, the weather) and every lit cell is drawn as a short glowing strip segment.
 * Which slide is up comes from game/omni.ts (wall-clock aligned, 15 minutes each).
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

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface Grid { cols: number; rows: number; cells: Map<number, string> } // cell index → colour

function plot(g: Grid, x: number, y: number, c: string) {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
  g.cells.set(y * g.cols + x, c);
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

function compose(live: OmniLive, cols: number, rows: number): Grid {
  const g: Grid = { cols, rows, cells: new Map() };
  const COLS = cols, ROWS = rows;
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
    const scale = 3, w = textWidth(text, scale, 2);
    // short messages sit still, centred; longer ones scroll right → left at 14 cells/s
    if (w <= COLS - 4) letter(g, text, Math.floor((COLS - w) / 2), Math.floor((ROWS - 5 * scale) / 2), scale, WHITE, 2);
    else {
      const period = w + COLS + 10;
      const off = Math.floor((live.t * 14) % period);
      letter(g, text, COLS - off, Math.floor((ROWS - 5 * scale) / 2), scale, WHITE, 2);
    }
  } else if (slide === "datetime") {
    const { display, meridiem } = formatClock(live.now, live.fmt);
    const tw = textWidth(display, 3, 2);
    const mw = meridiem ? textWidth(meridiem, 2) + 3 : 0;
    const x0 = Math.floor((COLS - tw - mw) / 2);
    letter(g, display, x0, 3, 3, CYAN, 2);
    if (meridiem) letter(g, meridiem, x0 + tw + 3, 8, 2, CYAN);
    const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][live.now.getDay()];
    const d = `${wd} ${MONTHS[live.now.getMonth()]} ${live.now.getDate()}`;
    letter(g, d, Math.floor((COLS - textWidth(d, 2)) / 2), 21, 2, AMBER);
  } else if (slide === "weather" && live.weather) {
    const w = live.weather;
    const ic = ICONS[w.icon];
    const temp = `${w.tempF}F`;
    const tw = textWidth(temp, 3, 2);
    const iconW = ic.rows[0].length * 2;
    const x0 = Math.floor((COLS - (iconW + 4 + tw)) / 2);
    art(g, ic.rows, ic.pal, x0, 3, 2);
    letter(g, temp, x0 + iconW + 4, 3, 3, AMBER, 2);
    letter(g, w.label, Math.floor((COLS - textWidth(w.label, 2)) / 2), 22, 2, GREEN);
  }
  return g;
}

/** Draw the facade's slide over `box` (scene units) — the display area of the Omni sprite. */
export function drawOmniDisplay(ctx: CanvasRenderingContext2D, box: Box, live: OmniLive): void {
  const cols = Math.round(box.w), rows = Math.round(box.h);
  const g = compose(live, cols, rows);
  const cw = box.w / cols, ch = box.h / rows;
  ctx.save();
  // a faint overall glow when the facade is busy at night
  if (live.night && g.cells.size > 0) {
    ctx.fillStyle = "rgba(255,200,120,0.05)";
    ctx.fillRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
  }
  const alpha = live.night ? 1 : 0.85;
  // each lit cell is a short segment of a floor strip: full width, a little over half the row height
  for (const [k, color] of g.cells) {
    const x = box.x + (k % cols) * cw, y = box.y + Math.floor(k / cols) * ch;
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = color;
    ctx.fillRect(x - cw * 0.15, y + ch * 0.05, cw * 1.3, ch * 0.9);
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y + ch * 0.22, cw, ch * 0.56);
  }
  ctx.restore();
}
