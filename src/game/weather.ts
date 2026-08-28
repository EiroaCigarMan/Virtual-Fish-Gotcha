/**
 * Current conditions for the Omni's weather slide, from Open-Meteo (no key). Location comes
 * from the browser if it allows it, else Dallas. Any failure — no network, a denied prompt,
 * an odd response — yields `null` and the facade simply skips the slide. Nothing here throws.
 */
import { DALLAS, type Place } from "./solar";
import { describeWeatherCode, type Weather } from "./omni";

export const WEATHER_TTL_MS = 15 * 60_000;
export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export interface WeatherDeps {
  fetch: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  /** Resolve the viewer's place, or reject/null when unavailable. */
  locate: () => Promise<Place | null>;
  now: () => number;
}

export const weatherUrl = (p: Place) =>
  `${OPEN_METEO}?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

/** One fetch. Never throws; null on any failure. */
export async function fetchWeather(deps: WeatherDeps): Promise<Weather | null> {
  let place: Place = DALLAS;
  try { place = (await deps.locate()) ?? DALLAS; } catch { /* denied / unsupported → Dallas */ }
  try {
    const res = await deps.fetch(weatherUrl(place));
    if (!res.ok) return null;
    const data = (await res.json()) as { current?: { temperature_2m?: unknown; weather_code?: unknown } };
    const t = data.current?.temperature_2m, code = data.current?.weather_code;
    if (typeof t !== "number" || !Number.isFinite(t) || typeof code !== "number") return null;
    const { label, icon } = describeWeatherCode(code);
    return { tempF: Math.round(t), label, icon, at: deps.now() };
  } catch {
    return null;
  }
}

/** Browser deps: window.fetch + a 5-second geolocation attempt. */
export function browserWeatherDeps(): WeatherDeps {
  return {
    fetch: (url) => fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" }),
    locate: () => new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
      const done = (p: Place | null) => resolve(p);
      const timer = setTimeout(() => done(null), 5000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); done({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
        () => { clearTimeout(timer); done(null); },
        { timeout: 5000, maximumAge: 10 * 60_000 },
      );
    }),
    now: () => Date.now(),
  };
}

/** Is a cached reading still fresh? */
export const weatherFresh = (w: Weather | null, now: number) => !!w && now - w.at < WEATHER_TTL_MS;
