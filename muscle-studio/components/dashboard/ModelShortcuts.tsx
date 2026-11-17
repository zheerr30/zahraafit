"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ANATOMY_ASSETS, primaryAssetFor } from "@/data/models/manifest";
import { useAssetStore } from "@/stores/assetStore";
import { cn } from "@/components/ui/cn";
import type { Gender } from "@/types/anatomy";
import { BodyGlyph } from "./BodyGlyph";
import { startNewIllustration } from "./NewIllustrationDialog";

function StatusPill({ state }: { state: boolean | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
        state === undefined && "border-line text-muted",
        state === true && "border-ok/40 text-ok",
        state === false && "border-warn/40 text-warn",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === undefined ? "bg-muted" : state ? "bg-ok" : "bg-warn",
        )}
      />
      {state === undefined ? "Checking…" : state ? "Model installed" : "Asset setup required"}
    </span>
  );
}

export function ModelShortcuts() {
  const router = useRouter();
  const availability = useAssetStore((s) => s.availability);
  const check = useAssetStore((s) => s.checkAvailability);
  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(["male", "female"] as Gender[]).map((g) => {
        const asset = primaryAssetFor(g);
        const state = availability[asset.id];
        return (
          <button
            key={g}
            type="button"
            onClick={() => startNewIllustration(router, g)}
            className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-line bg-panel p-5 text-left transition-colors hover:border-line-strong"
          >
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-panel-2">
              <BodyGlyph gender={g} className="h-24 text-muscle-shadow transition-colors group-hover:text-muscle" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {g === "male" ? "Male model · نموذج ذكر" : "Female model · نموذج أنثى"}
              </p>
              <p className="mt-1 text-lg font-semibold">Superficial musculature</p>
              <div className="mt-2">
                <StatusPill state={state} />
              </div>
              <p className="mt-2 truncate font-mono text-[11px] text-muted">public{asset.url}</p>
            </div>
            <span className="absolute right-4 top-4 text-sm text-muted transition-colors group-hover:text-accent">→</span>
          </button>
        );
      })}
    </div>
  );
}

export function AssetStatusList() {
  const availability = useAssetStore((s) => s.availability);
  const checked = useAssetStore((s) => s.availabilityChecked);
  const check = useAssetStore((s) => s.checkAvailability);
  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">Anatomical assets</h3>
        <button type="button" onClick={() => void check(true)} className="text-xs text-muted hover:text-fg">
          Re-check
        </button>
      </div>
      <ul className="divide-y divide-line">
        {ANATOMY_ASSETS.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{a.label}</p>
              <p className="truncate font-mono text-[11px] text-muted">public{a.url}</p>
            </div>
            <span
              className={cn(
                "shrink-0 text-xs",
                !checked ? "text-muted" : availability[a.id] ? "text-ok" : a.views.length < 4 ? "text-muted" : "text-warn",
              )}
            >
              {!checked ? "…" : availability[a.id] ? "Installed" : a.views.length < 4 ? "Optional" : "Missing"}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-4 py-3">
        <Link href="/setup" className="text-xs text-accent-2 hover:underline">
          How to install and map anatomical models →
        </Link>
      </div>
    </div>
  );
}
