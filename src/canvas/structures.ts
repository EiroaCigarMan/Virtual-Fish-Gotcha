/**
 * Every structure the fish can swim around. Each one draws itself procedurally on the
 * 160×144 scene, sits on the sand (y = 124) and carries the shared glowing clock panel
 * in its lower portion. `bounds` is what the fish AI uses to decide front/behind layering.
 */
import { CASTLE, drawCastle } from "./castle";
import { type Box, CLOCK_H, CLOCK_W, disc, drawClockPanel, drawMeridiemPip, rect } from "./clock";
import { drawText, textWidth } from "./pixelFont";
import type { StructureId, TimeFormat } from "../game/types";

export interface Structure {
  id: StructureId;
  /** Rectangle the fish treats as "the structure" for layer switching. */
  bounds: Box;
  /**
   * Open spaces inside the structure (an arch, a gap between stones) that the fish is
   * invited to swim through. Drawn "behind" the structure so the edges frame it.
   */
  passages?: Box[];
  draw(ctx: CanvasRenderingContext2D, now: Date, fmt: TimeFormat): void;
}

const SAND_Y = 124; // top row of the sand (structures stand on it)
const CX = 80;
const clockBox = (y: number, x = CX - CLOCK_W / 2): Box => ({ x, y, w: CLOCK_W, h: CLOCK_H });

