"use client";

import { useCallback } from "react";
import { editorStore } from "@/stores/editorStore";
import { toast } from "@/stores/toastStore";

const MAX_BYTES = 512 * 1024 * 1024;

/**
 * Lets the user load a GLB from disk (object URL, never uploaded anywhere).
 * Self-contained .glb files are required: a .gltf with external buffers cannot
 * resolve its sibling files from a single object URL.
 */
export function useLocalModelFile() {
  const open = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb,model/gltf-binary";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!/\.glb$/i.test(file.name)) {
        toast.error("يُرجى اختيار ملف glTF ثنائي (‎.glb) يتضمن بياناته وخاماته.");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("حجم الملف يتجاوز 512 ميغابايت. يُرجى ضغطه (Draco أو Meshopt) قبل التحميل.");
        return;
      }
      const previous = editorStore.getState().localFile;
      if (previous) URL.revokeObjectURL(previous.url);
      editorStore.getState().setLocalFile({ url: URL.createObjectURL(file), name: file.name });
      toast.info(`جارٍ تحميل ${file.name} من الجهاز…`);
    };
    input.click();
  }, []);

  const clear = useCallback(() => {
    const previous = editorStore.getState().localFile;
    if (previous) URL.revokeObjectURL(previous.url);
    editorStore.getState().setLocalFile(null);
  }, []);

  return { open, clear };
}
