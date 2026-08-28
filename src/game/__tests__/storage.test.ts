import { beforeEach, describe, expect, test } from "bun:test";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "../constants";
import { defaultState } from "../state";
import { clearState, loadState, readSaveText, saveState } from "../storage";

/** Minimal in-memory Storage so the tests never touch a real browser. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const NOW = 1_700_000_000_000;

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true, writable: true });
});

describe("storage keys after the rename", () => {
  test("the current key is the renamed one and the legacy key is the old name", () => {
    expect(STORAGE_KEY).toBe("virtual-fish-gotcha:v1");
    expect(LEGACY_STORAGE_KEY).toBe("tamagotchi-fish:v1");
  });

  test("a save under the pre-rename key is adopted once and the old key removed", () => {
    const old = { ...defaultState(NOW), fishName: "Bubbles", hunger: 42, structure: "bigBen" as const };
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(old));

    const loaded = loadState(NOW);

    expect(loaded.fishName).toBe("Bubbles");
    expect(loaded.hunger).toBe(42);
    expect(loaded.structure).toBe("bigBen");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(old));
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  test("a save under the current key wins and the legacy key is left alone", () => {
    const current = { ...defaultState(NOW), fishName: "Current" };
    const legacy = { ...defaultState(NOW), fishName: "Legacy" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

    expect(loadState(NOW).fishName).toBe("Current");
    expect(readSaveText()).toBe(JSON.stringify(current));
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacy));
  });

  test("no save under either key → a fresh fish, nothing written", () => {
    const fresh = loadState(NOW);
    expect(fresh).toEqual(defaultState(NOW));
    expect(localStorage.length).toBe(0);
  });

  test("saveState writes only the current key; clearState removes both", () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, "{}");
    saveState(defaultState(NOW));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    clearState();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});
