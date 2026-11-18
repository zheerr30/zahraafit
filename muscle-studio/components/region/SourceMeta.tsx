"use client";

import { useEffect, useState } from "react";
import type { RegionMesh } from "@/lib/region/backModel";
import type { PickedStructure } from "@/stores/backStore";
import { DEFINITIONS_URL, regionBridge } from "./BackViewport";

/** Z-Anatomy "function" materials (how the author colour-codes muscles). */
const FUNCTION_AR: Record<string, string> = {
  Abductor: "مبعِّدة",
  Adductor: "مقرِّبة",
  "External rotation": "تدوير خارجي",
  "Internal rotator": "تدوير داخلي",
  Extension: "باسطة",
  Flexion: "ثانية",
  Levator: "رافعة",
  Depressor: "خافضة",
  Biarticular: "ثنائية المفصل",
};

let definitionsPromise: Promise<Record<string, string>> | null = null;
function loadDefinitions(): Promise<Record<string, string>> {
  definitionsPromise ??= fetch(DEFINITIONS_URL)
    .then((r) => (r.ok ? r.json() : { definitions: {} }))
    .then((j: { definitions: Record<string, string> }) => j.definitions)
    .catch(() => ({}));
  return definitionsPromise;
}

/** Meshes of the picked structure (a unit may have several, e.g. the erector spinae). */
function meshesOf(p: PickedStructure): RegionMesh[] {
  const model = regionBridge.model;
  if (!model) return [];
  if (p.kind === "unit") return (model.byUnit.get(p.id) ?? []).filter((m) => m.kind === "unit" && (p.side === "m" || m.side === p.side));
  return model.meshes.filter((m) => m.kind === p.kind && m.id === p.id && m.side === p.side);
}

/**
 * What the original asset says about the structure: Z-Anatomy object names,
 * TA2 ID + Latin term, anatomical hierarchy, the author's function material,
 * whether tendon faces are painted, the attachment patches present on the
 * bones, and the Z-Anatomy definition (English, Wikipedia-derived).
 */
export function SourceMeta({ picked }: { picked: PickedStructure }) {
  const meshes = meshesOf(picked);
  const [defs, setDefs] = useState<Record<string, string> | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !defs) void loadDefinitions().then(setDefs);
  }, [open, defs]);
  if (!meshes.length) return null;
  const first = meshes[0].meta;
  const fn = first.materials[0];
  const tendon = meshes.some((m) => m.meta.materials.includes("Tendon"));
  const atts =
    picked.kind === "unit"
      ? (regionBridge.model?.meshes ?? []).filter((m) => m.kind === "attachment" && m.id === picked.id && m.side === picked.side)
      : [];
  const boneAr = (id?: string) => regionBridge.model?.meshes.find((m) => m.kind === "bone" && m.id === id)?.ar ?? id ?? "";
  const byRole = (role: string) => [...new Set(atts.filter((a) => a.role === role).map((a) => boneAr(a.bone)))];
  const definition = defs && first.definition ? defs[first.definition] : undefined;

  return (
    <section className="mx-4 mb-4 rounded-xl border border-[#e3e8f2] bg-[#f8fafd] p-3 text-xs leading-relaxed text-[#13213d]">
      <h4 className="mb-2 text-[11px] font-semibold text-[#0B2E6B]">من بيانات المجسم الأصلي (Z-Anatomy)</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[#6b7891]">الكائن</dt>
        <dd dir="ltr" className="text-start font-mono text-[11px]">{meshes.map((m) => m.meta.zaName).join(" · ")}</dd>
        {first.ta2 && (
          <>
            <dt className="text-[#6b7891]">TA2</dt>
            <dd dir="ltr" className="text-start">
              {first.ta2} — <span className="italic">{first.latin}</span>
            </dd>
          </>
        )}
        {first.hierarchy.length > 0 && (
          <>
            <dt className="text-[#6b7891]">التسلسل</dt>
            <dd dir="ltr" className="text-start text-[11px]">{first.hierarchy.join(" › ")}</dd>
          </>
        )}
        {fn && (picked.kind === "unit" || picked.kind === "context") && (
          <>
            <dt className="text-[#6b7891]">تصنيف المؤلف</dt>
            <dd>
              {FUNCTION_AR[fn] ?? fn} <span dir="ltr" className="text-[#6b7891]">({fn})</span>
              {tendon ? " · أوتار مرسومة في المصدر" : " · لا أوتار مرسومة في المصدر"}
            </dd>
          </>
        )}
        {picked.kind === "unit" && (
          <>
            <dt className="text-[#6b7891]">بصمات العظم</dt>
            <dd>
              {atts.length === 0 && "لا توجد بصمات منشأ/مرتكز لهذه العضلة في المصدر."}
              {byRole("origin").length > 0 && <span className="block">منشأ على: {byRole("origin").join("، ")}</span>}
              {byRole("insertion").length > 0 && <span className="block">مرتكز على: {byRole("insertion").join("، ")}</span>}
            </dd>
          </>
        )}
      </dl>
      {first.definition && (
        <details className="mt-2" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[11px] font-semibold text-[#173F8A]">الوصف التشريحي من المصدر (بالإنجليزية)</summary>
          <div dir="ltr" className="mt-1 max-h-56 overflow-y-auto whitespace-pre-line text-start text-[11px] text-[#2b3a57]">
            {defs === null ? "…" : (definition ?? "—")}
          </div>
          <p className="mt-1 text-[10px] text-[#6b7891]">
            النص: Z-Anatomy عن Wikipedia — رخصة CC BY-SA 3.0.
          </p>
        </details>
      )}
    </section>
  );
}
