import type { CameraState, IllustrationDoc, Project } from "./schema";

export interface ProjectInput {
  name: string;
  assetId: string | null;
  doc: IllustrationDoc;
  camera: CameraState | null;
  thumbnail: string | null;
}

/** Storage-agnostic project persistence contract (local or Supabase). */
export interface ProjectRepository {
  readonly kind: "local" | "supabase";
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: ProjectInput): Promise<Project>;
  update(id: string, patch: Partial<ProjectInput>): Promise<Project>;
  rename(id: string, name: string): Promise<Project>;
  duplicate(id: string): Promise<Project>;
  remove(id: string): Promise<void>;
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`المشروع «${id}» غير موجود.`);
    this.name = "ProjectNotFoundError";
  }
}

export function sanitizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, 120);
  return trimmed || "رسم بلا عنوان";
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
