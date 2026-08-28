import { type Atlas, FISH, PX, STRUCTURE_SHEET_SIZE, makeNightSheet } from "./atlas";
import { FishPainter } from "./fish";
import { browserPlatform, type Platform } from "./platform";
import { STRUCTURE_REGISTRY, drawStructure } from "./structures";
import { TANK_GEOMS, type TankGeom } from "./tank";
import { SPECIES_FLAVOR } from "../game/catalog";
import { isNight } from "../game/solar";
import type { FishMood, SpeciesId, StructureId, TankShape, TimeFormat } from "../game/types";

/** Logical scene size. Everything below reasons in these units; the canvas is PX× bigger. */
export const W = 160;
export const H = 144;
export { PX };

const ROOM = "#1c1730";

type Layer = "behind" | "front";

interface Fish {
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number;
  facing: 1 | -1;
  layer: Layer;
  retargetIn: number;
  bob: number;
  frameT: number;
  dashUntil: number;
  /** Schooling: followers keep this offset from the leader (fish[0]). */
  ox: number; oy: number;
}
interface Bubble { x: number; y: number; r: number; vy: number; wob: number }
interface Pellet { x: number; y: number; vy: number; ttl: number }
interface Particle { x: number; y: number; vx: number; vy: number; ttl: number; c: string }

export interface EngineInputs {
  mood: FishMood;
  cleanliness: number;
  happiness: number;
  timeFormat: TimeFormat;
  structure: StructureId;
  species: SpeciesId;
  tank: TankShape;
}

const SPEED: Record<FishMood, number> = { content: 14, hungry: 12, bored: 8, dirty: 9, sad: 5, sleepy: 7 };

