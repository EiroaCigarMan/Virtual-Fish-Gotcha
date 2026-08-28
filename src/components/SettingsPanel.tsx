import { useState } from "react";
import { formatClock } from "../game/time";
import type { TimeFormat } from "../game/types";

/** Clock format, rename, reset. Rendered inside the tabbed SidePanel. */
export function SettingsPanel({ timeFormat, now, onTimeFormat, onReset, onRename }: {
  timeFormat: TimeFormat; now: number; onTimeFormat: (f: TimeFormat) => void; onReset: () => void; onRename: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const clock = formatClock(new Date(now), timeFormat);
  return (
    <>
      <div className="row muted">
        <span>Created by</span>
        <span>Johann Ortega</span>
      </div>
      <div className="row">
        <span>Clock</span>
        <div className="seg" role="radiogroup" aria-label="Time format">
          {(["12h", "24h"] as TimeFormat[]).map((f) => (
            <button key={f} role="radio" aria-checked={timeFormat === f} className={`seg-btn ${timeFormat === f ? "on" : ""}`} onClick={() => onTimeFormat(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="row muted">
        <span>Now</span>
        <span className="mono">{clock.display}{clock.meridiem ? ` ${clock.meridiem}` : ""}</span>
      </div>
      <div className="row">
        <span>Fish name</span>
        <button className="seg-btn" onClick={onRename}>Rename…</button>
      </div>
      <div className="row">
        {confirming ? (
          <>
            <span>Start over with a new fish?</span>
            <span className="seg">
              <button className="seg-btn danger" onClick={() => { onReset(); setConfirming(false); }}>Yes, reset</button>
              <button className="seg-btn" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          </>
        ) : (
          <>
            <span>Reset</span>
            <button className="seg-btn" onClick={() => setConfirming(true)}>New fish…</button>
          </>
        )}
      </div>
    </>
  );
}
