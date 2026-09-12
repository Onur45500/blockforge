import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampPanelSizes, loadWorkspaceLayout, saveWorkspaceLayout } from "./layout-persistence.js";
import { DEFAULT_WORKSPACE_LAYOUT } from "./workspace-types.js";

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

installMemoryStorage();

describe("clampPanelSizes", () => {
  it("keeps sane defaults", () => {
    assert.deepEqual(
      clampPanelSizes(DEFAULT_WORKSPACE_LAYOUT.panelSizes),
      DEFAULT_WORKSPACE_LAYOUT.panelSizes,
    );
  });

  it("caps a bottom dock that would crush the terminal", () => {
    const next = clampPanelSizes({
      ...DEFAULT_WORKSPACE_LAYOUT.panelSizes,
      bottom: 80,
      main: 20,
    });
    assert.equal(next.bottom, 50);
    assert.equal(next.main, 55);
  });

  it("rejects non-finite values", () => {
    const next = clampPanelSizes({
      left: Number.NaN,
      center: Number.POSITIVE_INFINITY,
      right: -4,
      main: 72,
      bottom: 28,
    });
    assert.equal(next.left, DEFAULT_WORKSPACE_LAYOUT.panelSizes.left);
    assert.equal(next.center, DEFAULT_WORKSPACE_LAYOUT.panelSizes.center);
    assert.equal(next.right, 18);
  });
});

describe("layout persistence", () => {
  it("round-trips the terminal bottom dock", () => {
    saveWorkspaceLayout("proj-1", {
      ...DEFAULT_WORKSPACE_LAYOUT,
      openDocks: ["agents", "terminal", "git"],
    });
    const loaded = loadWorkspaceLayout("proj-1");
    assert.deepEqual(loaded.openDocks, ["agents", "terminal", "git"]);
  });
});
