import { describe, expect, test } from "bun:test";
import { MAX_OMNI_MESSAGE, describeWeatherCode, sanitizeOmniMessage, slideAt } from "../omni";
import { fetchWeather, weatherFresh, weatherUrl } from "../weather";

const Q = 15 * 60_000;

describe("omni slides", () => {
  test("the slide is a pure function of the wall clock: same quarter-hour → same slide, next quarter → next slide", () => {
    const t0 = Math.floor(Date.parse("2026-08-28T20:00:00Z") / Q) * Q;
    expect(slideAt(t0)).toBe(slideAt(t0 + Q - 1));
    const seq = [0, 1, 2, 3, 4].map((k) => slideAt(t0 + k * Q));
    expect(seq[4]).toBe(seq[0]);
    expect(new Set(seq.slice(0, 4)).size).toBe(4);
    expect(seq.slice(0, 4).sort()).toEqual(["datetime", "graphics", "message", "weather"]);
  });
  test("without weather the weather quarter shows the date/time instead", () => {
    const t0 = Math.floor(Date.parse("2026-08-28T20:00:00Z") / Q) * Q;
    const k = [0, 1, 2, 3].find((i) => slideAt(t0 + i * Q) === "weather")!;
    expect(slideAt(t0 + k * Q, false)).toBe("datetime");
  });
});

describe("omni message", () => {
  test("uppercases, drops what the facade can't letter, collapses spaces, caps the length", () => {
    expect(sanitizeOmniMessage("  go   stars! 🎉 <b>hi</b> ")).toBe("GO STARS! BHIB");
    expect(sanitizeOmniMessage("a".repeat(100))).toHaveLength(MAX_OMNI_MESSAGE);
    expect(sanitizeOmniMessage("happy b-day 12:30.")).toBe("HAPPY B-DAY 12:30.");
  });
});

describe("weather", () => {
  test("WMO codes map to words + icons", () => {
    expect(describeWeatherCode(0)).toEqual({ label: "CLEAR", icon: "sun" });
    expect(describeWeatherCode(63).icon).toBe("rain");
    expect(describeWeatherCode(95).label).toBe("STORMS");
    expect(describeWeatherCode(999).icon).toBe("cloud");
  });
  test("a good response becomes a reading; located place wins over Dallas", async () => {
    const urls: string[] = [];
    const w = await fetchWeather({
      fetch: async (url) => { urls.push(url); return { ok: true, json: async () => ({ current: { temperature_2m: 81.6, weather_code: 2 } }) }; },
      locate: async () => ({ lat: 30.267, lon: -97.743 }),
      now: () => 1000,
    });
    expect(w).toEqual({ tempF: 82, label: "CLOUDY", icon: "cloud", at: 1000 });
    expect(urls[0]).toBe(weatherUrl({ lat: 30.267, lon: -97.743 }));
    expect(urls[0]).toContain("temperature_unit=fahrenheit");
  });
  test("denied geolocation falls back to Dallas; a failed fetch, a bad status or junk JSON all yield null, never a throw", async () => {
    const dallas = await fetchWeather({ fetch: async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 70, weather_code: 0 } }) }), locate: () => Promise.reject(new Error("denied")), now: () => 0 });
    expect(dallas?.label).toBe("CLEAR");
    expect(await fetchWeather({ fetch: () => Promise.reject(new Error("offline")), locate: async () => null, now: () => 0 })).toBeNull();
    expect(await fetchWeather({ fetch: async () => ({ ok: false, json: async () => ({}) }), locate: async () => null, now: () => 0 })).toBeNull();
    expect(await fetchWeather({ fetch: async () => ({ ok: true, json: async () => ({ current: { temperature_2m: "hot" } }) }), locate: async () => null, now: () => 0 })).toBeNull();
  });
  test("a reading is fresh for 15 minutes", () => {
    const w = { tempF: 70, label: "CLEAR", icon: "sun" as const, at: 0 };
    expect(weatherFresh(w, 14 * 60_000)).toBe(true);
    expect(weatherFresh(w, 16 * 60_000)).toBe(false);
    expect(weatherFresh(null, 0)).toBe(false);
  });
});
