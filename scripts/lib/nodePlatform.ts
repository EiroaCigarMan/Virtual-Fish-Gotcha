/** Headless Platform for the snapshot script and tests, backed by @napi-rs/canvas. */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import type { Platform } from "../../src/canvas/platform";

export const nodePlatform: Platform = {
  createCanvas: (w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement,
  // `base` is a file:// URL to the project's public/ directory
  loadImage: async (url) => (await loadImage(url.startsWith("file:") ? fileURLToPath(url) : url)) as unknown as CanvasImageSource,
};

/** The `base` argument for loadAtlas that resolves to the repo's public/ directory. */
export const publicBase = new URL("../../public/", import.meta.url).href;
