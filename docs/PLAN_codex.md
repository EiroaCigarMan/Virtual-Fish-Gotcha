# virtual-fish-gotcha Plan

## 1. File / Folder Structure

```text
virtual-fish-gotcha/
  index.html
  package.json
  bun.lockb
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    styles.css

    components/
      AppShell.tsx
      FishCanvas.tsx
      StatsPanel.tsx
      ActionsPanel.tsx
      SettingsPanel.tsx
      ResetDialog.tsx

    game/
      constants.ts
      types.ts
      storage.ts
      decay.ts
      mood.ts
      actions.ts
      time.ts

    canvas/
      CanvasEngine.ts
      renderer.ts
      sprites.ts
      palettes.ts
      pixelFont.ts
      entities/
        fish.ts
        bubbles.ts
        food.ts
        plants.ts
        castle.ts
        water.ts
```

Keep React and canvas concerns separate:

- `game/` owns state, persistence, decay, actions, mood calculation.
- `canvas/` owns drawing, animation, sprite data, and visual-only entities.
- React owns controls, panels, settings, and passing state into the canvas engine.

---

## 2. Data Model + Fish State Machine

### Core Types

```ts
export type StatName = "hunger" | "happiness" | "cleanliness";

export type FishMood =
  | "content"
  | "hungry"
  | "bored"
  | "dirty"
  | "sad"
  | "sleepy";

export type SwimLayer = "behindCastle" | "inFrontOfCastle";

export interface FishGameState {
  hunger: number;       // 0-100, higher is better
  happiness: number;    // 0-100
  cleanliness: number;  // 0-100

  lastSeenAt: number;
  lastFedAt: number | null;
  lastPlayedAt: number | null;
  lastCleanedAt: number | null;

  timeFormat: "12h" | "24h";

  fish: {
    name: string;
    mood: FishMood;
  };
}
```

### Initial State

```ts
const DEFAULT_STATE: FishGameState = {
  hunger: 80,
  happiness: 75,
  cleanliness: 85,

  lastSeenAt: Date.now(),
  lastFedAt: null,
  lastPlayedAt: null,
  lastCleanedAt: null,

  timeFormat: "12h",

  fish: {
    name: "Goldie",
    mood: "content",
  },
};
```

### Decay Rates

Stats decay continuously based on elapsed real time.

Opinionated rates:

```ts
const DECAY_PER_HOUR = {
  hunger: 8,
  happiness: 5,
  cleanliness: 3,
};
```

Meaning:

- Hunger drops from 100 to 0 in about 12.5 hours.
- Happiness drops from 100 to 0 in about 20 hours.
- Cleanliness drops from 100 to 0 in about 33 hours.

Clamp all stats to `0-100`.

The fish never dies. At `0`, it is simply very sad, slow, and visually neglected.

### Action Effects

```ts
const ACTION_EFFECTS = {
  feed: {
    hunger: +28,
    happiness: +4,
    cleanliness: -3,
  },
  play: {
    happiness: +24,
    hunger: -5,
    cleanliness: -2,
  },
  clean: {
    cleanliness: +38,
    happiness: +6,
  },
};
```

Cooldowns should prevent button spam while keeping the app casual:

```ts
const ACTION_COOLDOWNS_MS = {
  feed: 8_000,
  play: 12_000,
  clean: 20_000,
};
```

### Mood Priority

Mood is derived, not manually stored as the source of truth.

Priority order:

```ts
function getMood(state: FishGameState): FishMood {
  const { hunger, happiness, cleanliness } = state;

  if (hunger < 25 && happiness < 25) return "sad";
  if (cleanliness < 25) return "dirty";
  if (hunger < 30) return "hungry";
  if (happiness < 30) return "bored";
  if (hunger < 45 || happiness < 45) return "sleepy";

  return "content";
}
```

### Behavior by Mood

