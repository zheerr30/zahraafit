import { beforeEach, describe, expect, it } from "vitest";
import { createEditorStore, COALESCE_MS, type EditorStore } from "@/stores/editorStore";
import { DEFAULT_PALETTE } from "@/lib/storage/schema";
import { highlightColor } from "@/lib/three/anatomyModel";

let clock = 0;
let store: EditorStore;
const s = () => store.getState();

beforeEach(() => {
  clock = 1_000_000;
  store = createEditorStore({ now: () => clock });
});

describe("muscle selection", () => {
  it("selects multiple muscles and deselects individually", () => {
    s().toggleMuscle("biceps-brachii");
    s().toggleMuscle("triceps-brachii");
    expect(Object.keys(s().doc.selections).sort()).toEqual(["biceps-brachii", "triceps-brachii"]);
    s().deselectMuscle("biceps-brachii");
    expect(Object.keys(s().doc.selections)).toEqual(["triceps-brachii"]);
  });

  it("toggling with the same tone deselects; with another tone re-tones", () => {
    s().toggleMuscle("soleus");
    expect(s().doc.selections.soleus.tone).toBe("primary");
    s().setPaintTone("secondary");
    s().toggleMuscle("soleus");
    expect(s().doc.selections.soleus.tone).toBe("secondary");
    s().toggleMuscle("soleus");
    expect(s().doc.selections.soleus).toBeUndefined();
  });

  it("ignores unknown muscle ids", () => {
    s().toggleMuscle("not-a-muscle");
    expect(s().doc.selections).toEqual({});
    expect(s().past).toHaveLength(0);
  });

  it("selects and deselects a whole anatomical group", () => {
    s().toggleRegion("glutes");
    expect(Object.keys(s().doc.selections).sort()).toEqual([
      "gluteus-maximus",
      "gluteus-medius",
      "gluteus-minimus",
    ]);
    s().toggleRegion("glutes");
    expect(s().doc.selections).toEqual({});
  });

  it("clearSelection resets every muscle to the default material", () => {
    s().selectMuscles(["soleus", "gastrocnemius"]);
    s().clearSelection();
    expect(s().doc.selections).toEqual({});
  });
});

describe("colors", () => {
  it("per-muscle overrides do not affect other muscles", () => {
    s().selectMuscles(["soleus", "gastrocnemius"]);
    s().setMuscleColor("soleus", "#112233");
    expect(highlightColor("soleus", s().doc)).toBe("#112233");
    expect(highlightColor("gastrocnemius", s().doc)).toBe(DEFAULT_PALETTE.primary);
    expect(highlightColor("trapezius", s().doc)).toBeNull();
  });

  it("palette changes recolor every muscle of that tone only", () => {
    s().selectMuscles(["soleus"], "primary");
    s().selectMuscles(["gastrocnemius"], "secondary");
    s().setPaletteColor("primary", "#00FF00");
    expect(highlightColor("soleus", s().doc)).toBe("#00FF00");
    expect(highlightColor("gastrocnemius", s().doc)).toBe(DEFAULT_PALETTE.secondary);
  });

  it("rejects invalid colors", () => {
    s().setPaletteColor("primary", "red");
    s().selectMuscles(["soleus"]);
    s().setMuscleColor("soleus", "#12");
    expect(s().doc.palette.primary).toBe(DEFAULT_PALETTE.primary);
    expect(s().doc.selections.soleus.color).toBeNull();
  });

  it("clearing an override falls back to the tone color", () => {
    s().selectMuscles(["soleus"]);
    s().setMuscleColor("soleus", "#123456");
    s().setMuscleColor("soleus", null);
    expect(highlightColor("soleus", s().doc)).toBe(DEFAULT_PALETTE.primary);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes selection changes", () => {
    s().toggleMuscle("soleus");
    s().toggleMuscle("trapezius");
    s().undo();
    expect(Object.keys(s().doc.selections)).toEqual(["soleus"]);
    s().undo();
    expect(s().doc.selections).toEqual({});
    s().redo();
    s().redo();
    expect(Object.keys(s().doc.selections).sort()).toEqual(["soleus", "trapezius"]);
  });

  it("coalesces rapid edits of the same control into one step", () => {
    s().setPaletteColor("primary", "#000001");
    clock += 100;
    s().setPaletteColor("primary", "#000002");
    clock += 100;
    s().setPaletteColor("primary", "#000003");
    expect(s().past).toHaveLength(1);
    clock += COALESCE_MS + 1;
    s().setPaletteColor("primary", "#000004");
    expect(s().past).toHaveLength(2);
    s().undo();
    expect(s().doc.palette.primary).toBe("#000003");
    s().undo();
    expect(s().doc.palette.primary).toBe(DEFAULT_PALETTE.primary);
  });

  it("a new edit clears the redo stack", () => {
    s().toggleMuscle("soleus");
    s().undo();
    s().toggleMuscle("trapezius");
    expect(s().future).toHaveLength(0);
  });

  it("no-op edits do not create history entries", () => {
    s().setBackground("black");
    s().deselectMuscle("soleus");
    expect(s().past).toHaveLength(0);
  });
});
