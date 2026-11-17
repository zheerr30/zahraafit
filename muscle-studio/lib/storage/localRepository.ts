import { z } from "zod";
import {
  PROJECT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "./schema";
import {
  newId,
  ProjectNotFoundError,
  sanitizeName,
  type ProjectInput,
  type ProjectRepository,
} from "./repository";

/** Minimal subset of the Web Storage API so tests can inject an in-memory store. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LOCAL_STORAGE_KEY = "muscle-studio.projects.v1";

export class StorageQuotaError extends Error {
  constructor() {
    super("مساحة التخزين في المتصفح ممتلئة. يُرجى حذف مشاريع قديمة ثم إعادة الحفظ.");
    this.name = "StorageQuotaError";
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/**
 * Projects persisted in localStorage as one JSON array. Records are validated
 * with Zod on read; corrupt entries are skipped instead of crashing the app.
 */
export class LocalProjectRepository implements ProjectRepository {
  readonly kind = "local" as const;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private readAll(): Project[] {
    const raw = this.storage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[muscle-studio] Ignoring corrupt project storage.");
      return [];
    }
    const arr = z.array(z.unknown()).safeParse(parsed);
    if (!arr.success) return [];
    const out: Project[] = [];
    for (const item of arr.data) {
      const res = projectSchema.safeParse(item);
      if (res.success) out.push(res.data);
      else console.warn("[muscle-studio] Skipping invalid project record", res.error.issues[0]);
    }
    return out;
  }

  private writeAll(projects: Project[]): void {
    try {
      this.storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
      if (isQuotaError(err)) {
        // Retry once without thumbnails before giving up.
        try {
          this.storage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(projects.map((p, i) => (i === 0 ? p : { ...p, thumbnail: null }))),
          );
          return;
        } catch {
          throw new StorageQuotaError();
        }
      }
      throw err;
    }
  }

  async list(): Promise<Project[]> {
    return this.readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Project | null> {
    return this.readAll().find((p) => p.id === id) ?? null;
  }

  async create(input: ProjectInput): Promise<Project> {
    const ts = this.now().toISOString();
    const project = projectSchema.parse({
      id: newId(),
      name: sanitizeName(input.name),
      version: PROJECT_SCHEMA_VERSION,
      createdAt: ts,
      updatedAt: ts,
      assetId: input.assetId,
      doc: input.doc,
      camera: input.camera,
      thumbnail: input.thumbnail,
    });
    const all = this.readAll();
    // Newest first so the quota fallback keeps the thumbnail of the latest save.
    this.writeAll([project, ...all]);
    return project;
  }

  async update(id: string, patch: Partial<ProjectInput>): Promise<Project> {
    const all = this.readAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) throw new ProjectNotFoundError(id);
    const current = all[idx];
    const next = projectSchema.parse({
      ...current,
      ...patch,
      name: patch.name !== undefined ? sanitizeName(patch.name) : current.name,
      updatedAt: this.now().toISOString(),
    });
    all.splice(idx, 1);
    this.writeAll([next, ...all]);
    return next;
  }

  async rename(id: string, name: string): Promise<Project> {
    return this.update(id, { name });
  }

  async duplicate(id: string): Promise<Project> {
    const source = await this.get(id);
    if (!source) throw new ProjectNotFoundError(id);
    return this.create({
      name: `${source.name} (نسخة)`,
      assetId: source.assetId,
      doc: structuredClone(source.doc),
      camera: source.camera ? structuredClone(source.camera) : null,
      thumbnail: source.thumbnail,
    });
  }

  async remove(id: string): Promise<void> {
    const all = this.readAll();
    const next = all.filter((p) => p.id !== id);
    if (next.length === all.length) throw new ProjectNotFoundError(id);
    this.writeAll(next);
  }
}

/** In-memory storage, used for tests and when localStorage is unavailable. */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}