| Mood | Trigger | Movement | Animation | Visuals |
|---|---:|---|---|---|
| `content` | healthy stats | smooth medium swim | tail flap normal | bright color, occasional bubbles |
| `hungry` | hunger `< 30` | seeks surface / food area | mouth opens more often | looks upward |
| `bored` | happiness `< 30` | slow loops | reduced tail motion | droopy eye |
| `dirty` | cleanliness `< 25` | normal but hesitant | occasional pause | water tint green/brown, particles |
| `sad` | hunger and happiness `< 25` | very slow near bottom | droopy, minimal tail flap | muted fish palette |
| `sleepy` | any key stat `< 45` | slow drift | blinking more often | relaxed posture |

---

## 3. Rendering Plan

### Canvas Resolution

Use a deliberately small internal resolution and scale up.

```ts
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 144;
const DISPLAY_SCALE = 4;
```

CSS:

```css
canvas {
  width: 640px;
  height: 576px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

Responsive layout:

- Desktop: canvas left, panels right.
- Mobile: canvas top, controls below.
- Maintain aspect ratio with `max-width: 100%`.

### Canvas Layers

Draw back-to-front every frame:

1. Background room color.
2. Bowl glass back ellipse.
3. Water fill and surface line.
4. Back bubbles.
5. Back plants.
6. Castle back/base.
7. Fish if `layer === "behindCastle"`.
8. Castle front details and pixel clock.
9. Fish if `layer === "inFrontOfCastle"`.
10. Food pellets.
11. Front plants.
12. Gravel and sand highlights.
13. Bowl glass front shine.
14. Dirt tint / particles when cleanliness is low.
15. Tiny sparkle/bubble accents.

### Bowl

The bowl is circular/round with pixel edges.

Recommended logical bounds:

```ts
const BOWL = {
  cx: 80,
  cy: 76,
  radiusX: 62,
  radiusY: 56,
  waterTopY: 34,
  bottomY: 128,
};
```

Draw as pixel-friendly ellipses using filled rect clusters or canvas arcs with integer coordinates. Since the style is pixel art, keep line widths chunky and avoid anti-aliased scaling by drawing at internal resolution only.

### Fish Sprite

Use inline pixel arrays first. PNG sprite sheets are optional later.

Example format:

```ts
type PixelSprite = {
  width: number;
  height: number;
  pixels: string[];
  palette: Record<string, string>;
};
```

Fish sprite dimensions:

```ts
const FISH_SPRITE_SIZE = {
  width: 24,
  height: 14,
};
```

Use multiple frames:

```ts
fishFrames = {
  content: [frame0, frame1, frame2],
  hungry: [hungry0, hungry1],
  sad: [sad0, sad1],
  dirty: [dirty0, dirty1],
};
```

Flipping:

- Draw fish facing right by default.
- Flip horizontally with `ctx.scale(-1, 1)` when moving left.

### Castle Clock

Castle position:

```ts
const CASTLE = {
  x: 56,
  y: 76,
  width: 48,
  height: 42,
};
```

The castle has:

- Two side towers.
- Central doorway.
- A clock display panel near the top.
- Pixel digits integrated as glowing castle stones.

Clock area:

```ts
const CLOCK_PANEL = {
  x: 62,
  y: 84,
  width: 36,
  height: 9,
};
```

Render time using a custom 3x5 pixel font.

Example digit format:

```ts
const DIGITS_3X5 = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
};
```

Each digit pixel is a `1x1` or `2x1` internal canvas block depending on available space.

Time rendering:

- 12h default: `3:42`
- 24h option: `15:42`
- Do not render AM/PM on the castle because space is tight.
- Settings panel can show the active format.
- Re-render every animation frame, but recompute formatted time once per second.

For `12h`, use:

```ts
hour = hour % 12 || 12;
```

### Fish Movement Around Castle

The fish follows a simple waypoint loop inside the bowl.

```ts
type FishVisualState = {
  x: number;
  y: number;
  vx: number;
  facing: "left" | "right";
  targetX: number;
  targetY: number;
  layer: SwimLayer;
};
```

Every few seconds, pick a new target inside the bowl.

Layer rules:

- If fish `y < castle.y + 12`, usually in front.
- If fish passes through central castle area, randomly choose behind/front.
- When behind castle, draw before castle front layer.
- Let the fish partially disappear behind towers for depth.

Speed by mood:

```ts
const FISH_SPEED = {
  content: 12,
  hungry: 10,
  bored: 7,
  dirty: 8,
  sad: 5,
  sleepy: 6,
}; // pixels per second
```

### Ambient Details

Bubbles:

- Spawn every `1.5-4s`.
- Rise from gravel/plants.
- Pop at water surface.
- More bubbles when happy.
- Fewer bubbles when sad.

Food pellets:

- Spawn `5-8` pellets when feeding.
- Start near water surface.
- Fall at `10-18 px/s`.
- Fish may briefly swim toward them.
- Pellets disappear after reaching bottom or after `8s`.

Plants:

- Static pixel plants with tiny sway offset.
- Two or three clusters.
- Use subdued greens with lighter tips.

Sand / gravel:

- Draw a sand band at bottom.
- Scatter deterministic gravel dots using a seeded random pattern.

Dirty water:

- Cleanliness `< 50`: mild tint.
- Cleanliness `< 25`: stronger green/brown overlay.
- Cleanliness `< 15`: floating particles.

---

## 4. React Component Tree + Canvas Communication

### Component Tree

```text
<App>
  <AppShell>
    <FishCanvas
      gameState={state}
      dispatchVisualEvent={...}
    />

    <aside>
      <StatsPanel state={state} />
      <ActionsPanel
        state={state}
        onFeed={feed}
        onPlay={play}
        onClean={clean}
      />
      <SettingsPanel
        timeFormat={state.timeFormat}
        onTimeFormatChange={setTimeFormat}
        onResetRequest={openResetDialog}
      />
    </aside>

    <ResetDialog
      open={resetDialogOpen}
      onConfirm={resetGame}
      onCancel={closeResetDialog}
    />
  </AppShell>
