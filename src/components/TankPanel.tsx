import { useState } from "react";
import { SPECIES, STRUCTURES, TANKS, speciesInfo } from "../game/catalog";
import type { SpeciesId, StructureId, TankShape } from "../game/types";
import { MAX_OMNI_MESSAGE } from "../game/omni";

/**
 * Tank shape, structure and fish pickers. Tank and structure swap instantly (cosmetic).
 * Picking a different species starts a new fish, so it asks first.
 */
export function TankPanel({ structure, species, tank, omniMessage, onStructure, onSpecies, onTank, onOmniMessage }: {
  structure: StructureId; species: SpeciesId; tank: TankShape; omniMessage: string;
  onStructure: (s: StructureId) => void; onSpecies: (s: SpeciesId) => void; onTank: (t: TankShape) => void; onOmniMessage: (m: string) => void;
}) {
  const [pending, setPending] = useState<SpeciesId | null>(null);
  const [draft, setDraft] = useState(omniMessage);
  return (
    <>
      <div className="row">
        <span>Tank</span>
        <div className="seg" role="radiogroup" aria-label="Tank shape">
          {TANKS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tank === t.id} title={t.blurb} className={`seg-btn ${tank === t.id ? "on" : ""}`} onClick={() => onTank(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <h3 className="sub-title">Structure</h3>
      <div className="picker" role="radiogroup" aria-label="Structure">
        {STRUCTURES.map((s) => (
          <button key={s.id} role="radio" aria-checked={structure === s.id} title={s.blurb}
            className={`pick ${structure === s.id ? "on" : ""}`} onClick={() => onStructure(s.id)}>
            <span className="pick-icon" aria-hidden>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      {structure === "omniHotel" && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); onOmniMessage(draft); }}>
          <label htmlFor="omni-msg">Omni says</label>
          <span className="seg">
            <input id="omni-msg" className="text" value={draft} maxLength={MAX_OMNI_MESSAGE} placeholder="HI <fish name>" onChange={(e) => setDraft(e.target.value)} aria-label="Message the Omni Hotel scrolls" />
            <button type="submit" className="seg-btn">Show</button>
          </span>
        </form>
      )}
      <h3 className="sub-title">Fish</h3>
      <div className="picker" role="radiogroup" aria-label="Fish species">
        {SPECIES.map((s) => (
          <button key={s.id} role="radio" aria-checked={species === s.id} title={s.blurb}
            className={`pick ${species === s.id ? "on" : ""}`} onClick={() => s.id !== species && setPending(s.id)}>
            <span className="pick-icon" aria-hidden>{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      {pending && (
        <div className="row confirm" role="alertdialog" aria-live="polite">
          <span>Switch to a {speciesInfo(pending).label}? That starts a new fish — stats and name reset.</span>
          <span className="seg">
            <button className="seg-btn danger" onClick={() => { onSpecies(pending); setPending(null); }}>Yes, new fish</button>
            <button className="seg-btn" onClick={() => setPending(null)}>Cancel</button>
          </span>
        </div>
      )}
    </>
  );
}
