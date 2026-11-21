import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorShell } from "@/components/editor/EditorShell";

export const metadata: Metadata = { title: "Illustration editor" };

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-muted" role="status">
          Opening editor…
        </div>
      }
    >
      <EditorShell />
    </Suspense>
  );
}
