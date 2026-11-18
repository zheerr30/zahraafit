"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ANATOMY_ASSETS, primaryAssetFor } from "@/data/models/manifest";
import { MUSCLES } from "@/data/muscles/muscles";
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
        state === false && "border-danger/40 text-danger",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", state === undefined ? "bg-muted" : state ? "bg-ok" : "bg-danger")} />
      {state === undefined ? "جارٍ التحقق…" : state ? "النموذج جاهز" : "ملف النموذج غير موجود"}
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
        return (
          <button
            key={g}
            type="button"
            onClick={() => startNewIllustration(router, g)}
            className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-line bg-panel p-5 text-start transition-colors hover:border-line-strong"
          >
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-panel-2">
              <BodyGlyph gender={g} className="h-24 text-muscle-shadow transition-colors group-hover:text-muscle" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">{g === "male" ? "نموذج ذكر" : "نموذج أنثى"}</p>
              <p className="mt-1 text-lg font-semibold">BodyParts3D</p>
              <p className="text-xs text-muted">{MUSCLES.length} عضلة مفصولة لكل جانب · العرض الأمامي والخلفي والجانبي</p>
              <div className="mt-2">
                <StatusPill state={availability[asset.id]} />
              </div>
            </div>
            <span className="absolute end-4 top-4 text-sm text-muted transition-colors group-hover:text-accent">←</span>
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
        <h3 className="text-sm font-semibold">ملفات النماذج</h3>
        <button type="button" onClick={() => void check(true)} className="text-xs text-muted hover:text-fg">
          إعادة التحقق
        </button>
      </div>
      <ul className="divide-y divide-line">
        {ANATOMY_ASSETS.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{a.label}</p>
              <p dir="ltr" className="truncate text-end font-mono text-[11px] text-muted">
                public{a.url}
              </p>
            </div>
            <span className={cn("shrink-0 text-xs", !checked ? "text-muted" : availability[a.id] ? "text-ok" : "text-danger")}>
              {!checked ? "…" : availability[a.id] ? "موجود" : "مفقود"}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-4 py-3">
        <Link href="/credits" className="text-xs text-accent-2 hover:underline">
          الترخيص: CC BY-SA 4.0 — المصادر والنسب ←
        </Link>
      </div>
    </div>
  );
}
