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
        toast.error("Please choose a binary glTF (.glb) file with embedded buffers and textures.");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("This file is larger than 512 MB. Optimize it (Draco/Meshopt, KTX2) before loading.");
        return;
      }
      const previous = editorStore.getState().localFile;
      if (previous) URL.revokeObjectURL(previous.url);
      editorStore.getState().setLocalFile({ url: URL.createObjectURL(file), name: file.name });
      toast.info(`Loading ${file.name} from your computer…`);
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