</App>
```

### State Ownership

Use a small custom hook:

```ts
function useFishGame() {
  const [state, setState] = useState(loadStateWithOfflineDecay);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState(prev => applyDecay(prev, Date.now()));
    }, 10_000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return {
    state,
    feed,
    play,
    clean,
    setTimeFormat,
    resetGame,
  };
}
```

### Canvas Engine Lifecycle

`FishCanvas.tsx`:

- Creates a `<canvas>`.
- Instantiates `CanvasEngine` once.
- Passes updated game state into engine when React state changes.
- Starts/stops animation loop on mount/unmount.

```ts
useEffect(() => {
  const engine = new CanvasEngine(canvas, initialState);
  engine.start();

  return () => engine.stop();
}, []);

useEffect(() => {
  engineRef.current?.setGameState(gameState);
}, [gameState]);
```

### React to Canvas Events

When user clicks Feed:

1. React updates persistent game state.
2. React calls `engine.spawnFoodPellets()`.
3. Canvas animates pellets visually.
4. Game state remains authoritative.

For Play:

- React increases happiness.
- Canvas engine triggers a playful dash / loop animation for a few seconds.

For Clean:

- React increases cleanliness.
- Canvas engine triggers sparkle bubbles and fades dirty particles.

---

## 5. Offline Decay Algorithm

Persistence key:

```ts
const STORAGE_KEY = "virtual-fish-gotcha:v1";
```

On every meaningful state update:

```ts
save({
  ...state,
  lastSeenAt: Date.now(),
});
```

On load:

```ts
function loadStateWithOfflineDecay(): FishGameState {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return DEFAULT_STATE;
  }

  const parsed = safelyParse(saved);
  const now = Date.now();

  return applyDecay(parsed, now);
}
```

Decay:

```ts
function applyDecay(state: FishGameState, now: number): FishGameState {
  const elapsedMs = Math.max(0, now - state.lastSeenAt);
  const elapsedHours = elapsedMs / 3_600_000;

  const next = {
    ...state,
    hunger: clamp(state.hunger - elapsedHours * 8, 0, 100),
    happiness: clamp(state.happiness - elapsedHours * 5, 0, 100),
    cleanliness: clamp(state.cleanliness - elapsedHours * 3, 0, 100),
    lastSeenAt: now,
  };

  return {
    ...next,
    fish: {
      ...next.fish,
      mood: getMood(next),
    },
  };
}
```

Important gotchas:

- Handle corrupted localStorage by falling back to default state.
- Handle old schema versions with a simple migration layer.
- Clamp all stats after every action and decay pass.
- Use `Date.now()` only for persistence/state, not animation timing.
- Use `performance.now()` for animation frame deltas.

Suggested storage shape:

```ts
interface StoredFishGameState extends FishGameState {
  schemaVersion: 1;
}
```

---

## 6. Build Steps

Create project:

```bash
bun create vite virtual-fish-gotcha --template react-ts
cd virtual-fish-gotcha
bun install
bun dev
```

Development:

```bash
bun run dev
```

Production build:

```bash
bun run build
```

Preview production build:

```bash
bun run preview
```

Expected `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

