/** Nearest-neighbour zoom of a sprite sheet on a blue ground, for eyeballing a bake: bun scripts/sprites/preview.ts in.png out.png [zoom] */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
const [src, out, z = "6"] = process.argv.slice(2);
const img = await loadImage(src);
const c = createCanvas(img.width * +z, img.height * +z);
const ctx = c.getContext("2d");
ctx.fillStyle = "#2a4a80"; ctx.fillRect(0, 0, c.width, c.height);
ctx.imageSmoothingEnabled = false;
ctx.drawImage(img, 0, 0, c.width, c.height);
writeFileSync(out, c.toBuffer("image/png"));
console.log(`${out} ${c.width}×${c.height}`);
