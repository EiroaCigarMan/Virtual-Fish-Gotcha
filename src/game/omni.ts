/**
 * The Omni's LED facade, the pure parts: which slide is up, what the message may contain, and
 * how a weather code becomes words. Drawing lives in canvas/omni.ts; fetching in game/weather.ts.
 */
export type OmniSlide = "graphics" | "message" | "datetime" | "weather";
export const OMNI_SLIDES: OmniSlide[] = ["graphics", "message", "datetime", "weather"];
export const SLIDE_MINUTES = 15;

/** Slide for an instant: the cycle is aligned to the wall clock, so a reload lands on the same slide. */
export function slideAt(ms: number, hasWeather = true): OmniSlide {
  const i = Math.floor(ms / (SLIDE_MINUTES * 60_000)) % OMNI_SLIDES.length;
  const slide = OMNI_SLIDES[((i % OMNI_SLIDES.length) + OMNI_SLIDES.length) % OMNI_SLIDES.length];
  // no weather to show → that quarter hour shows the date/time instead
  return slide === "weather" && !hasWeather ? "datetime" : slide;
}

export const MAX_OMNI_MESSAGE = 40;
/** What the facade can letter: the pixel font's uppercase, digits and a little punctuation. */
export function sanitizeOmniMessage(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9 :.!-]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_OMNI_MESSAGE);
}

export type WeatherIcon = "sun" | "cloud" | "rain" | "storm" | "snow" | "fog";
export interface Weather {
  /** °F, rounded. */
  tempF: number;
  /** A short word the facade can scroll. */
  label: string;
  icon: WeatherIcon;
  /** When it was fetched (ms). */
  at: number;
}

/** WMO weather code (Open-Meteo's `weather_code`) → a word and an icon. */
export function describeWeatherCode(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "CLEAR", icon: "sun" };
  if (code === 1) return { label: "SUNNY", icon: "sun" };
  if (code === 2) return { label: "CLOUDY", icon: "cloud" };
  if (code === 3) return { label: "OVERCAST", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "FOG", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "DRIZZLE", icon: "rain" };
  if (code >= 61 && code <= 67) return { label: "RAIN", icon: "rain" };
  if (code >= 71 && code <= 77) return { label: "SNOW", icon: "snow" };
  if (code >= 80 && code <= 82) return { label: "SHOWERS", icon: "rain" };
  if (code === 85 || code === 86) return { label: "SNOW", icon: "snow" };
  if (code >= 95 && code <= 99) return { label: "STORMS", icon: "storm" };
  return { label: "WEATHER", icon: "cloud" };
}
