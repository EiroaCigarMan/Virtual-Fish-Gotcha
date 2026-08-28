/**
 * Bake every fish and structure model into sprite sheets + a typed manifest.
 *
 *   bun run sprites              → public/sprites/{fish,structures}.png + src/canvas/generated/manifest.ts
 *   bun run sprites -- --check   → regenerate into a temp dir and fail if any byte differs (CI)
 *   bun run sprites -- --only goldfish,castle --out /tmp/x   → preview a subset
 *
 * Deterministic by construction: plain math, no clocks, no randomness.
 */
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PX, project, render, type Rendered } from "./raster";
import { FISH_MODELS as REGISTERED_FISH, STRUCTURE_MODELS as REGISTERED_STRUCTURES } from "./models";
import type { FishModel, StructureModel } from "./types";

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const check = args.includes("--check");
const only = flag("--only")?.split(",");
const root = join(import.meta.dir, "../..");
const outDir = flag("--out") ?? (check ? join(root, "node_modules/.tmp/sprites-check") : join(root, "public/sprites"));
mkdirSync(outDir, { recursive: true });

/**
 * `--file path/to/model.ts` — bake a single model module (its first export) into --out, without
 * it being registered in models/index.ts. For iterating on one asset.
 */
const fileArg = flag("--file");
const FISH_MODELS: Record<string, FishModel> = {};
const STRUCTURE_MODELS: Record<string, StructureModel> = {};
if (fileArg) {
  const mod = (await import(join(process.cwd(), fileArg))) as Record<string, FishModel | StructureModel>;
  const [name, model] = Object.entries(mod)[0];
  if ("frames" in model) FISH_MODELS[name] = model; else STRUCTURE_MODELS[name] = model;
} else {
  Object.assign(FISH_MODELS, REGISTERED_FISH);
  Object.assign(STRUCTURE_MODELS, REGISTERED_STRUCTURES);
}

interface Placed { name: string; x: number; y: number; w: number; h: number; img: Rendered }

/** Stack rendered images top-to-bottom (rows of frames for fish). */
function sheet(rows: Placed[][]): { w: number; h: number; placed: Placed[] } {
  let y = 0, w = 0;
  const placed: Placed[] = [];
  for (const row of rows) {
    let x = 0, rh = 0;
    for (const p of row) { p.x = x; p.y = y; x += p.w; rh = Math.max(rh, p.h); placed.push(p); }
    w = Math.max(w, x); y += rh;
  }
  return { w, h: y, placed };
}

function toPng(w: number, h: number, placed: Placed[]): Buffer {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  for (const p of placed) ctx.putImageData(new ImageData(p.img.data, p.img.width, p.img.height), p.x, p.y);
  return c.toBuffer("image/png");
}

// ---- fish ----
const fishRows: Placed[][] = [];
const fishManifest: string[] = [];
for (const [id, model] of Object.entries(FISH_MODELS)) {
  if (only && !only.includes(id)) continue;
  const frame = { x: -model.frame.w / 2, y: -model.frame.h / 2, w: model.frame.w, h: model.frame.h };
  const row: Placed[] = [];
  for (let k = 0; k < model.frames; k++) {
    const img = render(model.build(k, model.frames), frame, model.view);
    row.push({ name: `${id}#${k}`, x: 0, y: 0, w: img.width, h: img.height, img });
  }
  fishRows.push(row);
  const hit = opaqueBox(row[0].img);
  const [ex, ey] = project(model.eye, frame, model.view);
  const [mx, my] = project(model.mouth, frame, model.view);
  fishManifest.push(`  ${id}: { w: ${model.frame.w}, h: ${model.frame.h}, frames: ${model.frames}, row: ${fishRows.length - 1}, eye: [${ex.toFixed(2)}, ${ey.toFixed(2)}], mouth: [${mx.toFixed(2)}, ${my.toFixed(2)}], hit: [${hit.w}, ${hit.h}] },`);
  console.log(`fish ${id}: ${model.frames} frames of ${model.frame.w}×${model.frame.h}`);
}
const fishSheet = sheet(fishRows);
// row y offsets (rows can differ in height)
const fishRowY = fishRows.map((r) => r[0]?.y ?? 0);

