import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DECAY_TICK_MS } from "./constants";
import { getMood } from "./mood";
import { applyAction, applyDecay, defaultState, newFish, setFishName as setName, setOmniMessage as setOmni, setStructure as setStruct, setTank as setTnk, setTimeFormat as setFmt } from "./state";
import { clearState, loadState, saveState } from "./storage";
import type { ActionName, SpeciesId, StructureId, TankShape, TimeFormat } from "./types";

export function useFishGame() {
  const [state, setState] = useState(() => loadState());
  const [now, setNow] = useState(() => Date.now());

  // Real-time decay tick + a 1s "now" pulse for cooldown displays.
  useEffect(() => {
    const decayId = window.setInterval(() => setState((s) => applyDecay(s, Date.now())), DECAY_TICK_MS);
    const nowId = window.setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") setState((s) => applyDecay(s, Date.now()));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(decayId);
      clearInterval(nowId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => saveState(state), [state]);

  // Ref mirror so `act` can report refusal (cooldown) synchronously without relying on updater timing.
  const stateRef = useRef(state);
  stateRef.current = state;
  const act = useCallback((action: ActionName): boolean => {
    const cur = stateRef.current;
    const next = applyAction(cur, action, Date.now());
    if (next === cur) return false;
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const setTimeFormat = useCallback((f: TimeFormat) => setState((s) => setFmt(s, f)), []);
  const setFishName = useCallback((n: string) => setState((s) => setName(s, n)), []);
  const setStructure = useCallback((id: StructureId) => setState((s) => setStruct(s, id)), []);
  const setTank = useCallback((t: TankShape) => setState((s) => setTnk(s, t)), []);
  const setOmniMessage = useCallback((m: string) => setState((s) => setOmni(s, m)), []);
  /** Start over with a different species (structure + clock format carry over). */
  const changeSpecies = useCallback((id: SpeciesId) => setState((s) => newFish(s, id, Date.now())), []);
  const reset = useCallback(() => {
    clearState();
    // "New fish" keeps the tank the way you set it up.
    setState((s) => ({ ...defaultState(), structure: s.structure, tank: s.tank, species: s.species, timeFormat: s.timeFormat, omniMessage: s.omniMessage }));
  }, []);

  const mood = useMemo(() => getMood(state), [state]);
  return { state, now, mood, act, setTimeFormat, setFishName, setStructure, setTank, setOmniMessage, changeSpecies, reset };
}
