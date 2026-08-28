import { useEffect, useRef, useState } from "react";
import type { Weather } from "./omni";
import { browserWeatherDeps, fetchWeather, WEATHER_TTL_MS, type WeatherDeps } from "./weather";

/**
 * Current weather for the Omni's facade — fetched only while `active`, refreshed every 15
 * minutes, and never an error: a failed fetch just leaves the last reading (or null).
 */
export function useWeather(active: boolean, deps?: WeatherDeps): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  const depsRef = useRef<WeatherDeps | null>(deps ?? null);
  useEffect(() => {
    if (!active) return;
    if (!depsRef.current) depsRef.current = browserWeatherDeps();
    const d = depsRef.current;
    let alive = true;
    const run = async () => {
      const w = await fetchWeather(d);
      if (alive && w) setWeather(w);
    };
    run();
    const id = window.setInterval(run, WEATHER_TTL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [active]);
  return weather;
}
