"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { NewIllustrationDialog } from "./NewIllustrationDialog";
import { ProjectCard } from "./ProjectCard";

export function ProjectGrid({ limit, showSearch = false }: { limit?: number; showSearch?: boolean }) {
  const { projects, error, backend, rename, duplicate, remove } = useProjects();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  if (projects === null) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: limit ?? 4 }).map((_, i) => (
          <div key={i} className="aspect-[4/3.9] animate-pulse rounded-2xl border border-line bg-panel" />
        ))}
      </div>
    );
  }

  const filtered = projects.filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {error && <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {showSearch && projects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search illustrations"
            aria-label="Search illustrations"
            className="h-9 w-full max-w-xs rounded-lg border border-line bg-panel px-3 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
          />
          <span className="text-xs text-muted">
            {projects.length} saved · {backend === "supabase" ? "cloud" : "stored in this browser"}
          </span>
        </div>
      )}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-panel/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-fg">No saved illustrations yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Create an illustration, highlight the target muscles, and press Save. Projects keep the selection,
            colors, model and camera.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setNewOpen(true)}>
            <IconPlus size={16} /> New illustration
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No illustration matches “{query}”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onRename={(name) => rename(p.id, name)}
              onDuplicate={() => duplicate(p.id)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      )}
      <NewIllustrationDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
