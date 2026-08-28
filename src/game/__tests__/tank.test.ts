import { describe, expect, test } from "bun:test";
import { SPECIES, SPECIES_FLAVOR, STRUCTURES, isSpeciesId, isStructureId } from "../catalog";
import { defaultState, newFish, setStructure, setTank } from "../state";
import { coerceState } from "../storage";
import { FISH } from "../../canvas/atlas";
import { STRUCTURE_REGISTRY } from "../../canvas/structures";

describe("catalog", () => {
  test("every structure and species has a renderer and flavor", () => {
    for (const s of STRUCTURES) expect(STRUCTURE_REGISTRY[s.id]).toBeDefined();
    for (const s of SPECIES) { expect(FISH[s.id]).toBeDefined(); expect(SPECIES_FLAVOR[s.id]).toBeDefined(); }
    expect(STRUCTURES).toHaveLength(9);
    expect(SPECIES).toHaveLength(7);
  });
  test("structures fit inside the bowl and stand on the sand", () => {
    for (const s of STRUCTURES) {
      const b = STRUCTURE_REGISTRY[s.id].bounds;
      expect(b.y + b.h).toBe(124); // sand line
      expect(b.x).toBeGreaterThanOrEqual(30); // sprite boxes may carry transparent margin
      expect(b.x + b.w).toBeLessThanOrEqual(130);
      expect(b.y).toBeGreaterThanOrEqual(36); // below the water surface
    }
  });
});

describe("sprites", () => {
  test("every species has baked frames, and its eye, mouth and hit box lie inside the frame", () => {
    for (const s of SPECIES) {
      const sp = FISH[s.id];
      expect(sp.frames).toBeGreaterThanOrEqual(2);
      expect(sp.w).toBeGreaterThan(0); expect(sp.h).toBeGreaterThan(0);
      for (const [x, y] of [sp.eye, sp.mouth]) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(sp.w); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(sp.h); }
      expect(sp.hit[0]).toBeLessThanOrEqual(sp.w); expect(sp.hit[1]).toBeLessThanOrEqual(sp.h);
      expect(sp.hit[0]).toBeGreaterThan(sp.w * 0.5); // the body fills its frame, it is not a speck in a big box
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
    expect(setTank(t, "square").tank).toBe("square");
    expect(setTank(t, "bowl")).toBe(t);
    // the skyline nudges a round bowl to the square tank once; a square tank stays; switching back is allowed
    expect(setStructure(t, "dallasSkyline").tank).toBe("square");
    expect(setStructure({ ...t, tank: "square" }, "dallasSkyline").tank).toBe("square");
    expect(setTank(setStructure(t, "dallasSkyline"), "bowl").tank).toBe("bowl");
    expect(setStructure(setStructure(t, "dallasSkyline"), "castle").tank).toBe("square");
  });
  test("new species = new fish, but the tank setup carries over", () => {
    const s = { ...defaultState(0), hunger: 10, fishName: "Bob", structure: "parthenon" as const, tank: "square" as const, timeFormat: "24h" as const };
    const t = newFish(s, "betta", 5000);
    expect(t.species).toBe("betta");
    expect(t.fishName).toBe("");
    expect(t.hunger).toBe(defaultState(0).hunger);
    expect(t.createdAt).toBe(5000);
    expect(t.structure).toBe("parthenon");
    expect(t.tank).toBe("square");
    expect(t.timeFormat).toBe("24h");
    expect(newFish(t, "betta")).toBe(t);
  });
});

describe("storage", () => {
  test("v1 saves migrate to goldfish + castle, v2 keeps choices, junk falls back", () => {
    const v1 = { schemaVersion: 1, hunger: 50, happiness: 50, cleanliness: 50, lastSeenAt: 1, lastActionAt: {}, timeFormat: "24h", fishName: "Old", createdAt: 1 };
    const m = coerceState(v1, 2)!;
    expect(m.schemaVersion).toBe(3);
    expect(m.tank).toBe("bowl");
    expect(m.species).toBe("goldfish");
    expect(m.structure).toBe("castle");
    expect(m.fishName).toBe("Old");
    const v2 = { ...v1, schemaVersion: 2, species: "peaPuffer", structure: "stonehenge" };
    expect(coerceState(v2, 2)).toMatchObject({ species: "peaPuffer", structure: "stonehenge", tank: "bowl" });
    expect(coerceState({ ...v2, schemaVersion: 3, tank: "square" }, 2)).toMatchObject({ tank: "square" });
    expect(coerceState({ ...v2, schemaVersion: 3, tank: "hexagon" }, 2)).toMatchObject({ tank: "bowl" });
    const bad = { ...v2, species: "shark", structure: "moon" };
    expect(coerceState(bad, 2)).toMatchObject({ species: "goldfish", structure: "castle" });
    expect(coerceState({ schemaVersion: 4 }, 2)).toBeNull();
    expect(isSpeciesId("shark")).toBe(false);
    expect(isStructureId("castle")).toBe(true);
  });
});

describe("passages", () => {
  test("open structures declare passages inside their bounds, big enough for a goldfish", () => {
    for (const id of ["eiffelTower", "stonehenge", "dallasSkyline"] as const) {
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
