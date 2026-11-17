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
    s().toggleMuscle("upper-arm");
    s().toggleMuscle("forearm");
    expect(Object.keys(s().doc.selections).sort()).toEqual(["forearm", "upper-arm"]);
    s().deselectMuscle("upper-arm");
    expect(Object.keys(s().doc.selections)).toEqual(["forearm"]);
  });

  it("toggling with the same tone deselects; with another tone re-tones", () => {
    s().toggleMuscle("calf");
    expect(s().doc.selections.calf.tone).toBe("primary");
    s().setPaintTone("secondary");
    s().toggleMuscle("calf");
    expect(s().doc.selections.calf.tone).toBe("secondary");
    s().toggleMuscle("calf");
    expect(s().doc.selections.calf).toBeUndefined();
  });

  it("ignores unknown muscle ids", () => {
    s().toggleMuscle("not-a-muscle");
    expect(s().doc.selections).toEqual({});
    expect(s().past).toHaveLength(0);
  });

  it("selects and deselects a whole anatomical group", () => {
    s().toggleRegion("hips");
    expect(Object.keys(s().doc.selections).sort()).toEqual(["gluteal", "iliopsoas"]);
    s().toggleRegion("hips");
    expect(s().doc.selections).toEqual({});
  });

  it("clearSelection resets every muscle to the default material", () => {
    s().selectMuscles(["calf", "hamstrings"]);
    s().clearSelection();
    expect(s().doc.selections).toEqual({});
  });
});

describe("colors", () => {
  it("per-muscle overrides do not affect other muscles", () => {
    s().selectMuscles(["calf", "hamstrings"]);
    s().setMuscleColor("calf", "#112233");
    expect(highlightColor("calf", s().doc)).toBe("#112233");
    expect(highlightColor("hamstrings", s().doc)).toBe(DEFAULT_PALETTE.primary);
    expect(highlightColor("trapezius", s().doc)).toBeNull();
  });

  it("palette changes recolor every muscle of that tone only", () => {
    s().selectMuscles(["calf"], "primary");
    s().selectMuscles(["hamstrings"], "secondary");
    s().setPaletteColor("primary", "#00FF00");
    expect(highlightColor("calf", s().doc)).toBe("#00FF00");
    expect(highlightColor("hamstrings", s().doc)).toBe(DEFAULT_PALETTE.secondary);
  });

  it("rejects invalid colors", () => {
    s().setPaletteColor("primary", "red");
    s().selectMuscles(["calf"]);
    s().setMuscleColor("calf", "#12");
    expect(s().doc.palette.primary).toBe(DEFAULT_PALETTE.primary);
    expect(s().doc.selections.calf.color).toBeNull();
  });

  it("clearing an override falls back to the tone color", () => {
    s().selectMuscles(["calf"]);
    s().setMuscleColor("calf", "#123456");
    s().setMuscleColor("calf", null);
    expect(highlightColor("calf", s().doc)).toBe(DEFAULT_PALETTE.primary);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes selection changes", () => {
    s().toggleMuscle("calf");
    s().toggleMuscle("trapezius");
    s().undo();
    expect(Object.keys(s().doc.selections)).toEqual(["calf"]);
    s().undo();
    expect(s().doc.selections).toEqual({});
    s().redo();
    s().redo();
    expect(Object.keys(s().doc.selections).sort()).toEqual(["calf", "trapezius"]);
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
    s().toggleMuscle("calf");
    s().undo();
    s().toggleMuscle("trapezius");
    expect(s().future).toHaveLength(0);
  });

  it("no-op edits do not create history entries", () => {
    s().setBackground("black");
    s().deselectMuscle("calf");
    expect(s().past).toHaveLength(0);
  });
});
