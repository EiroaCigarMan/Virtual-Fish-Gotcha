import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { FishEngine, H, PX, W, type EngineInputs } from "../canvas/engine";
import { loadAtlas } from "../canvas/atlas";
import { browserPlatform } from "../canvas/platform";

export interface FishCanvasHandle {
  feed(): void;
  play(): void;
  clean(): void;
}

export const FishCanvas = forwardRef<FishCanvasHandle, EngineInputs>(function FishCanvas(inputs, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FishEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new FishEngine(canvas, browserPlatform);
    engineRef.current = engine;
    engine.setInputs(inputs);
    engine.start();
    let alive = true;
    loadAtlas(browserPlatform, import.meta.env.BASE_URL).then((atlas) => { if (alive) engine.setAtlas(atlas); }, (err) => console.error(err));
    return () => {
      alive = false;
      engine.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setInputs(inputs);
  }, [inputs]);

  useImperativeHandle(ref, () => ({
    feed: () => engineRef.current?.feed(),
    play: () => engineRef.current?.play(),
    clean: () => engineRef.current?.clean(),
  }));

  return (
    <div className="bowl-frame">
      <canvas ref={canvasRef} width={W * PX} height={H * PX} className="bowl-canvas" aria-label={`${inputs.species} bowl`} role="img" />
    </div>
  );
});
