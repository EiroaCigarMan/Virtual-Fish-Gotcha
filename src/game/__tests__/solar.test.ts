import { describe, expect, test } from "bun:test";
import { DALLAS, isNight, sunTimes } from "../solar";

/** Published Dallas times (timeanddate / NOAA): 2026-06-21 sunrise 6:19 CDT, sunset 20:38 CDT; 2026-12-21 sunrise 7:24 CST, sunset 17:25 CST. */
const utc = (iso: string) => Date.parse(iso);
const minutesOff = (a: number, b: number) => Math.abs(a - b) / 60_000;

describe("solar (Dallas)", () => {
  test("summer solstice sunrise/sunset within 10 minutes of published values", () => {
    const { sunrise, sunset } = sunTimes(utc("2026-06-21T18:00:00Z"), DALLAS);
    expect(minutesOff(sunrise, utc("2026-06-21T11:19:00Z"))).toBeLessThanOrEqual(10);
    expect(minutesOff(sunset, utc("2026-06-22T01:38:00Z"))).toBeLessThanOrEqual(10);
  });

  test("winter solstice sunrise/sunset within 10 minutes of published values", () => {
    const { sunrise, sunset } = sunTimes(utc("2026-12-21T18:00:00Z"), DALLAS);
    expect(minutesOff(sunrise, utc("2026-12-21T13:24:00Z"))).toBeLessThanOrEqual(10);
    expect(minutesOff(sunset, utc("2026-12-21T23:25:00Z"))).toBeLessThanOrEqual(10);
  });

  test("isNight flips at sunset and sunrise, and is stable across the UTC midnight boundary", () => {
    const { sunrise, sunset } = sunTimes(utc("2026-06-21T18:00:00Z"), DALLAS);
    expect(isNight(sunset - 60_000)).toBe(false);
    expect(isNight(sunset + 60_000)).toBe(true);
    expect(isNight(sunrise - 60_000)).toBe(true);
    expect(isNight(sunrise + 60_000)).toBe(false);
    // 23:00 CDT = 04:00Z next day (after UTC midnight) is still night; 14:00 CDT is day
    expect(isNight(utc("2026-06-22T04:00:00Z"))).toBe(true);
    expect(isNight(utc("2026-06-21T19:00:00Z"))).toBe(false);
  });
});
