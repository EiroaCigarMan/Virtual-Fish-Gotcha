/**
 * The two things the scene needs from its host that differ between a browser and a headless
 * bake/test run: making an offscreen canvas and loading an image. The browser implementation
 * lives here; the Node/Bun one (backed by @napi-rs/canvas) lives in scripts/lib/nodePlatform.ts
 * so it never reaches the bundle.
 */
export interface Platform {
  createCanvas(width: number, height: number): HTMLCanvasElement;
  loadImage(url: string): Promise<CanvasImageSource>;
}

export const browserPlatform: Platform = {
  createCanvas(width, height) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  },
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });
  },
};
