"use client";

import Link from "next/link";
import { SYSTEM_NAMES } from "@/data/anatomy/lexicon";
import { MUSCLES } from "@/data/muscles/muscles";
import { useLocalModelFile } from "@/hooks/useLocalModelFile";
import type { ActiveAsset } from "@/hooks/useActiveAsset";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import { SYSTEMS } from "@/types/anatomy";
import { Button } from "@/components/ui/Button";
import { ColorField, Section, Segmented, SliderField, Switch } from "@/components/ui/Controls";
import { IconReset, IconUpload } from "@/components/ui/icons";
import { AssetInspector } from "./AssetInspector";

const SYSTEM_HINTS: Record<(typeof SYSTEMS)[number], string> = {
  muscles: "العضلات القابلة للتلوين",
  skeleton: "العظام والفقرات",
  skin: "سطح الجسم بشفافية",
  organs: "القلب والرئتان والأحشاء",
  vessels: "الشرايين والأوردة",
  nerves: "الحبل الشوكي والأعصاب القحفية",
};

function ModelSource({ active }: { active: ActiveAsset }) {
  const mode = useEditor((s) => s.assetMode);
  const summary = useAssetStore((s) => s.summary);
  const loadStatus = useAssetStore((s) => s.loadStatus);
  const { open, clear } = useLocalModelFile();
  const asset = active.status === "ok" ? active.asset : null;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-line bg-panel-2 p-3">
        <p className="text-[11px] text-muted">النموذج الحالي</p>
        <p className="mt-0.5 truncate text-sm text-fg" title={asset?.label}>
          {asset?.label ?? "—"}
        </p>
        {loadStatus === "ready" && summary && (
          <p className="mt-1 text-xs text-muted">
            {summary.meshCount} شبكة · {summary.mappedMuscleIds.length} من {MUSCLES.length} وحدة عضلية مرتبطة
          </p>
        )}
        {summary?.attribution && (
          <Link href="/credits" className="mt-1 inline-block text-xs text-accent-2 hover:underline">
            رخصة {summary.attribution.license} — المصادر والنسب
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {mode === "local-file" ? (
          <Button size="sm" onClick={clear}>
            العودة إلى نموذج Open Anatomy
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={open}>
            <IconUpload size={14} /> تحميل ملف GLB آخر…
          </Button>
        )}
      </div>
    </div>
  );
}

export function SettingsPanel({ active }: { active: ActiveAsset }) {
  const doc = useEditor((s) => s.doc);
  const setGender = useEditor((s) => s.setGender);
  const setBackground = useEditor((s) => s.setBackground);
  const setPaletteColor = useEditor((s) => s.setPaletteColor);
  const resetPalette = useEditor((s) => s.resetPalette);
  const setLighting = useEditor((s) => s.setLighting);
  const setModelScale = useEditor((s) => s.setModelScale);
  const setModelOffsetY = useEditor((s) => s.setModelOffsetY);
  const setShowLabels = useEditor((s) => s.setShowLabels);
  const setShowSelectedNames = useEditor((s) => s.setShowSelectedNames);
  const setLabelLanguage = useEditor((s) => s.setLabelLanguage);
  const setDimUnselected = useEditor((s) => s.setDimUnselected);
  const setMaterialMode = useEditor((s) => s.setMaterialMode);
  const setLayer = useEditor((s) => s.setLayer);
  const hasSystems = useEditor((s) => s.assetMode === "manifest");

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <Section title="النموذج">
        <Segmented
          label="جنس النموذج"
          value={doc.gender}
          onChange={setGender}
          options={[
            { value: "male", label: "ذكر" },
            { value: "female", label: "أنثى" },
          ]}
          className="mb-3 flex w-full"
        />
        <ModelSource active={active} />
      </Section>

      {hasSystems && (
        <Section title="الأجهزة التشريحية">
          <p className="mb-2 text-xs leading-relaxed text-muted">
            تظهر العضلات فقط عند البدء. يمكن إظهار بقية الأجهزة للمرجع؛ التلوين متاح للعضلات وحدها.
          </p>
          {SYSTEMS.map((system) => (
            <Switch
              key={system}
              label={SYSTEM_NAMES[system].ar}
              description={SYSTEM_HINTS[system]}
              checked={doc.layers[system]}
              onChange={(v) => setLayer(system, v)}
            />
          ))}
        </Section>
      )}

      <Section
        title="ألوان العضلات"
        action={
          <button
            type="button"
            onClick={resetPalette}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          >
            <IconReset size={12} /> الافتراضية
          </button>
        }
      >
        <ColorField label="العضلات المستهدفة" value={doc.palette.primary} onChange={(c) => setPaletteColor("primary", c)} />
        <ColorField label="العضلات الثانوية" value={doc.palette.secondary} onChange={(c) => setPaletteColor("secondary", c)} />
        <ColorField label="العضلات غير المحددة" value={doc.palette.base} onChange={(c) => setPaletteColor("base", c)} />
        <ColorField
          label="الظل"
          hint="للعضلات المعتّمة والشبكات غير المرتبطة"
          value={doc.palette.shadow}
          onChange={(c) => setPaletteColor("shadow", c)}
        />
      </Section>

      <Section title="الخلفية">
        <Segmented
          label="الخلفية"
          value={doc.background}
          onChange={setBackground}
          options={[
            { value: "black", label: "سوداء" },
            { value: "white", label: "بيضاء" },
            { value: "transparent", label: "شفافة" },
          ]}
          className="flex w-full"
        />
      </Section>

      <Section title="العرض">
        <SliderField label="شدة الإضاءة" value={doc.lighting} min={0.2} max={2.5} step={0.05} onChange={setLighting} />
        <div className="mt-2">
          <p className="mb-1 text-sm text-fg">لون العضلات غير المحددة</p>
          <Segmented
            label="لون العضلات غير المحددة"
            value={doc.materialMode}
            onChange={setMaterialMode}
            options={[
              { value: "studio", label: "أبيض الاستوديو", title: "خامة موحّدة للرسوم التوضيحية" },
              { value: "anatomical", label: "ألوان تشريحية", title: "الألوان المقترحة في فهرس النموذج" },
            ]}
            className="flex w-full"
          />
        </div>
        <div className="mt-2">
          <Switch
            label="تعتيم العضلات غير المحددة"
            description="استخدام لون الظل لإبراز العضلات الملوّنة"
            checked={doc.dimUnselected}
            onChange={setDimUnselected}
          />
        </div>
      </Section>

      <Section
        title="حجم النموذج وموضعه"
        action={
          <button
            type="button"
            onClick={() => {
              setModelScale(1);
              setModelOffsetY(0);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          >
            <IconReset size={12} /> إعادة ضبط
          </button>
        }
      >
        <SliderField label="الحجم" value={doc.modelScale} min={0.5} max={2} step={0.01} onChange={setModelScale} format={(v) => `${v.toFixed(2)}×`} />
        <SliderField label="الارتفاع" value={doc.modelOffsetY} min={-1} max={1} step={0.01} onChange={setModelOffsetY} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} m`} />
      </Section>

      <Section title="التسميات">
        <Switch label="إظهار التسميات على النموذج" checked={doc.showLabels} onChange={setShowLabels} />
        <Switch label="إظهار قائمة العضلات المحددة" checked={doc.showSelectedNames} onChange={setShowSelectedNames} />
        <div className="mt-2">
          <p className="mb-1 text-sm text-fg">لغة التسميات</p>
          <Segmented
            label="لغة التسميات"
            value={doc.labelLanguage}
            onChange={setLabelLanguage}
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
              { value: "both", label: "كلتاهما" },
            ]}
            className="flex w-full"
          />
        </div>
      </Section>

      <Section title="فاحص ربط الشبكات">
        <AssetInspector />
      </Section>
    </div>
  );
}
