"use client";

import Link from "next/link";
import { MUSCLES } from "@/data/muscles/muscles";
import { useLocalModelFile } from "@/hooks/useLocalModelFile";
import type { ActiveAsset } from "@/hooks/useActiveAsset";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import { Button } from "@/components/ui/Button";
import { ColorField, Section, Segmented, SliderField, Switch } from "@/components/ui/Controls";
import { IconReset, IconUpload } from "@/components/ui/icons";
import { AssetInspector } from "./AssetInspector";

function ModelSource({ active }: { active: ActiveAsset }) {
  const mode = useEditor((s) => s.assetMode);
  const setMode = useEditor((s) => s.setAssetMode);
  const summary = useAssetStore((s) => s.summary);
  const loadStatus = useAssetStore((s) => s.loadStatus);
  const testRigAvailable = useAssetStore((s) => s.availability["pipeline-test-rig"]);
  const { open, clear } = useLocalModelFile();

  const asset = active.status === "ok" ? active.asset : null;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-line bg-panel-2 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted">Active asset</p>
        {asset ? (
          <>
            <p className="mt-0.5 truncate text-sm text-fg" title={asset.label}>
              {asset.label}
            </p>
            {asset.diagnostic && (
              <p className="mt-1 text-xs text-warn">Non-anatomical diagnostic geometry.</p>
            )}
            {loadStatus === "ready" && summary && (
              <p className="mt-1 text-xs text-muted">
                {summary.meshCount} meshes · {summary.mappedMuscleIds.length}/{MUSCLES.length} muscles mapped
              </p>
            )}
          </>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            {active.status === "checking" ? "Checking installed assets…" : "No anatomical asset installed"}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={open}>
          <IconUpload size={14} /> Load GLB…
        </Button>
        {mode !== "manifest" && (
          <Button
            size="sm"
            onClick={() => {
              if (mode === "local-file") clear();
              setMode("manifest");
            }}
          >
            Use installed assets
          </Button>
        )}
        {mode !== "test-rig" && testRigAvailable && (
          <Button size="sm" variant="ghost" onClick={() => setMode("test-rig")}>
            Test rig
          </Button>
        )}
      </div>
      <Link href="/setup" className="inline-block text-xs text-accent-2 hover:underline">
        Asset setup guide →
      </Link>
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

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <Section title="Model">
        <Segmented
          label="Model gender"
          value={doc.gender}
          onChange={setGender}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
          className="mb-3 flex w-full"
        />
        <ModelSource active={active} />
      </Section>

      <Section title="Background">
        <Segmented
          label="Background"
          value={doc.background}
          onChange={setBackground}
          options={[
            { value: "black", label: "Black" },
            { value: "white", label: "White" },
            { value: "transparent", label: "Transparent" },
          ]}
          className="flex w-full"
        />
      </Section>

      <Section
        title="Muscle colors"
        action={
          <button
            type="button"
            onClick={resetPalette}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          >
            <IconReset size={12} /> Defaults
          </button>
        }
      >
        <ColorField label="Primary highlight" value={doc.palette.primary} onChange={(c) => setPaletteColor("primary", c)} />
        <ColorField label="Secondary highlight" value={doc.palette.secondary} onChange={(c) => setPaletteColor("secondary", c)} />
        <ColorField label="Base muscle" value={doc.palette.base} onChange={(c) => setPaletteColor("base", c)} />
        <ColorField
          label="Shadow / structure"
          hint="Non-muscle meshes and dimmed muscles"
          value={doc.palette.shadow}
          onChange={(c) => setPaletteColor("shadow", c)}
        />
      </Section>

      <Section title="Rendering">
        <SliderField label="Light intensity" value={doc.lighting} min={0.2} max={2.5} step={0.05} onChange={setLighting} />
        <div className="mt-2">
          <p className="mb-1 text-sm text-fg">Unselected material</p>
          <Segmented
            label="Unselected material"
            value={doc.materialMode}
            onChange={setMaterialMode}
            options={[
              { value: "studio", label: "Studio white", title: "Uniform illustration material" },
              { value: "original", label: "Asset textures", title: "Original materials from the GLB" },
            ]}
            className="flex w-full"
          />
        </div>
        <div className="mt-2">
          <Switch
            label="Dim unselected muscles"
            description="Use the shadow color so highlights stand out"
            checked={doc.dimUnselected}
            onChange={setDimUnselected}
          />
        </div>
      </Section>

      <Section
        title="Model transform"
        action={
          <button
            type="button"
            onClick={() => {
              setModelScale(1);
              setModelOffsetY(0);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          >
            <IconReset size={12} /> Reset
          </button>
        }
      >
        <SliderField label="Scale" value={doc.modelScale} min={0.5} max={2} step={0.01} onChange={setModelScale} format={(v) => `${v.toFixed(2)}×`} />
        <SliderField label="Vertical position" value={doc.modelOffsetY} min={-1} max={1} step={0.01} onChange={setModelOffsetY} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} m`} />
      </Section>

      <Section title="Labels">
        <Switch label="Show labels on model" checked={doc.showLabels} onChange={setShowLabels} />
        <Switch label="Show selected muscle names" checked={doc.showSelectedNames} onChange={setShowSelectedNames} />
        <div className="mt-2">
          <p className="mb-1 text-sm text-fg">Label language</p>
          <Segmented
            label="Label language"
            value={doc.labelLanguage}
            onChange={setLabelLanguage}
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
              { value: "both", label: "Both" },
            ]}
            className="flex w-full"
          />
        </div>
      </Section>

      <Section title="Asset inspector">
        <AssetInspector />
      </Section>
    </div>
  );
}
