import type { Part } from "./mesh";
import type { Frame, View } from "./raster";

/**
 * A fish is modelled facing right (+x) with its body centred on the origin; the frame is
 * centred on the origin too. `build(k, n)` returns frame k of an n-frame swim cycle.
 */
export interface FishModel {
  frame: { w: number; h: number };
  view: View;
  frames: number;
  /** Model-space eye centre (viewer side) and mouth, projected into the manifest for mood overlays. */
  eye: [number, number, number];
  mouth: [number, number, number];
  build(k: number, n: number): Part[];
}

/**
 * A structure is modelled in scene units with the ground plane at y = 0 (the sand line) and
 * x = 0 at the scene's centre column (x = 80). `frame` is the model-space box that becomes the
 * sprite; `at` is where the frame's top-left lands on the 160×144 scene.
 */
export interface StructureModel {
  frame: Frame;
  at: { x: number; y: number };
  view: View;
  /** Number of night variants (lit windows, lamp patterns…). 0/undefined = the runtime dims the day sprite instead. */
  nightFrames?: number;
  /** `night` selects a night variant; `frame` (0..nightFrames-1) picks which. */
  build(opts?: { night?: boolean; frame?: number }): Part[];
}

export const GROUND_Y = 124; // scene row the ground plane maps to
export const CENTER_X = 80;
