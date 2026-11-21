import type { CameraControls } from "@react-three/drei";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { MappingReport } from "@/lib/anatomy/resolver";
import type { AnatomyAssetDefinition } from "@/types/anatomy";
import type { LabelAnchor, PreparedModel } from "./anatomyModel";

export interface LoadedModelHandle {
  asset: AnatomyAssetDefinition;
  model: PreparedModel;
  report: MappingReport;
  anchors: Map<string, LabelAnchor[]>;
}

export interface ViewportHandles {
  gl: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: CameraControls | null;
  invalidate: () => void;
}

/**
 * Imperative bridge between the React Three Fiber canvas and plain DOM UI
 * (export dialog, save thumbnails). Populated by components inside <Canvas>.
 */
export const viewportBridge: {
  handles: ViewportHandles | null;
  loaded: LoadedModelHandle | null;
} = {
  handles: null,
  loaded: null,
};
