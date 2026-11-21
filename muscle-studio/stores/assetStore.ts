import { create } from "zustand";
import { ANATOMY_ASSETS } from "@/data/models/manifest";
import type { AnatomyAssetDefinition } from "@/types/anatomy";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface AssetSummary {
  assetId: string;
  label: string;
  /** Present for bundled third-party assets that require credit (CC BY). */
  attribution: AnatomyAssetDefinition["attribution"] | null;
  meshCount: number;
  mappedMuscleIds: string[];
  unmappedMeshNames: string[];
  missingMuscleIds: string[];
  unsuitableReason: string | null;
}

interface AssetState {
  /** assetId → true (file exists) / false (missing) / undefined (unchecked). */
  availability: Record<string, boolean | undefined>;
  availabilityChecked: boolean;
  loadStatus: LoadStatus;
  progress: number;
  error: string | null;
  summary: AssetSummary | null;
  /** assetId → (raw mesh name → muscle id) assigned by the user in the inspector. */
  userMeshMaps: Record<string, Record<string, string>>;
  /** Last clicked mesh that is not mapped to a muscle (shown in the inspector). */
  inspectedMesh: string | null;
  /** Incremented to force the current model to reload. */
  reloadToken: number;
  /** Mesh key of a hovered non-muscle structure (bone, organ…), for the readout. */
  hoveredStructure: string | null;

  checkAvailability: (force?: boolean) => Promise<void>;
  setLoadState: (s: Partial<Pick<AssetState, "loadStatus" | "progress" | "error">>) => void;
  setSummary: (summary: AssetSummary | null) => void;
  assignMesh: (assetId: string, meshName: string, muscleId: string | null) => void;
  setInspectedMesh: (name: string | null) => void;
  reload: () => void;
  setHoveredStructure: (key: string | null) => void;
}

const USER_MAP_KEY = "muscle-studio.mesh-maps.v1";

function readUserMaps(): Record<string, Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USER_MAP_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Record<string, string>>) : {};
  } catch {
    return {};
  }
}

function writeUserMaps(maps: Record<string, Record<string, string>>) {
  try {
    window.localStorage.setItem(USER_MAP_KEY, JSON.stringify(maps));
  } catch {
    /* storage unavailable — overrides remain in memory for this session */
  }
}

/** HEAD request; falls back to a ranged GET for hosts that reject HEAD. */
export async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (res.ok) return true;
    if (res.status === 405) {
      const get = await fetch(url, { headers: { Range: "bytes=0-3" }, cache: "no-store" });
      return get.ok;
    }
    return false;
  } catch {
    return false;
  }
}

let inflight: Promise<void> | null = null;

export const useAssetStore = create<AssetState>()((set, get) => ({
  availability: {},
  availabilityChecked: false,
  loadStatus: "idle",
  progress: 0,
  error: null,
  summary: null,
  userMeshMaps: readUserMaps(),
  inspectedMesh: null,
  reloadToken: 0,
  hoveredStructure: null,

  checkAvailability: async (force = false) => {
    if (get().availabilityChecked && !force) return;
    if (inflight && !force) return inflight;
    const assets: AnatomyAssetDefinition[] = ANATOMY_ASSETS;
    inflight = (async () => {
      const entries = await Promise.all(
        assets.map(async (a) => [a.id, await assetExists(a.url)] as const),
      );
      set({ availability: Object.fromEntries(entries), availabilityChecked: true });
      inflight = null;
    })();
    return inflight;
  },

  setLoadState: (s) => set(s),
  setSummary: (summary) => set({ summary }),

  assignMesh: (assetId, meshName, muscleId) => {
    const maps = { ...get().userMeshMaps };
    const forAsset = { ...(maps[assetId] ?? {}) };
    if (muscleId) forAsset[meshName] = muscleId;
    else delete forAsset[meshName];
    maps[assetId] = forAsset;
    writeUserMaps(maps);
    set({ userMeshMaps: maps });
  },
  setInspectedMesh: (name) => set({ inspectedMesh: name }),
  reload: () => set({ reloadToken: get().reloadToken + 1 }),
  setHoveredStructure: (key) => {
    if (get().hoveredStructure !== key) set({ hoveredStructure: key });
  },
}));
