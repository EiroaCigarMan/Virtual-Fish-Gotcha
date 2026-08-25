import { describe, expect, test } from "bun:test";
import { SPECIES, SPECIES_FLAVOR, STRUCTURES, isSpeciesId, isStructureId } from "../catalog";
import { defaultState, newFish, setStructure } from "../state";
import { coerceState } from "../storage";
import { SPECIES_SPRITES } from "../../canvas/sprites";
import { STRUCTURE_REGISTRY } from "../../canvas/structures";

describe("catalog", () => {
  test("every structure and species has a renderer and flavor", () => {
    for (const s of STRUCTURES) expect(STRUCTURE_REGISTRY[s.id]).toBeDefined();
    for (const s of SPECIES) { expect(SPECIES_SPRITES[s.id]).toBeDefined(); expect(SPECIES_FLAVOR[s.id]).toBeDefined(); }
    expect(STRUCTURES).toHaveLength(8);
    expect(SPECIES).toHaveLength(7);
  });
  test("structures fit inside the bowl and stand on the sand", () => {
    for (const s of STRUCTURES) {
      const b = STRUCTURE_REGISTRY[s.id].bounds;
      expect(b.y + b.h).toBe(124); // sand line
      expect(b.x).toBeGreaterThanOrEqual(36);
      expect(b.x + b.w).toBeLessThanOrEqual(124);
      expect(b.y).toBeGreaterThanOrEqual(36); // below the water surface
    }
  });
});

describe("sprites", () => {
  test("every frame is rectangular, frames share a size, eye/mouth land on the right pixels", () => {
    for (const s of SPECIES) {
      const sp = SPECIES_SPRITES[s.id];
      const w = sp.frames[0].rows[0].length, h = sp.frames[0].rows.length;
      for (const f of sp.frames) {
        expect(f.rows.length).toBe(h);
        for (const row of f.rows) expect(row.length).toBe(w);
        for (const row of f.rows) for (const ch of row) if (ch !== ".") expect(f.palette[ch]).toBeDefined();
        const [ec, er] = sp.eye;
        expect(f.rows[er][ec]).toBe("w");
        expect(f.rows[er][ec + 1]).toBe("k");
      }
      // mouth may wobble a pixel on the tail-flick frame; the rest frame is the reference
      const [mc, mr] = sp.mouth;
      expect(sp.frames[0].rows[mr][mc]).toBe("m");
    }
  });
});

describe("tank state", () => {
  test("structure swap is cosmetic", () => {
    const s = { ...defaultState(0), hunger: 42, fishName: "Bob" };
    const t = setStructure(s, "bigBen");
    expect(t.structure).toBe("bigBen");
    expect(t.hunger).toBe(42);
    expect(t.fishName).toBe("Bob");
    expect(setStructure(t, "bigBen")).toBe(t);
  });
  test("new species = new fish, but the tank setup carries over", () => {
    const s = { ...defaultState(0), hunger: 10, fishName: "Bob", structure: "parthenon" as const, timeFormat: "24h" as const };
    const t = newFish(s, "betta", 5000);
    expect(t.species).toBe("betta");
    expect(t.fishName).toBe("");
    expect(t.hunger).toBe(defaultState(0).hunger);
    expect(t.createdAt).toBe(5000);
    expect(t.structure).toBe("parthenon");
    expect(t.timeFormat).toBe("24h");
    expect(newFish(t, "betta")).toBe(t);
  });
});

describe("storage", () => {
  test("v1 saves migrate to goldfish + castle, v2 keeps choices, junk falls back", () => {
    const v1 = { schemaVersion: 1, hunger: 50, happiness: 50, cleanliness: 50, lastSeenAt: 1, lastActionAt: {}, timeFormat: "24h", fishName: "Old", createdAt: 1 };
    const m = coerceState(v1, 2)!;
    expect(m.schemaVersion).toBe(2);
    expect(m.species).toBe("goldfish");
    expect(m.structure).toBe("castle");
    expect(m.fishName).toBe("Old");
    const v2 = { ...v1, schemaVersion: 2, species: "peaPuffer", structure: "stonehenge" };
    expect(coerceState(v2, 2)).toMatchObject({ species: "peaPuffer", structure: "stonehenge" });
    const bad = { ...v2, species: "shark", structure: "moon" };
    expect(coerceState(bad, 2)).toMatchObject({ species: "goldfish", structure: "castle" });
    expect(coerceState({ schemaVersion: 3 }, 2)).toBeNull();
    expect(isSpeciesId("shark")).toBe(false);
    expect(isStructureId("castle")).toBe(true);
  });
});

describe("passages", () => {
  test("open structures declare passages inside their bounds, big enough for a goldfish", () => {
    for (const id of ["eiffelTower", "stonehenge"] as const) {
      const { bounds: b, passages } = STRUCTURE_REGISTRY[id];
      expect(passages?.length).toBeGreaterThan(0);
      for (const p of passages!) {
        expect(p.x).toBeGreaterThanOrEqual(b.x);
        expect(p.x + p.w).toBeLessThanOrEqual(b.x + b.w);
        expect(p.y).toBeGreaterThanOrEqual(b.y);
        expect(p.y + p.h).toBeLessThanOrEqual(b.y + b.h);
        expect(p.w).toBeGreaterThanOrEqual(16);
        expect(p.h).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
