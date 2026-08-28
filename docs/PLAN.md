# Plan (as built)

`PLAN_codex.md` is the initial plan produced by OpenAI Codex (gpt-5.5). This file lists what was kept and what was corrected while building.

## Kept
- Folder split `game/` (pure state) vs `canvas/` (visual only) vs `components/`.
- 160×144 internal canvas, CSS `image-rendering: pixelated`, `performance.now()` for frames / `Date.now()` for state.
- Decay-from-`lastSeenAt` offline algorithm, clamp on negative elapsed time, schema-versioned localStorage with coercion fallback.
- Mood priority table, mood-based speed, cooldowns enforced in state.
- 3×5 pixel font for the clock; no AM/PM text on the castle.

## Corrected
- **Mood is not persisted.** Codex stored `fish.mood` in state; it is derived (`getMood`) so it can never go stale.
- **Decay rates softened** for a "cozy, never dies" pet: 6/4/2.5 per hour instead of 8/5/3.
- **Cooldowns shortened** (6/10/15 s) — the plan's 8/12/20 s made feeding feel sluggish.
- **Castle is drawn procedurally** (rects), not a hand-typed 44×40 ASCII sprite — easier to keep pixel-perfect and to place the clock panel.
- **AM/PM shown as a sun/moon pip** on the left tower in 12h mode (the plan dropped meridiem entirely on the castle); the Settings panel shows it as text.
- **Layer switching (behind/in-front of castle) only when the fish is clear of the castle**, so it never pops through it.
- **`act()` reports cooldown refusal synchronously** via a state ref (the plan's closure-in-updater pattern is unreliable under StrictMode).
- Added `scripts/snapshot.ts` (headless PNG render via `@napi-rs/canvas`) and `bun test` unit tests — neither in the plan.

## Added later: structures + species (2026-08)

- **Structure is a registry, not a file.** `canvas/structures.ts` maps each `StructureId` to `{ bounds, draw }`; the castle moved under it unchanged. The clock panel (edge, panel, glow digits, AM/PM pip) was pulled out into `canvas/clock.ts` so every landmark draws the same panel and the time stays in the lower portion of the scene.
- **Species are sprites + two numbers.** Visual frames live in `canvas/sprites.ts`; gameplay flavor (`speed`, `school`) in `game/catalog.ts`. Decay, actions and moods stay species-agnostic — a deliberate "light flavor" call, not a balance system.
- **Mood tinting replaced the hardcoded orange mood palette.** Moods now mix each species' own colours toward a mood colour, so a blue betta stays blue when sad.
- **Schools.** `FishEngine` keeps `fishes[]`; `fishes[0]` runs the existing AI and followers steer to an offset slot beside it. Layer switching waits until the *whole* school is clear of the structure.
- **Schema v2.** `GameState` gained `structure` + `species`; v1 saves load as goldfish + castle. Changing species goes through `newFish()` — stats/name/age reset, structure and clock format carry over. Structure changes are pure cosmetics.
- **One tabbed panel** (Care / Tank / Settings) replaced the two stacked Care + Settings panels so the pickers sit where Feed / Play / Clean already were.
- **Passages + pixel mask (follow-up).** Layer switching originally used the structure's bounding box; for the Eiffel Tower that box covers most of the lower bowl, so the fish was almost never "clear" and rarely got to swim through the arch. The engine now renders the structure once to an occupancy mask and tests the fish's sprite box against painted pixels. Open structures declare `passages`; the AI targets one ~35% of retargets and forces the school behind. Stonehenge was reshaped (deep lintel holds the clock, nothing under it) so there is a real gap to swim through. Reunion Tower was redrawn from a reference photo: bigger, denser lamp-net ball on three slim dark columns that run up into it.

## Added later: pre-rendered 3D sprites (2026-08, #12)

- **The look changed, the engine didn't.** The scene still reasons in 160×144 logical pixels (bowl, waypoints, passages, clock boxes keep their numbers); the canvas is 640×576 and every frame draws through a 4× transform with smoothing on. Rescaling every constant was the alternative and was rejected.
- **Sprites are outputs; models are the source.** `scripts/sprites/` is a small software rasterizer (orthographic, z-buffer, Gouraud + per-vertex Blinn-Phong, 2× supersampling → coverage alpha, per-pixel procedural textures that may return `null` to cut a pixel out) plus a mesh DSL. `bun run sprites` bakes every model into two sheets and a typed manifest; CI runs `sprites:check` so the committed sheets are always byte-identical to a fresh bake. Deterministic by construction (no randomness, no clocks; `hash()` for noise).
- **Textures beat vertex colours.** Bricks, lattices, lamp nets and scale patterns are per-pixel functions of local position. Cut-outs are how the Eiffel Tower is see-through and why the passage test still means something.
- **Clock is vector, not sprite.** The LED panel (`clock.ts` + `ledFont.ts`) draws seven-segment time and a smaller `mm/dd/yy` row over a dark recess modelled into each landmark; 36×12 → 36×16, so every structure's clock box moved a little.
- **Occupancy mask from the sprite.** The engine renders the structure offscreen at full resolution and collapses it to the logical grid (any painted pixel in a 4×4 cell marks the cell), so layer flips still never pop.
- **Mood tinting via `source-atop`** on a cached tinted copy of each species' strip; eye/mouth overlays use anchors the bake projects into the manifest.
- **Headless everywhere.** `Platform` (create a canvas, load an image) is the only host seam: the browser implementation is in `src/canvas/platform.ts`, the `@napi-rs/canvas` one in `scripts/lib/`, used by `snapshot.ts` and the tests.
