"use client";

import { useMemo, useState } from "react";
import { MUSCLES, REGION_DEFINITIONS, getMuscle } from "@/data/muscles/muscles";
import { useAssetStore } from "@/stores/assetStore";
import { toast } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconCopy } from "@/components/ui/icons";

/**
 * Shows how the loaded asset's meshes map to muscle ids and lets the user
 * assign unmapped meshes. Assignments persist per asset in localStorage and
 * can be copied as a `meshMap` block for data/models/manifest.ts.
 */
export function AssetInspector() {
  const summary = useAssetStore((s) => s.summary);
  const inspected = useAssetStore((s) => s.inspectedMesh);
  const userMaps = useAssetStore((s) => s.userMeshMaps);
  const assign = useAssetStore((s) => s.assignMesh);
  const [filter, setFilter] = useState("");

  const userMap = useMemo(() => (summary ? userMaps[summary.assetId] ?? {} : {}), [summary, userMaps]);
  const assignedNames = Object.keys(userMap);
  const unmapped = useMemo(() => {
    if (!summary) return [];
    const names = Array.from(new Set([...summary.unmappedMeshNames, ...assignedNames]));
    const q = filter.trim().toLowerCase();
    return names.filter((n) => !q || n.toLowerCase().includes(q)).sort();
  }, [summary, assignedNames, filter]);

  if (!summary) {
    return <p className="text-xs text-muted">Load a model to inspect its mesh mapping.</p>;
  }

  const copyJson = async () => {
    const json = JSON.stringify(userMap, null, 2);
    try {
      await navigator.clipboard.writeText(`meshMap: ${json},`);
      toast.success("Mapping copied. Paste it into the asset entry in data/models/manifest.ts.");
    } catch {
      toast.error("Clipboard is not available. Select and copy the mapping manually.");
    }
  };

  const mappedCount = summary.mappedMuscleIds.length;
  return (
    <div className="space-y-3 text-xs">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-panel-2 p-2">
          <dt className="text-muted">Meshes</dt>
          <dd className="font-mono text-sm text-fg">{summary.meshCount}</dd>
        </div>
        <div className="rounded-lg bg-panel-2 p-2">
          <dt className="text-muted">Muscles</dt>
          <dd className="font-mono text-sm text-fg">
            {mappedCount}/{MUSCLES.length}
          </dd>
        </div>
        <div className="rounded-lg bg-panel-2 p-2">
          <dt className="text-muted">Unmapped</dt>
          <dd className={cn("font-mono text-sm", summary.unmappedMeshNames.length ? "text-warn" : "text-fg")}>
            {summary.unmappedMeshNames.length}
          </dd>
        </div>
      </dl>

      {summary.unsuitableReason && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-warn">{summary.unsuitableReason}</p>
      )}

      {summary.missingMuscleIds.length > 0 && (
        <details className="rounded-lg bg-panel-2 p-2">
          <summary className="cursor-pointer text-muted">
            {summary.missingMuscleIds.length} muscles have no mesh in this asset
          </summary>
          <p className="mt-2 leading-relaxed text-muted">
            {summary.missingMuscleIds.map((id) => getMuscle(id)?.displayName.en ?? id).join(", ")}
          </p>
        </details>
      )}

      {(summary.unmappedMeshNames.length > 0 || assignedNames.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">Assign meshes</span>
            {assignedNames.length > 0 && (
              <Button size="sm" variant="ghost" onClick={copyJson}>
                <IconCopy size={13} /> Copy meshMap
              </Button>
            )}
          </div>
          {inspected && (
            <p className="rounded-md border border-accent/40 bg-accent/10 p-2 text-fg">
              Clicked unmapped mesh: <span className="font-mono">{inspected}</span>
            </p>
          )}
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter mesh names"
            aria-label="Filter mesh names"
            className="h-8 w-full rounded-md border border-line bg-panel-2 px-2 text-xs focus:border-accent/60 focus:outline-none"
          />
          <ul className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
            {unmapped.slice(0, 300).map((name) => (
              <li
                key={name}
                className={cn(
                  "rounded-md bg-panel-2 p-2",
                  inspected === name && "ring-1 ring-accent/60",
                )}
              >
                <div className="mb-1 truncate font-mono text-[11px] text-fg" title={name}>
                  {name}
                </div>
                <select
                  value={userMap[name] ?? ""}
                  onChange={(e) => assign(summary.assetId, name, e.target.value || null)}
                  aria-label={`Muscle for mesh ${name}`}
                  className="h-7 w-full rounded border border-line bg-panel-3 px-1 text-xs text-fg"
                >
                  <option value="">— not a muscle / unassigned —</option>
                  {REGION_DEFINITIONS.map((r) => (
                    <optgroup key={r.id} label={r.displayName.en}>
                      {MUSCLES.filter((m) => m.region === r.id).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName.en}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {unmapped.length > 300 && <p className="text-muted">Showing 300 of {unmapped.length}. Use the filter.</p>}
        </div>
      )}
    </div>
  );
}
