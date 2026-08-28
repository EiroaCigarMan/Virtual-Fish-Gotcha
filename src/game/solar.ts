/**
 * Sunrise / sunset for a place, computed locally (NOAA's general solar position equations —
 * the same maths behind the NOAA Solar Calculator). Good to a minute or two, which is all the
 * lights need. No network, no timezone tables: everything is done on instants (ms since epoch),
 * so "is it night in Dallas" is the same answer in every viewer's browser.
 */
export interface Place { lat: number; lon: number }

/** Dallas, Texas — the city the landmarks come from. */
export const DALLAS: Place = { lat: 32.78, lon: -96.8 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const DAY_MS = 86_400_000;

/** Julian centuries since J2000 for an instant. */
const julianCentury = (ms: number) => (ms / DAY_MS + 2440587.5 - 2451545) / 36525;

/** Sun declination (deg) and equation of time (minutes) for an instant. */
function sunPosition(ms: number): { decl: number; eot: number } {
  const t = julianCentury(ms);
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(rad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eot = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  return { decl, eot };
}

/**
 * Sunrise and sunset (as instants) for the UTC calendar day containing `ms`, at `place`.
 * Uses the standard −0.833° zenith correction (refraction + the sun's radius). Polar day/night
 * degenerate to noon±0 / noon±12h.
 */
export function sunTimes(ms: number, place: Place = DALLAS): { sunrise: number; sunset: number; noon: number } {
  const dayStart = Math.floor(ms / DAY_MS) * DAY_MS;
  // iterate once: solar position at local solar noon is what the day's rise/set depend on
  let noon = dayStart + (720 - 4 * place.lon) * 60_000;
  for (let i = 0; i < 2; i++) {
    const { eot } = sunPosition(noon);
    noon = dayStart + (720 - 4 * place.lon - eot) * 60_000;
  }
  const { decl } = sunPosition(noon);
  const cosHA = (Math.cos(rad(90.833)) / (Math.cos(rad(place.lat)) * Math.cos(rad(decl)))) - Math.tan(rad(place.lat)) * Math.tan(rad(decl));
  const ha = deg(Math.acos(Math.max(-1, Math.min(1, cosHA)))); // degrees
  const half = ha * 4 * 60_000; // 4 minutes per degree
  return { sunrise: noon - half, sunset: noon + half, noon };
}

/** True between sunset and the next sunrise at `place`. */
export function isNight(ms: number, place: Place = DALLAS): boolean {
  const today = sunTimes(ms, place);
  if (ms >= today.sunrise && ms < today.sunset) return false;
  // before today's sunrise or after today's sunset: check the neighbouring days' daylight too
  const prev = sunTimes(ms - DAY_MS, place), next = sunTimes(ms + DAY_MS, place);
  if (ms >= prev.sunrise && ms < prev.sunset) return false;
  if (ms >= next.sunrise && ms < next.sunset) return false;
  return true;
}
