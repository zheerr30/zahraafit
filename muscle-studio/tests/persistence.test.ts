import { describe, expect, it } from "vitest";
import {
  LOCAL_STORAGE_KEY,
  LocalProjectRepository,
  MemoryStorage,
  StorageQuotaError,
} from "@/lib/storage/localRepository";
import { ProjectNotFoundError } from "@/lib/storage/repository";
import { createDefaultDoc } from "@/lib/storage/schema";
import { createEditorStore } from "@/stores/editorStore";

function repo(storage = new MemoryStorage()) {
  let t = Date.UTC(2026, 0, 1);
  return { storage, repo: new LocalProjectRepository(storage, () => new Date((t += 1000))) };
}

function input(name = "Leg day") {
  const doc = createDefaultDoc("female");
  doc.selections = {
    "gluteus-maximus": { tone: "primary", color: null },
    "biceps-femoris": { tone: "secondary", color: "#123456" },
  };
  doc.background = "transparent";
  return {
    name,
    assetId: "bodyparts3d-female",
    doc,
    camera: { view: "back" as const, position: [0, 1, -3] as [number, number, number], target: [0, 0.9, 0] as [number, number, number] },
    thumbnail: null,
  };
}

describe("LocalProjectRepository", () => {
  it("saves and reloads selections, colors, gender, camera and settings", async () => {
    const { repo: r } = repo();
    const created = await r.create(input());
    const loaded = await r.get(created.id);
    expect(loaded).toEqual(created);
    expect(loaded?.doc.gender).toBe("female");
    expect(loaded?.doc.selections["biceps-femoris"]).toEqual({ tone: "secondary", color: "#123456" });
    expect(loaded?.camera?.view).toBe("back");
    expect(loaded?.doc.background).toBe("transparent");
  });

  it("renames, duplicates and deletes", async () => {
    const { repo: r } = repo();
    const p = await r.create(input());
    const renamed = await r.rename(p.id, "  Posterior chain  ");
    expect(renamed.name).toBe("Posterior chain");
    const copy = await r.duplicate(p.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.name).toBe("Posterior chain (نسخة)");
    expect(copy.doc).toEqual(renamed.doc);
    await r.remove(p.id);
    const list = await r.list();
    expect(list.map((x) => x.id)).toEqual([copy.id]);
    await expect(r.remove("missing")).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("lists most recently updated first", async () => {
    const { repo: r } = repo();
    const a = await r.create(input("A"));
    await r.create(input("B"));
    await r.update(a.id, { name: "A2" });
    expect((await r.list()).map((p) => p.name)).toEqual(["A2", "B"]);
  });

  it("skips corrupt records instead of crashing", async () => {
    const { repo: r, storage } = repo();
    await r.create(input());
    const raw = JSON.parse(storage.getItem(LOCAL_STORAGE_KEY)!);
    raw.push({ id: "bad", name: 42 });
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(raw));
    expect(await r.list()).toHaveLength(1);
    storage.setItem(LOCAL_STORAGE_KEY, "{not json");
    expect(await r.list()).toEqual([]);
  });

  it("surfaces quota errors", async () => {
    class FullStorage extends MemoryStorage {
      setItem(): void {
        const e = new Error("full");
        e.name = "QuotaExceededError";
        throw e;
      }
    }
    const { repo: r } = repo(new FullStorage());
    await expect(r.create(input())).rejects.toBeInstanceOf(StorageQuotaError);
  });

  it("round-trips through the editor store", async () => {
    const { repo: r } = repo();
    const store = createEditorStore();
    store.getState().setGender("female");
    store.getState().selectMuscles(["soleus", "tibialis-anterior"]);
    store.getState().setMuscleColor("soleus", "#abcdef");
    store.getState().setLighting(1.7);
    const saved = await r.create({
      name: "Calves",
      assetId: null,
      doc: store.getState().doc,
      camera: null,
      thumbnail: null,
    });

    const fresh = createEditorStore();
    fresh.getState().loadProject((await r.get(saved.id))!);
    const st = fresh.getState();
    expect(st.doc).toEqual(store.getState().doc);
    expect(st.projectId).toBe(saved.id);
    expect(st.projectName).toBe("Calves");
    expect(st.dirty).toBe(false);
    expect(st.past).toHaveLength(0);
  });
});

describe("project migration", () => {
  it("expands merged-group ids from older projects and drops ids without a counterpart", async () => {
    const { repo: r } = repo();
    const doc = createDefaultDoc("male");
    doc.selections = {
      "upper-arm": { tone: "primary", color: null },
      trapezius: { tone: "secondary", color: "#123456" },
      hand: { tone: "primary", color: null },
    };
    const saved = await r.create({ name: "Old", assetId: null, doc, camera: null, thumbnail: null });
    const store = createEditorStore();
    expect(store.getState().loadProject(saved)).toBe(1);
    const sel = store.getState().doc.selections;
    expect(Object.keys(sel).sort()).toEqual(
      ["biceps-brachii", "brachialis", "coracobrachialis", "triceps-brachii", "trapezius-ascending", "trapezius-descending", "trapezius-transverse"].sort(),
    );
    expect(sel["trapezius-transverse"]).toEqual({ tone: "secondary", color: "#123456" });
  });

  it("reads pre-integration projects without layers and with the old material mode", async () => {
    const { repo: r, storage } = repo();
    const p = await r.create(input());
    const raw = JSON.parse(storage.getItem(LOCAL_STORAGE_KEY)!);
    delete raw[0].doc.layers;
    raw[0].doc.materialMode = "original";
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(raw));
    const loaded = await r.get(p.id);
    expect(loaded?.doc.layers.muscles).toBe(true);
    expect(loaded?.doc.layers.muscles_context).toBe(true);
    expect(loaded?.doc.layers.skin).toBe(false);
    expect(loaded?.doc.materialMode).toBe("anatomical");
  });
});