// ---------------------------------------------------------------- Reunion Tower (Dallas)
const reunionTower: Structure = {
  id: "reunionTower",
  bounds: { x: 56, y: 42, w: 48, h: 82 },
  draw(ctx, now, fmt) {
    const C = {
      shaft: "#4a4640", shaftL: "#6e6a62", shaftD: "#2c2a26", band: "#5c5850",
      ball: "#1b2440", ballEdge: "#2c3a66", lamp: "#fff3c2", lampGold: "#ffd45a", lampDim: "#9a7a2a",
      base: "#3a3f55", baseL: "#6a7290", win: "#ffe9a8", winDim: "#8a7a50", glass: "#2a3550",
    };
    // low hotel/convention base — the clock lives in its facade
    rect(ctx, 56, 104, 48, SAND_Y - 104, C.base);
    rect(ctx, 56, 104, 48, 1, C.baseL);
    for (let x = 58; x < 102; x += 3) rect(ctx, x, 119, 2, 2, (x / 3) % 2 ? C.win : C.winDim); // lit windows
    rect(ctx, 58, 122, 44, 2, C.glass);
    // three slender columns, close together, with horizontal banding
    const cols = [76, 79, 82];
    const shaftTop = 56;
    for (const x of cols) {
      rect(ctx, x, shaftTop, 2, 104 - shaftTop, C.shaft);
      rect(ctx, x, shaftTop, 1, 104 - shaftTop, C.shaftL);
      for (let y = shaftTop + 3; y < 104; y += 4) rect(ctx, x, y, 2, 1, C.band);
    }
    rect(ctx, cols[2] + 1, shaftTop, 1, 104 - shaftTop, C.shaftD);
    // the ball: a dark sphere wrapped in a geodesic net of warm lamps
    const bx = CX, by = 54, r = 11;
    disc(ctx, bx, by, r, C.ball);
    disc(ctx, bx, by, r, C.ballEdge, (x, y) => Math.hypot(x - bx, y - by) > r - 1.2);
    // lamp net: a dense triangular lattice (3px pitch, every other row staggered) like the real geodesic frame
    const lattice = (x: number, y: number) => ((y - by) % 2 === 0 ? (x - bx + 300) % 3 === 0 : (x - bx + 301) % 3 === 0);
    disc(ctx, bx, by, r, C.lamp, (x, y) => lattice(x, y) && Math.hypot(x - bx, y - by) < r - 0.5);
    disc(ctx, bx, by, r, C.lampGold, (x, y) => lattice(x, y) && (x + y) % 2 === 1 && Math.hypot(x - bx, y - by) < r - 0.5);
    disc(ctx, bx, by, r, C.lampDim, (x, y) => !lattice(x, y) && (x + y) % 2 === 0 && Math.hypot(x - bx, y - by) < r - 2);
    // edge lamps so the silhouette sparkles
    disc(ctx, bx, by, r, C.lampGold, (x, y) => { const d = Math.hypot(x - bx, y - by); return d > r - 1.2 && (x + y) % 2 === 0; });
    // columns continue up into the lower part of the ball
    for (const x of cols) rect(ctx, x, by + 5, 2, r - 5, C.shaftD);
    rect(ctx, bx - 1, by - r - 3, 2, 3, C.shaftD); // mast
    const meridiem = drawClockPanel(ctx, clockBox(106), now, fmt, C.baseL);
    drawMeridiemPip(ctx, bx + r + 3, by - r, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Eiffel Tower (Paris)
const eiffelTower: Structure = {
  id: "eiffelTower",
  bounds: { x: 48, y: 40, w: 64, h: 84 },
  passages: [{ x: 64, y: 108, w: 32, h: 14 }], // the open arch between the legs
  draw(ctx, now, fmt) {
    const C = { iron: "#6b4a2a", ironL: "#9a6f42", ironD: "#3f2a16", deck: "#8a6a3a" };
    const top = 44, bottom = SAND_Y;
    const halfAt = (y: number) => {
      // bell-shaped taper: straight-ish up top, flaring at the legs
      const t = (y - top) / (bottom - top);
      return 1 + Math.round(31 * t * t * 0.55 + 31 * t * 0.45);
    };
    for (let y = top; y <= bottom; y++) {
      const hw = halfAt(y);
      const legW = y > 106 ? Math.max(3, Math.round(hw * 0.28)) : hw; // open arch between the legs
      const inArch = y > 106;
      // left + right edges
      rect(ctx, CX - hw, y, 1, 1, C.ironL);
      rect(ctx, CX + hw, y, 1, 1, C.ironD);
      if (inArch) {
        rect(ctx, CX - hw + 1, y, legW - 1, 1, C.iron);
        rect(ctx, CX + hw - legW + 1, y, legW - 1, 1, C.iron);
        continue;
      }
      // lattice interior: sparse X-braces
      for (let x = CX - hw + 1; x < CX + hw; x++) {
        const k = (x - CX + y) & 3, j = (x - CX - y) & 3;
        if (k === 0 || j === 0) rect(ctx, x, y, 1, 1, C.iron);
      }
    }
    // arch curve (underside of the first deck)
    for (let i = 0; i < 6; i++) rect(ctx, CX - 10 + i * 4, 107 + Math.abs(i - 2.5) * 1, 3, 1, C.iron);
    // decks
    const deck = (y: number, extra: number, h: number) => {
      const hw = halfAt(y) + extra;
      rect(ctx, CX - hw, y, hw * 2 + 1, h, C.deck);
      rect(ctx, CX - hw, y, hw * 2 + 1, 1, C.ironL);
    };
    deck(68, 2, 2);
    deck(86, 3, 2);
    deck(102, 3, 3);
    // apex
    rect(ctx, CX - 1, top - 4, 3, 4, C.iron);
    rect(ctx, CX, top - 7, 1, 3, C.ironD);
    // clock on the first-floor level, between the two lower decks
    const meridiem = drawClockPanel(ctx, clockBox(89), now, fmt, C.ironL);
    drawMeridiemPip(ctx, CX, top - 10, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Big Ben (London)
const bigBen: Structure = {
  id: "bigBen",
  bounds: { x: 44, y: 40, w: 70, h: 84 },
  draw(ctx, now, fmt) {
    const C = { stone: "#c9b58a", stoneL: "#e6d6ad", stoneD: "#8c7a55", roof: "#4b6b5a", roofD: "#2f4a3c", dial: "#f4ecd0", hand: "#1a1a2e", win: "#2a2340", gold: "#e2b24a" };
    // the Palace wing (clock panel lives here)
    rect(ctx, 44, 100, 56, SAND_Y - 100, C.stone);
    rect(ctx, 44, 100, 56, 1, C.stoneL);
    for (let x = 46; x < 98; x += 4) rect(ctx, x, 98, 2, 2, C.stone); // parapet
    for (let x = 48; x < 98; x += 8) { rect(ctx, x, 118, 2, 4, C.win); rect(ctx, x, 117, 2, 1, C.stoneD); }
    // the tower
    const tx = 98, tw = 16;
    rect(ctx, tx, 58, tw, SAND_Y - 58, C.stone);
    rect(ctx, tx, 58, 1, SAND_Y - 58, C.stoneL);
    rect(ctx, tx + tw - 1, 58, 1, SAND_Y - 58, C.stoneD);
    for (let y = 84; y < SAND_Y - 4; y += 8) rect(ctx, tx + 6, y, 4, 5, C.win); // lancet windows
    // belfry + spire
    rect(ctx, tx - 1, 56, tw + 2, 3, C.stoneD);
    for (let i = 0; i < 10; i++) rect(ctx, tx + 2 + Math.floor(i * 0.6), 56 - i, tw - 4 - Math.floor(i * 1.2), 1, i < 4 ? C.roof : C.roofD);
    rect(ctx, tx + tw / 2 - 1, 44, 2, 3, C.roofD);
    rect(ctx, tx + tw / 2 - 1, 42, 2, 2, C.gold);
    // the famous dial — live hands
    const cx = tx + tw / 2, cy = 70, r = 6;
    disc(ctx, cx, cy, r, C.gold);
    disc(ctx, cx, cy, r - 1, C.dial);
    const h = now.getHours() % 12, m = now.getMinutes();
    const hand = (ang: number, len: number) => {
      for (let i = 1; i <= len; i++) rect(ctx, Math.round(cx + Math.sin(ang) * i), Math.round(cy - Math.cos(ang) * i), 1, 1, C.hand);
    };
    hand(((h + m / 60) / 12) * Math.PI * 2, 3);
    hand((m / 60) * Math.PI * 2, 4);
    rect(ctx, cx, cy, 1, 1, C.hand);
    const meridiem = drawClockPanel(ctx, clockBox(104, 54), now, fmt, C.stoneD);
    drawMeridiemPip(ctx, cx, 38, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Parthenon (Athens)
const parthenon: Structure = {
  id: "parthenon",
  bounds: { x: 40, y: 76, w: 80, h: 48 },
  draw(ctx, now, fmt) {
    const C = { marble: "#e8e2d0", marbleD: "#b8b09a", marbleDD: "#8a8270", shade: "#5c5648", frieze: "#c9bfa6" };
    // three steps (stylobate)
    rect(ctx, 40, 120, 80, 4, C.marbleD);
    rect(ctx, 42, 118, 76, 2, C.marble);
    rect(ctx, 44, 116, 72, 2, C.marbleD);
    // dark cella behind the columns
    rect(ctx, 46, 100, 68, 16, C.shade);
    // 8 columns with capitals
    for (let i = 0; i < 8; i++) {
      const x = 46 + i * 9;
      rect(ctx, x, 100, 4, 16, C.marble);
      rect(ctx, x + 3, 100, 1, 16, C.marbleD); // fluting shade
      rect(ctx, x - 1, 99, 6, 2, C.marble); // capital
    }
    // entablature band with the clock
    rect(ctx, 42, 86, 76, 14, C.marble);
    rect(ctx, 42, 86, 76, 1, C.marbleD);
    rect(ctx, 42, 99, 76, 1, C.marbleDD);
    for (let x = 44; x < 62; x += 4) rect(ctx, x, 90, 2, 6, C.frieze); // metopes left
    for (let x = 100; x < 118; x += 4) rect(ctx, x, 90, 2, 6, C.frieze); // metopes right
    // pediment
    for (let i = 0; i < 10; i++) {
      const hw = 39 - i * 4;
      rect(ctx, CX - hw, 85 - i, hw * 2 + 1, 1, i === 9 ? C.marbleD : C.marble);
      rect(ctx, CX - hw, 85 - i, 1, 1, C.marbleD);
    }
    const meridiem = drawClockPanel(ctx, clockBox(87), now, fmt, C.marbleDD);
    drawMeridiemPip(ctx, CX, 72, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Stonehenge (Wiltshire)
const stonehenge: Structure = {
  id: "stonehenge",
  bounds: { x: 40, y: 78, w: 80, h: 46 },
  passages: [{ x: 65, y: 94, w: 30, h: 28 }], // between the two big uprights
  draw(ctx, now, fmt) {
    const C = { stone: "#8f8a7c", stoneL: "#b3ae9e", stoneD: "#5d594e", moss: "#5f7a45" };
    const upright = (x: number, top: number, w: number) => {
      rect(ctx, x, top, w, SAND_Y - top, C.stone);
      rect(ctx, x, top, 1, SAND_Y - top, C.stoneL);
      rect(ctx, x + w - 1, top, 1, SAND_Y - top, C.stoneD);
      rect(ctx, x + 1, SAND_Y - 2, w - 2, 1, C.moss);
    };
    const lintel = (x: number, y: number, w: number, h: number) => {
      rect(ctx, x, y, w, h, C.stone);
      rect(ctx, x, y, w, 1, C.stoneL);
      rect(ctx, x, y + h - 1, w, 1, C.stoneD);
    };
    // outer ring (smaller, further "back")
    upright(42, 104, 5); upright(51, 102, 5); lintel(41, 100, 16, 3);
    upright(113, 102, 5); upright(120, 104, 5); lintel(112, 100, 14, 3);
    // fallen stone
    rect(ctx, 104, 120, 10, 3, C.stoneD); rect(ctx, 104, 120, 10, 1, C.stone);
    // central trilithon — wide open underneath; the clock is carved into a deep lintel
    upright(56, 92, 8); upright(96, 92, 8);
    lintel(54, 78, 52, 15);
    const meridiem = drawClockPanel(ctx, clockBox(80), now, fmt, C.stoneD);
    drawMeridiemPip(ctx, CX, 74, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Pineapple (Bikini Bottom)
const pineapple: Structure = {
  id: "pineapple",
  bounds: { x: 56, y: 56, w: 48, h: 68 },
  draw(ctx, now, fmt) {
    const C = { skin: "#e8a030", skinL: "#f8c860", skinD: "#b87418", leaf: "#3f9a4a", leafL: "#6cc46e", leafD: "#2a6b33", door: "#3a5a9a", doorD: "#23407a", win: "#9ad8f0", winD: "#4a8ab0", wood: "#8a5a2a" };
    // body: ellipse rx 22, ry 22, centred (80, 104) — clipped at the sand
    const cx = CX, cy = 102, rx = 22, ry = 24;
    for (let y = cy - ry; y <= SAND_Y; y++) {
      const t = (y - cy) / ry;
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      if (hw <= 0) continue;
      for (let x = cx - hw; x <= cx + hw; x++) {
        const diag = (x + y) % 6 === 0 || (x - y + 600) % 6 === 0;
        rect(ctx, x, y, 1, 1, diag ? C.skinD : x < cx - hw + 3 ? C.skinL : C.skin);
      }
    }
    // leaves: a crown of spikes
    const leaf = (x0: number, h: number, lean: number, col: string) => {
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round(3 - (i / h) * 2.5));
        rect(ctx, x0 + Math.round(lean * (i / h)) - Math.floor(w / 2), 80 - i, w, 1, col);
      }
    };
    leaf(66, 14, -6, C.leafD); leaf(94, 14, 6, C.leafD);
    leaf(71, 20, -4, C.leaf); leaf(89, 20, 4, C.leaf);
    leaf(76, 24, -1, C.leafL); leaf(84, 24, 1, C.leafL);
    leaf(80, 26, 0, C.leaf);
    // door
    rect(ctx, 76, 112, 8, SAND_Y - 112, C.door);
    rect(ctx, 77, 111, 6, 1, C.door); rect(ctx, 78, 110, 4, 1, C.door);
    rect(ctx, 76, 112, 1, 12, C.doorD); rect(ctx, 82, 116, 1, 1, C.skinL); // knob
    rect(ctx, 78, 113, 4, 3, C.win);
    // porthole windows
    for (const wx of [67, 93]) { disc(ctx, wx, 90, 4, C.wood); disc(ctx, wx, 90, 3, C.winD); disc(ctx, wx, 90, 2, C.win); rect(ctx, wx - 1, 88, 1, 1, "#ffffff"); }
    const meridiem = drawClockPanel(ctx, clockBox(97), now, fmt, C.wood);
    drawMeridiemPip(ctx, 80, 50, meridiem, "#1c1730");
  },
};

// ---------------------------------------------------------------- Dallas City Hall (Dallas)
/**
 * I.M. Pei's inverted pyramid, seen head-on from the plaza: the facade leans out 1px every
 * 4 rows, so each floor overhangs the one below and the whole thing is widest at the roof.
 * A picket sign is planted in the plaza to the right, deliberately clear of the clock panel.
 */
const dallasCityHall: Structure = {
  id: "dallasCityHall",
  // the pyramid (42..118 at the roof) plus the sign standing in the plaza beside it
  bounds: { x: 42, y: 52, w: 81, h: 72 },
  draw(ctx, now, fmt) {
    const C = {
      conc: "#b9b3a6", concL: "#dcd6c8", concD: "#8b8579", soffit: "#6d6862",
      glass: "#2b3a4e", glassL: "#40587a", mull: "#9a9488",
      post: "#8a5a2a", postD: "#5e3c1a", board: "#f2e8d5", boardD: "#c0b295", ink: "#8f1d1d",
    };
    const TOP = 52;
    const hwAt = (y: number) => 20 + Math.round((SAND_Y - y) / 4);
    // the leaning facade, row by row
    for (let y = TOP; y < SAND_Y; y++) {
      const hw = hwAt(y);
      rect(ctx, CX - hw, y, hw * 2 + 1, 1, C.conc);
      rect(ctx, CX - hw, y, 1, 1, C.concL);
      rect(ctx, CX + hw, y, 1, 1, C.concD);
    }
    rect(ctx, CX - hwAt(TOP), TOP, hwAt(TOP) * 2 + 1, 1, C.concL); // roof parapet, catching the light
    // six recessed window bands; the solid 6px end wedges are Pei's blank side walls
    for (let i = 0; i < 6; i++) {
      const by = TOP + 3 + i * 10;
      const band = (y: number, c: string) => { const hw = hwAt(y) - 6; rect(ctx, CX - hw, y, hw * 2 + 1, 1, c); };
      band(by - 1, C.soffit); // deep reveal under the overhang above
      for (let y = by; y < by + 4; y++) band(y, y === by ? C.glassL : C.glass);
      band(by + 4, C.concL); // sill
      const mh = hwAt(by + 2) - 6;
      for (let x = CX - mh + 2; x < CX + mh; x += 5) rect(ctx, x, by, 1, 4, C.mull);
    }
    // plaza level: recessed lobby glass behind three fat concrete columns
    for (let y = 112; y < SAND_Y; y++) { const hw = hwAt(y) - 4; rect(ctx, CX - hw, y, hw * 2 + 1, 1, C.glass); }
    for (const px of [62, 79, 96]) {
      rect(ctx, px, 108, 5, SAND_Y - 108, C.conc);
      rect(ctx, px, 108, 1, SAND_Y - 108, C.concL);
      rect(ctx, px + 4, 108, 1, SAND_Y - 108, C.concD);
      rect(ctx, px - 1, 108, 7, 1, C.concD);
    }
    // the sign: post first, then the board, then four centred lines of 3x5 type
    const S = { x: 97, y: 88, w: 27, h: 27 };
    const postY = S.y + S.h;
    rect(ctx, 109, postY, 3, SAND_Y - postY, C.post);
    rect(ctx, 111, postY, 1, SAND_Y - postY, C.postD);
    rect(ctx, S.x, S.y, S.w, S.h, C.boardD);
    rect(ctx, S.x + 1, S.y + 1, S.w - 2, S.h - 2, C.board);
    ["SAVE", "DALLAS", "CITY", "HALL!"].forEach((line, i) => {
      const w = textWidth(line, 1);
      drawText(ctx, line, S.x + 1 + Math.floor((S.w - 2 - w) / 2), S.y + 2 + i * 6, 1, C.ink);
    });
    // clock sits in the fifth-floor band, nudged left so the sign never covers it
    const meridiem = drawClockPanel(ctx, clockBox(92, 58), now, fmt, C.concD);
    rect(ctx, CX, 48, 1, 4, C.concD); // rooftop mast
    drawMeridiemPip(ctx, CX, 46, meridiem, "#1c1730");
  },
};

const castle: Structure = {
  id: "castle",
  // body + both towers (towers stick out 6px each side and rise 8px above the body)
  bounds: { x: CASTLE.x - 6, y: CASTLE.y - 8, w: CASTLE.w + 12, h: CASTLE.h + 8 },
  draw: drawCastle,
};

export const STRUCTURE_REGISTRY: Record<StructureId, Structure> = {
  castle, reunionTower, eiffelTower, bigBen, parthenon, stonehenge, pineapple, dallasCityHall,
};