// Seeded PRNG for deterministic gravel.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class FishEngine {
  private ctx: CanvasRenderingContext2D;
  private platform: Platform;
  private atlas: Atlas | null = null;
  private painter: FishPainter;
  private raf = 0;
  private last = 0;
  private t = 0; // seconds since start
  private inputs: EngineInputs = { mood: "content", cleanliness: 100, happiness: 100, timeFormat: "12h", structure: "castle", species: "goldfish", tank: "bowl" };
  /** fish[0] is the leader (runs the AI); the rest school behind it. */
  private fishes: Fish[] = [];
  private get fish(): Fish { return this.fishes[0]; }
  private bubbles: Bubble[] = [];
  private pellets: Pellet[] = [];
  private particles: Particle[] = [];
  private nextBubble = 1;
  private gravel: { x: number; y: number; rx: number; ry: number; c: string }[] = [];
  private dirtSpecks: { x: number; y: number; ph: number }[] = [];
  private cleanFlash = 0;
  /** 1 = a painted structure pixel (logical grid). Built per structure from the baked sprite. */
  private mask = new Uint8Array(W * H);
  private maskFor: StructureId | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private geom: TankGeom = TANK_GEOMS.bowl;
  /** Wall clock — injectable so headless renders can pin a time (and a day/night). */
  private clock: () => Date;
  private night = false;

  constructor(canvas: HTMLCanvasElement, platform: Platform = browserPlatform, clock: () => Date = () => new Date()) {
    canvas.width = W * PX; canvas.height = H * PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.platform = platform;
    this.clock = clock;
    this.painter = new FishPainter(platform);
    this.spawnSchool(this.inputs.species);
    this.seedFloor();
  }

  /** Deterministic pebbles + dirt specks for the current tank (re-seeded when the tank changes). */
  private seedFloor() {
    const G = this.geom;
    const rnd = mulberry32(1337);
    this.gravel = [];
    this.dirtSpecks = [];
    for (let i = 0; i < (G.shape === "bowl" ? 70 : 110); i++) {
      const y = G.sandY + 1.5 + rnd() * (G.floorY - G.sandY - 4);
      const hw = G.halfW(y) - 3;
      if (hw <= 0) continue;
      const x = G.cx - hw + rnd() * hw * 2;
      this.gravel.push({ x, y, rx: 0.9 + rnd() * 0.9, ry: 0.6 + rnd() * 0.5, c: ["#c9a46a", "#a67c4e", "#e0c085", "#8f6a45", "#d9b98a"][Math.floor(rnd() * 5)] });
    }
    for (let i = 0; i < 40; i++) {
      this.dirtSpecks.push({ x: rnd() * W, y: G.waterY + rnd() * (G.sandY - G.waterY), ph: rnd() * 6.28 });
    }
  }

  /** Sprite sheets arrive asynchronously; until then the bowl renders empty. */
  setAtlas(atlas: Atlas) {
    this.atlas = { ...atlas, structuresNight: makeNightSheet(this.platform, atlas.structures, STRUCTURE_SHEET_SIZE.w, STRUCTURE_SHEET_SIZE.h) };
    this.maskFor = null;
  }

  setInputs(i: EngineInputs) {
    const speciesChanged = i.species !== this.inputs.species;
    const tankChanged = i.tank !== this.geom.shape;
    this.inputs = i;
    if (tankChanged) { this.geom = TANK_GEOMS[i.tank]; this.seedFloor(); this.fish.retargetIn = 0; }
    if (speciesChanged) this.spawnSchool(i.species);
    if (this.maskFor !== i.structure) this.buildMask(i.structure);
  }

  /**
   * Render the structure alone (offscreen, at full resolution) and keep a logical-resolution
   * occupancy mask: a logical cell counts as painted if any of its PX×PX pixels is.
   */
  private buildMask(id: StructureId) {
    if (!this.atlas) return;
    if (!this.scratch) this.scratch = this.platform.createCanvas(W * PX, H * PX);
    const ctx = this.scratch.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W * PX, H * PX);
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    drawStructure(ctx, this.atlas, id, this.clock(), this.inputs.timeFormat);
    const data = ctx.getImageData(0, 0, W * PX, H * PX).data;
    this.mask.fill(0);
    for (let py = 0; py < H * PX; py++) {
      const ly = (py / PX) | 0;
      for (let px = 0; px < W * PX; px++) {
        if (data[(py * W * PX + px) * 4 + 3] > 40) this.mask[ly * W + ((px / PX) | 0)] = 1;
      }
    }
    this.maskFor = id;
  }

  /** (Re)create the fish for a species — one leader plus followers if it schools. */
  private spawnSchool(species: SpeciesId) {
    const n = SPECIES_FLAVOR[species].school;
    const mk = (ox: number, oy: number): Fish => ({
      x: 50 + ox, y: 70 + oy, vx: 0, vy: 0, tx: 100, ty: 60, facing: 1, layer: "front",
      retargetIn: 2, bob: rand(0, 6.28), frameT: rand(0, 2), dashUntil: 0, ox, oy,
    });
    this.fishes = [mk(0, 0)];
    for (let i = 1; i < n; i++) {
      const ang = (i / (n - 1)) * Math.PI * 2;
      this.fishes.push(mk(Math.round(-6 - Math.cos(ang) * 7 - i * 2), Math.round(Math.sin(ang) * 6)));
    }
  }

  private get sprite() { return FISH[this.inputs.species]; }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }

  // ---------- events from React ----------
  feed() {
    const G = this.geom;
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const y = G.waterY + 1;
      const hw = G.halfW(y) - 6;
      this.pellets.push({ x: G.cx + rand(-hw, hw), y: y - rand(0, 3), vy: rand(9, 16), ttl: 12 });
    }
  }
  play() {
    for (const f of this.fishes) f.dashUntil = this.t + 4.5;
    this.fish.retargetIn = 0;
    for (let i = 0; i < 6; i++) this.spawnBubble(this.fish.x + rand(-4, 4), this.fish.y);
  }
  clean() {
    const G = this.geom;
    this.cleanFlash = 1;
    for (let i = 0; i < 40; i++) {
      const y = rand(G.waterY + 2, G.sandY - 2);
      const hw = G.halfW(y) - 3;
      this.particles.push({ x: G.cx + rand(-hw, hw), y, vx: rand(-3, 3), vy: rand(-12, -4), ttl: rand(0.6, 1.4), c: "#e8fbff" });
    }
  }

  private spawnBubble(x: number, y: number) {
    this.bubbles.push({ x, y, r: Math.random() < 0.3 ? 1.6 : 0.9, vy: rand(10, 18), wob: rand(0, 6.28) });
  }

  // ---------- simulation (unchanged from the pixel engine) ----------
  private inWater(x: number, y: number, margin: number): boolean {
    const G = this.geom;
    if (y < G.waterY + margin || y > G.sandY - margin) return false;
    const hw = G.halfW(y) - margin;
    return Math.abs(x - G.cx) <= hw;
  }
  private randomTarget(): [number, number] {
    const G = this.geom;
    for (let i = 0; i < 20; i++) {
      const y = rand(G.waterY + 8, G.sandY - 8);
      const hw = G.halfW(y) - 12;
      const x = G.cx + rand(-hw, hw);
      if (this.inWater(x, y, 10)) return [x, y];
    }
    return [G.cx, (G.waterY + G.sandY) / 2];
  }
  /** True if any fish in the school sits over a painted structure pixel (so a layer flip never pops). */
  private overlapsStructure(): boolean {
    if (this.maskFor !== this.inputs.structure) this.buildMask(this.inputs.structure);
    const [fw, fh] = this.sprite.hit;
    return this.fishes.some((f) => {
      const x0 = Math.max(0, Math.floor(f.x - fw / 2) - 1), x1 = Math.min(W - 1, Math.ceil(f.x + fw / 2) + 1);
      const y0 = Math.max(0, Math.floor(f.y - fh / 2) - 2), y1 = Math.min(H - 1, Math.ceil(f.y + fh / 2) + 2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.mask[y * W + x]) return true;
      return false;
    });
  }

  private update(dt: number) {
    const G = this.geom;
    const f = this.fish;
    const mood = this.inputs.mood;
    const dashing = this.t < f.dashUntil;
    const speed = (dashing ? 34 : SPEED[mood]) * SPECIES_FLAVOR[this.inputs.species].speed;

    // Hungry fish chases pellets.
    let target: [number, number] | null = null;
    if (this.pellets.length && (mood === "hungry" || mood === "sad" || Math.random() < 0.9)) {
      let best: Pellet | null = null, bd = Infinity;
      for (const p of this.pellets) {
        const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (best) target = [best.x, best.y];
    }
    if (target) { f.tx = target[0]; f.ty = target[1]; }
    else {
      f.retargetIn -= dt;
      const arrived = Math.hypot(f.tx - f.x, f.ty - f.y) < 4;
      if (f.retargetIn <= 0 || arrived) {
        const clear = !this.overlapsStructure();
        const passages = STRUCTURE_REGISTRY[this.inputs.structure].passages;
        const [fw, fh] = this.sprite.hit;
        // Open structures: about a third of the time, swim through an opening (always drawn behind
        // the structure so its edges frame the fish). Only when the school is clear or already behind, so it never pops.
        const allBehind = this.fishes.every((s) => s.layer === "behind");
        const through = passages?.length && (clear || allBehind) && !dashing && Math.random() < 0.35
          ? passages[Math.floor(Math.random() * passages.length)] : null;
        if (through && through.w >= fw && through.h >= fh) {
          f.tx = rand(through.x + fw / 2, through.x + through.w - fw / 2);
          f.ty = rand(through.y + fh / 2, through.y + through.h - fh / 2);
          f.retargetIn = rand(3, 6);
          for (const s of this.fishes) s.layer = "behind";
        } else {
          [f.tx, f.ty] = this.randomTarget();
          f.retargetIn = dashing ? rand(0.6, 1.2) : rand(2.5, 6);
          if (clear) for (const s of this.fishes) s.layer = Math.random() < 0.45 ? "behind" : "front";
        }
      }
    }
    // Followers aim at their slot beside the leader (with a little wobble so the school breathes).
    for (let i = 1; i < this.fishes.length; i++) {
      const s = this.fishes[i];
      s.tx = f.x + s.ox * (f.facing === 1 ? 1 : -1) + Math.sin(this.t * 1.3 + i) * 2;
      s.ty = f.y + s.oy + Math.cos(this.t * 1.1 + i * 2) * 2;
    }
    // Steering (every fish)
    for (const s of this.fishes) {
      const dx = s.tx - s.x, dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = s === f ? speed : Math.min(speed * 1.4, speed * 0.5 + dist * 1.2);
      const ax = (dx / dist) * sp, ay = (dy / dist) * sp;
      const ease = dashing ? 6 : 2.2;
      s.vx += (ax - s.vx) * Math.min(1, ease * dt);
      s.vy += (ay - s.vy) * Math.min(1, ease * dt);
      if (mood === "sad" || mood === "sleepy") s.vy += 3 * dt; // gentle sink
      let nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      if (!this.inWater(nx, ny, 8)) { // bounce back toward center
        s.vx *= -0.5; s.vy *= -0.5;
        nx = s.x + (G.cx - s.x) * 0.02; ny = s.y + ((G.waterY + G.sandY) / 2 - s.y) * 0.02;
        s.retargetIn = 0;
      }
      s.x = nx; s.y = ny;
      if (Math.abs(s.vx) > 1.5) s.facing = s.vx > 0 ? 1 : -1;
      s.bob += dt * (mood === "sad" ? 1.2 : 2.5);
      s.frameT += dt * (dashing ? 14 : mood === "sad" ? 3 : 7);
    }

    // Eat pellets (any fish in the school can eat)
    this.pellets = this.pellets.filter((p) => {
      p.y += p.vy * dt; p.ttl -= dt;
      p.vy = Math.max(6, p.vy - 4 * dt);
      const eater = this.fishes.find((s) => Math.abs(p.x - s.x) < 7 && Math.abs(p.y - s.y) < 6);
      if (eater) this.spawnBubble(eater.x + eater.facing * 6, eater.y - 2);
      return !eater && p.ttl > 0 && p.y < G.sandY - 1;
    });

    // Bubbles
    this.nextBubble -= dt;
    if (this.nextBubble <= 0) {
      const happy = this.inputs.happiness / 100;
      this.nextBubble = rand(1.2, 4) * (1.6 - happy);
      const y = G.sandY - 2;
      const hw = G.halfW(y) - 6;
      this.spawnBubble(G.cx + rand(-hw, hw), y);
    }
    this.bubbles = this.bubbles.filter((b) => {
      b.y -= b.vy * dt; b.wob += dt * 4;
      b.x += Math.sin(b.wob) * 4 * dt;
      return b.y > G.waterY + 1;
    });
    // Particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
      return p.ttl > 0;
    });
    this.cleanFlash = Math.max(0, this.cleanFlash - dt * 1.2);
  }

  // ---------- rendering ----------
  private render() {
    const ctx = this.ctx;
    const G = this.geom;
    const dirt = 1 - this.inputs.cleanliness / 100; // 0 clean … 1 filthy
    const now = this.clock();
    this.night = isNight(now.getTime());
    const night = this.night;
    const mixc = (day: [number, number, number], dark: [number, number, number], k = 1) => `rgb(${Math.round(day[0] + (dark[0] - day[0]) * k)},${Math.round(day[1] + (dark[1] - day[1]) * k)},${Math.round(day[2] + (dark[2] - day[2]) * k)})`;
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // room: a dim vertical gradient with a soft pool of light behind the tank
    const room = ctx.createLinearGradient(0, 0, 0, H);
    room.addColorStop(0, night ? "#100c22" : "#241d3d"); room.addColorStop(1, night ? "#07060f" : "#120e20");
    ctx.fillStyle = room; ctx.fillRect(0, 0, W, H);
    const midY = (G.rimY + G.floorY) / 2;
    const pool = ctx.createRadialGradient(G.cx, midY - 10, 10, G.cx, midY, 90);
    pool.addColorStop(0, night ? "rgba(90,110,200,0.10)" : "rgba(120,110,190,0.18)"); pool.addColorStop(1, "rgba(120,110,190,0)");
    ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H);
    // table: wood with a lit front edge
    const tableY = G.tableY;
    const wood = ctx.createLinearGradient(0, tableY, 0, H);
    wood.addColorStop(0, night ? "#2e2020" : "#5a3f3a"); wood.addColorStop(0.15, night ? "#1f1615" : "#3f2c2a"); wood.addColorStop(1, night ? "#140d0d" : "#2a1c1c");
    ctx.fillStyle = wood; ctx.fillRect(0, tableY, W, H - tableY);
    ctx.fillStyle = "rgba(255,220,200,0.18)"; ctx.fillRect(0, tableY, W, 0.8);
    // tank shadow on the table
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(G.cx, tableY + 2.5, G.halfW(G.sandY) * 0.95, 3, 0, 0, Math.PI * 2); ctx.fill();

    // ---- inside the glass ----
    const airColor = night ? "#171331" : "#2d2749";
    ctx.save();
    G.clipInterior(ctx);
    // air
    const air = ctx.createLinearGradient(0, G.rimY, 0, G.waterY);
    air.addColorStop(0, airColor); air.addColorStop(1, night ? "#100d22" : "#231e3a");
    ctx.fillStyle = air; ctx.fillRect(0, 0, W, G.waterY);
    // water: depth gradient, tinted by dirt
    const wg = ctx.createLinearGradient(0, G.waterY, 0, G.sandY);
    const c = (depth: number) => mixc([40 + 40 * dirt + depth * 10, 125 - depth * 30 + 40 * dirt, 205 - depth * 60 - 110 * dirt], [12 + 20 * dirt + depth * 4, 30 - depth * 8 + 25 * dirt, 78 - depth * 26 - 40 * dirt], night ? 1 : 0);
    wg.addColorStop(0, c(0)); wg.addColorStop(1, c(1));
    ctx.fillStyle = wg; ctx.fillRect(0, G.waterY, W, G.sandY - G.waterY);
    // caustic light bands drifting through the water
    ctx.globalAlpha = (night ? 0.05 : 0.09) * (1 - dirt * 0.7);
    ctx.fillStyle = night ? "#b9c8ff" : "#dff6ff";
    for (let i = 0; i < 3; i++) {
      const x = G.cx + Math.sin(this.t * 0.35 + i * 2.1) * 30 + (i - 1) * 22;
      ctx.beginPath(); ctx.ellipse(x, G.waterY + 30 + i * 8, 7 + i * 2, 34, 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // sand
    const sg = ctx.createLinearGradient(0, G.sandY, 0, G.floorY);
    sg.addColorStop(0, night ? "#6a5c48" : "#e2c48a"); sg.addColorStop(0.4, night ? "#5a4c3a" : "#d2ac6c"); sg.addColorStop(1, night ? "#3e3226" : "#a87c48");
    ctx.fillStyle = sg; ctx.fillRect(0, G.sandY, W, G.floorY - G.sandY);
    ctx.fillStyle = night ? "rgba(200,210,255,0.25)" : "rgba(255,240,200,0.5)"; ctx.fillRect(0, G.sandY, W, 0.7);
    if (night) ctx.globalAlpha = 0.5;
    for (const g of this.gravel) {
      ctx.fillStyle = g.c; ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.beginPath(); ctx.ellipse(g.x - g.rx * 0.3, g.y - g.ry * 0.35, g.rx * 0.4, g.ry * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // water surface: a gentle wave with a bright meniscus
    ctx.beginPath();
    ctx.moveTo(0, G.waterY);
    for (let x = 0; x <= W; x += 2) ctx.lineTo(x, G.waterY + Math.sin(x * 0.18 + this.t * 2.2) * 0.45);
    ctx.lineTo(W, G.waterY - 4); ctx.lineTo(0, G.waterY - 4); ctx.closePath();
    ctx.fillStyle = air; ctx.fill();
    ctx.strokeStyle = night ? "rgba(190,205,255,0.55)" : "rgba(220,245,255,0.85)"; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) { const y = G.waterY + Math.sin(x * 0.18 + this.t * 2.2) * 0.45; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 4; i++) { const x = G.cx - 40 + ((i * 23 + this.t * 6) % 80); ctx.beginPath(); ctx.ellipse(x, G.waterY + 1.2, 2.5, 0.5, 0, 0, Math.PI * 2); ctx.fill(); }

    // plants (behind)
    const pd = night ? "#183a2a" : "#2f8f4f", pl = night ? "#2a5a3c" : "#5cc47a", pd2 = night ? "#143324" : "#2a7a45", pl2 = night ? "#255238" : "#4fb56b";
    this.plant(45, G.sandY, 22, pd, pl, 0);
    this.plant(114, G.sandY, 24, pd2, pl2, 1.3);
    if (G.shape === "square") { this.plant(24, G.sandY, 18, pd2, pl, 0.7); this.plant(136, G.sandY, 20, pd, pl2, 1.9); }

    if (this.atlas) {
      const atlas = this.atlas;
      for (const s of this.fishes) if (s.layer === "behind") this.drawFish(atlas, s);
      drawStructure(ctx, atlas, this.inputs.structure, now, this.inputs.timeFormat, ROOM, night, this.t);
      for (const s of this.fishes) if (s.layer === "front") this.drawFish(atlas, s);
    }

    // pellets
    for (const p of this.pellets) {
      ctx.fillStyle = "#a86a30"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.9, 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,220,170,0.6)"; ctx.beginPath(); ctx.arc(p.x - 0.25, p.y - 0.25, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // bubbles: a thin ring with a highlight
    for (const b of this.bubbles) {
      ctx.strokeStyle = "rgba(225,246,255,0.8)"; ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // front plant
    this.plant(104, G.sandY + 3, 12, night ? "#1c4530" : "#3a9c58", night ? "#2f6a46" : "#7ee39a", 2.1);

    // dirt specks (only when quite dirty)
    if (dirt > 0.6) {
      const n = Math.floor((dirt - 0.6) / 0.4 * this.dirtSpecks.length);
      ctx.fillStyle = "rgba(90,110,40,0.8)";
      for (let i = 0; i < n; i++) {
        const s = this.dirtSpecks[i];
        const x = s.x + Math.sin(this.t * 0.7 + s.ph) * 3, y = s.y + Math.cos(this.t * 0.5 + s.ph) * 2;
        if (this.inWater(x, y, 3)) { ctx.beginPath(); ctx.arc(x, y, 0.55, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // clean sparkles
    for (const p of this.particles) {
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 0.5 + p.ttl * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    if (this.cleanFlash > 0) {
      ctx.fillStyle = `rgba(230,255,255,${(this.cleanFlash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, G.waterY, W, G.sandY - G.waterY);
    }
    ctx.restore();

    // ---- the glass ----
    G.drawGlass(ctx, airColor);
  }

  private plant(x: number, baseY: number, h: number, dark: string, light: string, phase: number) {
    const ctx = this.ctx;
    // stem: a swaying curve, with leaves budding off alternately
    const sway = (i: number) => Math.sin(this.t * 1.5 + phase + i * 0.25) * (i / h) * 2.2;
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, baseY);
    for (let i = 1; i <= h; i++) ctx.lineTo(x + sway(i), baseY - i);
    ctx.stroke();
    for (let i = 4; i < h - 1; i += 3) {
      const side = (i / 3) % 2 === 0 ? -1 : 1;
      const sx = x + sway(i), sy = baseY - i;
      const g = ctx.createLinearGradient(sx, sy, sx + side * 4, sy - 2);
      g.addColorStop(0, dark); g.addColorStop(1, light);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + side * 2.6, sy - 2.6, sx + side * 4.4, sy - 1.6);
      ctx.quadraticCurveTo(sx + side * 2.4, sy - 0.2, sx, sy + 0.6);
      ctx.closePath(); ctx.fill();
    }
  }

  private drawFish(atlas: Atlas, f: Fish) {
    const bob = Math.sin(f.bob) * 1.2;
    this.painter.draw(this.ctx, atlas, this.inputs.species, this.inputs.mood, f.x, f.y + bob, f.facing, f.frameT, this.t);
  }
}
