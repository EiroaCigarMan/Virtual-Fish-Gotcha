# 🐠 tamagotchi-fish

A cozy, 8-bit fish tamagotchi that lives in your browser. Feed it, play with it, keep its bowl clean — and read the time off the little landmark it swims around. Pick from seven fish and eight structures.

<p align="center"><img src="docs/img/goldfish-bowl.png" width="480" alt="Pixel-art goldfish swimming in a round bowl above a castle whose clock reads 5:30"></p>

- Pixel-art scene rendered on a 160×144 `<canvas>` (scaled up crisp), React for the panels.
- Stats **Full / Happy / Clean** decay in real time — including while the tab is closed (computed from the last-seen timestamp on load).
- The fish never dies; low stats just change its mood, speed, and the water colour.
- **Eight structures**, each with the live clock in its lower portion: Castle, Dallas's Reunion Tower, the Eiffel Tower, Big Ben (the dial's hands move too), the Parthenon, Stonehenge, Dallas City Hall (Pei's inverted pyramid, with a lettered picket sign in the plaza), and a certain pineapple. Swap any time from the **Tank** tab — it's cosmetic.
- **Seven fish**: Goldfish (default), Betta, Endler's Livebearer, Chili Rasbora, Scarlet Badis, Pea Puffer, White Cloud Mountain Minnow. Each has its own sprite, swim speed, and the two tiny ones swim as a school. Picking a new species starts a new fish (it asks first); the structure and clock format carry over.
- Clock shows the current time in **12h or 24h** (toggle in Settings, persisted).
- Everything is stored in `localStorage`. Fully static: `dist/` deploys anywhere.

<p align="center"><img src="docs/img/structures-and-fish.png" width="720" alt="Six bowls: Reunion Tower with an Endler, Eiffel Tower with a Betta, Big Ben with a school of White Cloud minnows, Parthenon with a Scarlet Badis, Stonehenge with a Pea Puffer, and a pineapple house with a school of Chili Rasboras — every clock reads 4:34"></p>

## Run it

**Live:** https://eiroacigarman.github.io/Tamagotchi-Fish/ (auto-deployed from `main` by GitHub Actions → Pages)

Requires Node ≥ 20 **or** Bun. No other setup, no accounts, no backend.

```bash
# with bun
bun install
bun run dev        # http://localhost:5173

# or with npm
npm install
npm run dev
```

Production build → `dist/` (static, host it anywhere):

```bash
bun run build      # or: npm run build
bun run preview    # serve dist/ locally
```

## Scripts

| Script | What |
|---|---|
| `dev` | Vite dev server with HMR |
| `build` | Type-check + production bundle to `dist/` |
| `preview` | Serve the production bundle |
| `test` | Unit tests for decay / actions / mood / clock (`bun test`) |
| `snapshot` | Render one frame of the bowl to a PNG without a browser: `bun run snapshot out.png [mood] [cleanliness] [12h\|24h] [seconds] [structure] [species]` — e.g. `bun run snapshot big-ben.png content 100 12h 4 bigBen whiteCloud` |

## How it works

```
src/
  game/      pure state: types, constants (decay rates, action effects, cooldowns),
             catalog.ts (structure + species lists, per-species flavor), state.ts
             (applyDecay / applyAction / setStructure / newFish), mood.ts, storage.ts
             (schema v2; v1 saves migrate to goldfish + castle), time.ts,
             useFishGame.ts (React hook that owns state, ticks decay, persists)
  canvas/    the scene: engine.ts (loop, fish + school AI, bubbles, pellets, water tint),
             structures.ts (registry of the eight landmarks), castle.ts, clock.ts (the
             shared glowing clock panel + AM/PM pip), pixelFont.ts,
             sprites.ts (per-species frames + mood tinting), pixelFont.ts (3x5 glyphs:
             digits for the clocks, uppercase for lettering a structure)
  components/ FishCanvas (mounts the engine), StatsPanel, SidePanel (tabs) →
             ActionsPanel (Care), TankPanel (structure + fish pickers), SettingsPanel
```

- **Decay** (per real hour): Full −6, Happy −4, Clean −2.5. Full → empty ≈ 16 h.
- **Actions**: Feed +28 full · Play +24 happy · Clean +40 clean (with small side effects and 6/10/15 s cooldowns, enforced in state, not just the UI).
- **Mood** is derived from stats, never stored: sad → dirty → hungry → bored → sleepy → content.
- The fish picks random waypoints inside the water, chases food when you feed it, and switches between swimming **behind** and **in front of** the structure only when none of its pixels sit over a painted structure pixel (the engine keeps an occupancy mask per structure), so it never pops.
- **Open structures have passages.** The Eiffel Tower's arch and the gap under Stonehenge's lintel are declared as `passages`; about a third of the time the fish (or the whole school) deliberately swims through one, drawn behind the structure so the edges frame it. A test renders each structure and checks the passages really are empty pixels.
- **Species flavor** is light on purpose: a speed multiplier (Betta 0.75× … Endler 1.35×) and a school size (Chili Rasbora ×6, White Cloud ×5 — followers trail a leader that runs the normal AI). Decay, actions and moods are identical for every species; moods tint each species' own palette instead of recolouring it orange.
- **Structures** are drawn procedurally and all stand on the sand with the same 36×12 clock panel in their lower half, so the time is always in the same place regardless of what's above it.

## Adding a structure or a fish

1. Add the id to `StructureId` / `SpeciesId` in `src/game/types.ts` and an entry in `src/game/catalog.ts` (label, emoji, blurb; species also get `speed` + `school`).
2. Structure: add a `Structure` to `src/canvas/structures.ts` — draw with `rect`/`disc`, call `drawClockPanel` for the clock (36×12, keep it below y≈110) and `drawMeridiemPip` for AM/PM, and set `bounds` (bottom must be the sand line, y = 124). If it has an opening at least 16×10 px, list it in `passages` and the fish will swim through it. To letter something (Dallas City Hall's sign), use `drawText`/`textWidth` from `pixelFont.ts` at scale 1 and keep it clear of the clock panel.
3. Fish: add a `SpeciesSprite` to `src/canvas/sprites.ts` — right-facing frames using the shared palette letters, plus the `eye` and `mouth` pixel positions used by the mood overlays.
4. `bun test` checks the registries line up, sprites are rectangular, and structures fit the bowl. `bun run snapshot` shows you the result without a browser.

## Verify offline decay yourself

Open DevTools → Application → Local Storage → `tamagotchi-fish:v1`, set `lastSeenAt` to a timestamp a day ago, reload.
