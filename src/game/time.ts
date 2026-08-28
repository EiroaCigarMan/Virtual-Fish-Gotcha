import type { TimeFormat } from "./types";

export interface ClockParts {
  /** e.g. "3:07" or "15:07" — what the castle displays */
  display: string;
  /** "AM" | "PM" | "" */
  meridiem: string;
}

export function formatClock(date: Date, fmt: TimeFormat): ClockParts {
  const h24 = date.getHours();
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (fmt === "24h") return { display: `${String(h24).padStart(2, "0")}:${mm}`, meridiem: "" };
  const h12 = h24 % 12 || 12;
  return { display: `${h12}:${mm}`, meridiem: h24 < 12 ? "AM" : "PM" };
}

/** "08/28/26" — the small date row under the clock. */
export function formatDateMMDDYY(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}
