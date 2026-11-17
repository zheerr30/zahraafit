"use client";

import { useCallback, useEffect, useState } from "react";
import { getProjectRepository } from "@/lib/storage";
import type { ProjectRepository } from "@/lib/storage/repository";
import type { Project } from "@/lib/storage/schema";
import { toast } from "@/stores/toastStore";

/** Loads the project list from the active repository and exposes CRUD helpers. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [repo, setRepo] = useState<ProjectRepository | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getProjectRepository()
      .then(async (r) => {
        const list = await r.list();
        if (cancelled) return;
        setRepo(r);
        setProjects(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    // Other tabs may save projects; keep the list in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("muscle-studio.projects")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const run = useCallback(
    async (fn: (r: ProjectRepository) => Promise<unknown>, success: string) => {
      try {
        const r = repo ?? (await getProjectRepository());
        await fn(r);
        toast.success(success);
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [repo, refresh],
  );

  return {
    projects,
    error,
    backend: repo?.kind ?? null,
    refresh,
    rename: (id: string, name: string) => run((r) => r.rename(id, name), "Project renamed"),
    duplicate: (id: string) => run((r) => r.duplicate(id), "Project duplicated"),
    remove: (id: string) => run((r) => r.remove(id), "Project deleted"),
  };
}
