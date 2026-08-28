/** Regenerate docs/img/*.png: the hero bowl and the 3×2 composite of structures + fish. `bun scripts/readmeImages.ts` */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
const root = join(import.meta.dir, "..");
const tmp = join(root, "node_modules/.tmp/readme");
execFileSync("mkdir", ["-p", tmp]);
const snap = (name: string, structure: string, species: string, mood = "content") => {
  const out = join(tmp, `${name}.png`);
  execFileSync("bun", [join(root, "scripts/snapshot.ts"), out, mood, "100", "12h", "5", structure, species], { stdio: "ignore" });
  return out;
};
execFileSync("cp", [snap("hero", "castle", "goldfish"), join(root, "docs/img/goldfish-bowl.png")]);
const tiles = [["reunionTower", "endler"], ["eiffelTower", "betta"], ["bigBen", "whiteCloud"], ["parthenon", "scarletBadis"], ["stonehenge", "peaPuffer"], ["pineapple", "chiliRasbora"]];
const c = createCanvas(320 * 3, 288 * 2);
const ctx = c.getContext("2d");
ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
for (let i = 0; i < tiles.length; i++) {
  const img = await loadImage(snap(`tile${i}`, tiles[i][0], tiles[i][1]));
  ctx.drawImage(img, (i % 3) * 320, Math.floor(i / 3) * 288, 320, 288);
}
writeFileSync(join(root, "docs/img/structures-and-fish.png"), c.toBuffer("image/png"));
console.log("wrote docs/img/goldfish-bowl.png and docs/img/structures-and-fish.png");
