import { useMemo, useRef, useState } from "react";
import { ActionsPanel } from "./components/ActionsPanel";
import { FishCanvas, type FishCanvasHandle } from "./components/FishCanvas";
import { NameDialog } from "./components/NameDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { SidePanel } from "./components/SidePanel";
import { StatsPanel } from "./components/StatsPanel";
import { TankPanel } from "./components/TankPanel";
import { speciesInfo } from "./game/catalog";
import { useFishGame } from "./game/useFishGame";
import type { ActionName } from "./game/types";

export default function App() {
  const { state, now, mood, act, setTimeFormat, setFishName, setStructure, changeSpecies, reset } = useFishGame();
  const [renaming, setRenaming] = useState(false);
  const canvasRef = useRef<FishCanvasHandle>(null);
  const species = speciesInfo(state.species);

  const inputs = useMemo(
    () => ({ mood, cleanliness: state.cleanliness, happiness: state.happiness, timeFormat: state.timeFormat, structure: state.structure, species: state.species }),
    [mood, state.cleanliness, state.happiness, state.timeFormat, state.structure, state.species],
  );

  const onAct = (a: ActionName) => {
    if (act(a)) canvasRef.current?.[a]();
  };

  return (
    <main className="app">
      <header className="hdr">
        <h1>🐠 virtual-fish-gotcha</h1>
        <p className="sub">a tiny {species.label.toLowerCase()} who lives in your browser</p>
      </header>
      <div className="layout">
        <FishCanvas ref={canvasRef} {...inputs} />
        <aside className="side">
          <StatsPanel state={state} mood={mood} />
          <SidePanel tabs={{
            care: <ActionsPanel state={state} now={now} onAct={onAct} />,
            tank: <TankPanel structure={state.structure} species={state.species} onStructure={setStructure} onSpecies={changeSpecies} />,
            settings: <SettingsPanel timeFormat={state.timeFormat} now={now} onTimeFormat={setTimeFormat} onReset={reset} onRename={() => setRenaming(true)} />,
          }} />
        </aside>
      </div>
      {!state.fishName && <NameDialog title={`A new ${species.label.toLowerCase()}! What's its name?`} onSubmit={setFishName} />}
      {state.fishName && renaming && (
        <NameDialog title="Rename your fish" initial={state.fishName} onSubmit={(n) => { setFishName(n); setRenaming(false); }} onCancel={() => setRenaming(false)} />
      )}
    </main>
  );
}