Deploy output:

```text
dist/
```

This should be fully static and deployable to Netlify, Vercel, GitHub Pages, Cloudflare Pages, or any static host.

---

## 7. Prioritized Milestones

### Milestone 1: App Skeleton

- Set up React + TypeScript + Vite with Bun.
- Add basic layout.
- Add canvas component.
- Add stats panel and action buttons.
- Add localStorage load/save.

### Milestone 2: Core Game State

- Implement hunger, happiness, cleanliness.
- Implement decay over active time.
- Implement offline decay from `lastSeenAt`.
- Implement feed, play, clean actions.
- Add cooldowns.
- Add reset.

### Milestone 3: Canvas Bowl Scene

- Render pixelated internal canvas.
- Draw round bowl, water, sand, gravel.
- Add static plants and castle.
- Add dirty water tint based on cleanliness.

### Milestone 4: Fish Animation

- Add inline pixel fish sprites.
- Add mood-based sprite frames.
- Add waypoint swimming.
- Add front/behind castle layering.
- Add mood-based speed and behavior changes.

### Milestone 5: Castle Clock

- Build 3x5 pixel font.
- Format current time in 12h/24h.
- Render time on castle.
- Persist time format setting.
- Update clock once per second.

### Milestone 6: Ambient Interactions

- Add bubbles.
- Add food pellets when feeding.
- Add playful dash when playing.
- Add cleaning sparkle effect.
- Polish low-stat animations.

### Milestone 7: UI Polish

- Responsive layout.
- Accessible buttons.
- Clear stat meters.
- Settings panel.
- Reset confirmation dialog.
- Visual consistency with cozy pixel-art theme.

### Milestone 8: Build + QA

- Run TypeScript build.
- Verify localStorage persistence.
- Verify offline decay by editing `lastSeenAt`.
- Test mobile viewport.
- Test reset.
- Test 12h/24h toggle.
- Confirm `dist/` static build works.

---

## 8. Risks / Gotchas

- **Canvas scaling blur:** always draw at low internal resolution and scale with CSS using `image-rendering: pixelated`.
- **React re-rendering too often:** do not store visual animation state in React. Keep animation state inside `CanvasEngine`.
- **Time drift:** use `Date.now()` for clock and persistence, `performance.now()` for frame deltas.
- **Offline decay edge cases:** clamp negative elapsed time in case system clock changes.
- **localStorage corruption:** wrap parsing in `try/catch` and validate schema.
- **Action spam:** cooldowns should be enforced in state logic, not just disabled buttons.
- **Canvas/React mismatch:** React state should be authoritative for stats; canvas state should be visual-only.
- **Clock readability:** the castle clock must be large enough to read at internal resolution. Prefer `H:MM` over adding AM/PM.
- **Dirty water overpowering sprites:** tint overlays should use low alpha and preserve fish readability.
- **Mobile layout:** canvas should not overflow. Use aspect ratio and `max-width: 100%`.
- **Pixel sprites can become tedious:** start with inline pixel arrays for small sprites; only move to PNG sheets if asset complexity grows.
- **Persistence frequency:** save on state changes and periodic decay, but avoid writing every animation frame.
