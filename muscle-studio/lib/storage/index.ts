import { getSupabaseClient } from "@/lib/supabase/client";
import { LocalProjectRepository, MemoryStorage } from "./localRepository";
import type { ProjectRepository } from "./repository";
import { SupabaseProjectRepository } from "./supabaseRepository";

let local: LocalProjectRepository | null = null;

export function getLocalRepository(): LocalProjectRepository {
  if (local) return local;
  let storage: Storage | MemoryStorage;
  try {
    storage = window.localStorage;
    // Safari private mode and some embedded browsers throw on access.
    storage.setItem("muscle-studio.probe", "1");
    storage.removeItem("muscle-studio.probe");
  } catch {
    storage = new MemoryStorage();
  }
  local = new LocalProjectRepository(storage);
  return local;
}

/**
 * Returns the cloud repository when Supabase is configured AND a user is
 * signed in; otherwise the local (browser) repository.
 */
export async function getProjectRepository(): Promise<ProjectRepository> {
  const client = getSupabaseClient();
  if (client) {
    const { data } = await client.auth.getSession();
    if (data.session) return new SupabaseProjectRepository(client);
  }
  return getLocalRepository();
}

export type { ProjectRepository, ProjectInput } from "./repository";
