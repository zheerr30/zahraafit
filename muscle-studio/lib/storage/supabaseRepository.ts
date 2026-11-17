import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  cameraStateSchema,
  illustrationDocSchema,
  PROJECT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "./schema";
import {
  ProjectNotFoundError,
  sanitizeName,
  type ProjectInput,
  type ProjectRepository,
} from "./repository";

/** Row shape of the `projects` table (see supabase/migrations/0001_projects.sql). */
const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  asset_id: z.string().nullable(),
  schema_version: z.number(),
  doc: illustrationDocSchema,
  camera: cameraStateSchema.nullable(),
  thumbnail: z.string().nullable(),
});
type Row = z.infer<typeof rowSchema>;

const COLUMNS = "id,name,created_at,updated_at,asset_id,schema_version,doc,camera,thumbnail";

function toProject(row: Row): Project {
  return projectSchema.parse({
    id: row.id,
    name: row.name,
    version: PROJECT_SCHEMA_VERSION,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assetId: row.asset_id,
    doc: row.doc,
    camera: row.camera,
    thumbnail: row.thumbnail,
  });
}

/**
 * Cloud persistence for signed-in users. Row Level Security on the table
 * restricts every query to `auth.uid() = user_id`.
 */
export class SupabaseProjectRepository implements ProjectRepository {
  readonly kind = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  private parseRows(data: unknown): Project[] {
    const rows = z.array(z.unknown()).parse(data ?? []);
    const out: Project[] = [];
    for (const r of rows) {
      const res = rowSchema.safeParse(r);
      if (res.success) out.push(toProject(res.data));
    }
    return out;
  }

  async list(): Promise<Project[]> {
    const { data, error } = await this.client
      .from("projects")
      .select(COLUMNS)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return this.parseRows(data);
  }

  async get(id: string): Promise<Project | null> {
    const { data, error } = await this.client.from("projects").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProject(rowSchema.parse(data)) : null;
  }

  async create(input: ProjectInput): Promise<Project> {
    const { data, error } = await this.client
      .from("projects")
      .insert({
        name: sanitizeName(input.name),
        asset_id: input.assetId,
        schema_version: PROJECT_SCHEMA_VERSION,
        doc: input.doc,
        camera: input.camera,
        thumbnail: input.thumbnail,
      })
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toProject(rowSchema.parse(data));
  }

  async update(id: string, patch: Partial<ProjectInput>): Promise<Project> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) row.name = sanitizeName(patch.name);
    if (patch.assetId !== undefined) row.asset_id = patch.assetId;
    if (patch.doc !== undefined) row.doc = patch.doc;
    if (patch.camera !== undefined) row.camera = patch.camera;
    if (patch.thumbnail !== undefined) row.thumbnail = patch.thumbnail;
    const { data, error } = await this.client
      .from("projects")
      .update(row)
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ProjectNotFoundError(id);
    return toProject(rowSchema.parse(data));
  }

  rename(id: string, name: string): Promise<Project> {
    return this.update(id, { name });
  }

  async duplicate(id: string): Promise<Project> {
    const source = await this.get(id);
    if (!source) throw new ProjectNotFoundError(id);
    return this.create({
      name: `${source.name} (نسخة)`,
      assetId: source.assetId,
      doc: source.doc,
      camera: source.camera,
      thumbnail: source.thumbnail,
    });
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.client
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (count === 0) throw new ProjectNotFoundError(id);
  }
}