// ---- structures ----
const structRows: Placed[][] = [];
const structManifest: string[] = [];
for (const [id, model] of Object.entries(STRUCTURE_MODELS)) {
  if (only && !only.includes(id)) continue;
  const img = render(model.build(), model.frame, model.view);
  structRows.push([{ name: id, x: 0, y: 0, w: img.width, h: img.height, img }]);
  const dayRow = structRows.length - 1;
  const nightRows: number[] = [];
  for (let k = 0; k < (model.nightFrames ?? 0); k++) {
    const nimg = render(model.build({ night: true, frame: k }), model.frame, model.view);
    structRows.push([{ name: `${id}#night${k}`, x: 0, y: 0, w: nimg.width, h: nimg.height, img: nimg }]);
    nightRows.push(structRows.length - 1);
  }
  const night = nightRows.length ? `, night: [${nightRows.map((r) => `__SY${r}__`).join(", ")}]` : "";
  structManifest.push(`  ${id}: { x: ${model.at.x}, y: ${model.at.y}, w: ${model.frame.w}, h: ${model.frame.h}, sy: __SY${dayRow}__${night} },`);
  console.log(`structure ${id}: ${model.frame.w}×${model.frame.h} at (${model.at.x},${model.at.y})${nightRows.length ? ` + ${nightRows.length} night frames` : ""}`);
}
const structSheet = sheet(structRows);
for (let i = 0; i < structManifest.length; i++) structManifest[i] = structManifest[i].replace(/__SY(\d+)__/g, (_, r) => String(structRows[Number(r)][0].y / PX));

const fishPng = toPng(fishSheet.w, fishSheet.h, fishSheet.placed);
const structPng = toPng(structSheet.w, structSheet.h, structSheet.placed);
const manifest = `/* Generated by \`bun run sprites\` — do not edit. Units: logical scene pixels; sheets are ${PX}× that. */
export const SPRITE_PX = ${PX};
export const FISH_SHEET = { w: ${fishSheet.w / PX}, h: ${fishSheet.h / PX}, rowY: [${fishRowY.map((v) => v / PX).join(", ")}] };
export const FISH_SPRITES = {
${fishManifest.join("\n")}
} as const;
export const STRUCTURE_SHEET = { w: ${structSheet.w / PX}, h: ${structSheet.h / PX} };
export const STRUCTURE_SPRITES = {
${structManifest.join("\n")}
} as const;
`;

if (check) {
  const same = (name: string, buf: Buffer) => existsSync(join(root, "public/sprites", name)) && readFileSync(join(root, "public/sprites", name)).equals(buf);
  const manifestPath = join(root, "src/canvas/generated/manifest.ts");
  const ok = same("fish.png", fishPng) && same("structures.png", structPng) && existsSync(manifestPath) && readFileSync(manifestPath, "utf8") === manifest;
  if (!ok) { console.error("sprites:check — committed sheets differ from a fresh bake. Run `bun run sprites` and commit."); process.exit(1); }
  console.log("sprites:check — committed sheets are byte-identical to a fresh bake.");
} else {
  writeFileSync(join(outDir, "fish.png"), fishPng);
  writeFileSync(join(outDir, "structures.png"), structPng);
  if (!only && !flag("--out") && !fileArg) {
    mkdirSync(join(root, "src/canvas/generated"), { recursive: true });
    writeFileSync(join(root, "src/canvas/generated/manifest.ts"), manifest);
  } else {
    writeFileSync(join(outDir, "manifest.ts"), manifest);
  }
  console.log(`wrote ${outDir}/fish.png (${fishSheet.w}×${fishSheet.h}) and structures.png (${structSheet.w}×${structSheet.h})`);
}

/** Size (logical px, rounded up) of the opaque bounding box of a rendered frame — what the fish AI treats as the body. */
function opaqueBox(img: Rendered): { w: number; h: number } {
  let x0 = img.width, x1 = -1, y0 = img.height, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] > 64) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return { w: 1, h: 1 };
  return { w: Math.ceil((x1 - x0 + 1) / PX), h: Math.ceil((y1 - y0 + 1) / PX) };
}
