import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { AssetStatusList } from "@/components/dashboard/ModelShortcuts";
import { StoragePanel } from "@/components/setup/StoragePanel";

export const metadata: Metadata = { title: "Setup" };

function Code({ children }: { children: React.ReactNode }) {
  return <code className="break-all rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-fg">{children}</code>;
}

export default function SetupPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="space-y-8 text-sm leading-relaxed text-muted">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Asset setup</h1>
            <p className="mt-1">
              The studio renders whatever anatomical GLB you install. It never presents a placeholder or a
              generic mannequin as anatomy.
            </p>
          </header>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">1. Get a suitable model</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Superficial musculature, male and/or female, in glTF binary (<Code>.glb</Code>).</li>
              <li>
                <strong className="text-fg">Each muscle must be its own mesh</strong> (left and right separately is
                ideal). A single merged body mesh cannot support per-muscle highlighting — the studio detects this
                and warns you.
              </li>
              <li>Real-world scale is not required; models are normalized to 1.8 m, feet on the floor.</li>
              <li>Facing +Z with +Y up (glTF default). Otherwise set <Code>rotation</Code> in the manifest.</li>
              <li>Check the license allows your use (commercial illustrations, redistribution in exports).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">2. Install the files</h2>
            <p>Copy the files to these paths and reload — no code change needed:</p>
            <ul className="mt-2 space-y-1">
              <li><Code>public/models/male/male-superficial.glb</Code></li>
              <li><Code>public/models/female/female-superficial.glb</Code></li>
              <li>
                Optional dedicated back views: <Code>public/models/male/male-superficial-posterior.glb</Code>,{" "}
                <Code>public/models/female/female-superficial-posterior.glb</Code>
              </li>
            </ul>
            <p className="mt-2">
              To try a file without installing it, use <strong className="text-fg">Load GLB…</strong> in the editor.
              The file stays on your computer.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">3. Mesh naming convention</h2>
            <p>
              Name meshes (or their parent nodes) with the canonical name plus a side suffix, e.g.{" "}
              <Code>Pectoralis_Major_L</Code>, <Code>Pectoralis_Major_R</Code>. The mapping layer also accepts{" "}
              <Code>.L</Code>/<Code>.R</Code>, <Code>Left</Code>/<Code>Right</Code> prefixes or suffixes, CamelCase,
              Blender <Code>.001</Code> suffixes and unambiguous aliases (<Code>Rear_Delt_L</Code>,{" "}
              <Code>Lats_R</Code>). The full list of canonical names is in the{" "}
              <Link href="/library" className="text-accent-2 hover:underline">anatomy library</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">4. Map anything that does not match</h2>
            <p>
              Open the model in the editor and use the <strong className="text-fg">Asset inspector</strong>: it lists
              unmapped meshes (click one in the viewport to find it) and lets you assign each to a muscle. Assignments
              apply instantly and are remembered in this browser. Use <strong className="text-fg">Copy meshMap</strong>{" "}
              and paste the result into the asset&apos;s entry in <Code>data/models/manifest.ts</Code> to make it
              permanent for everyone.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">5. Optimize large models</h2>
            <p>
              Draco, Meshopt and KTX2 compressed GLBs are supported and decoded locally. Example:{" "}
              <Code>npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp</Code>.
              Keep mesh names intact (avoid <Code>--join</Code> / merge steps that combine meshes).
            </p>
          </section>
        </article>

        <aside className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold">Installed assets</h2>
            <AssetStatusList />
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold">Project storage</h2>
            <StoragePanel />
          </div>
          <div className="rounded-2xl border border-warn/30 bg-warn/5 p-5 text-sm">
            <p className="font-semibold text-warn">Pipeline test rig</p>
            <p className="mt-1 text-muted">
              A bundled, procedurally generated, <strong>non-anatomical</strong> GLB with one mesh per muscle, for
              verifying selection, colors and export before real assets arrive. It is always labeled and its
              exports are watermarked.
            </p>
            <Link
              href="/editor?asset=test-rig"
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs text-fg hover:border-warn/60"
            >
              Open editor with test rig
            </Link>
          </div>
        </aside>
      </main>
    </>
  );
}
