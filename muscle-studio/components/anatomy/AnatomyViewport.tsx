"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { PerspectiveCamera } from "three";
import { Button } from "@/components/ui/Button";
import { IconWarning } from "@/components/ui/icons";
import { applySceneBackground, configureRenderer } from "@/lib/three/rendererSetup";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { editorStore, useEditor } from "@/stores/editorStore";
import type { AnatomyAssetDefinition } from "@/types/anatomy";
import { AnatomyModel } from "./AnatomyModel";
import { CameraRig } from "./CameraRig";
import { StudioLights } from "./StudioLights";
import { ViewportErrorBoundary } from "./ViewportErrorBoundary";

export function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Registers renderer/scene/camera for export + thumbnails, and sets color management. */
function RendererSetup({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const background = useEditor((s) => s.doc.background);

  useLayoutEffect(() => {
    configureRenderer(gl);
    invalidate();
  }, [gl, invalidate]);

  useEffect(() => {
    viewportBridge.handles = {
      gl,
      scene,
      camera: camera as PerspectiveCamera,
      controls: viewportBridge.handles?.controls ?? null,
      invalidate,
    };
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      viewportBridge.handles = null;
    };
  }, [gl, scene, camera, invalidate, onContextLost]);

  useEffect(() => {
    applySceneBackground(scene, gl, background);
    invalidate();
  }, [background, scene, gl, invalidate]);

  return null;
}

export default function AnatomyViewport({ asset }: { asset: AnatomyAssetDefinition | null }) {
  const [supported] = useState(detectWebGL);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const onContextLost = useCallback(() => setContextLost(true), []);

  if (!supported) {
    return (
      <div role="alert" className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
          <IconWarning className="mx-auto mb-3 text-warn" size={28} />
          <h2 className="text-base font-semibold">WebGL is not available</h2>
          <p className="mt-2 text-sm text-muted">
            MUSCLE STUDIO 3D needs WebGL to render anatomy. Enable hardware acceleration in your
            browser settings or try a recent version of Chrome, Edge, Firefox or Safari.
          </p>
        </div>
      </div>
    );
  }

  const restart = () => {
    setContextLost(false);
    setCanvasKey((k) => k + 1);
  };

  return (
    <ViewportErrorBoundary onReset={restart}>
      <Canvas
        key={canvasKey}
        frameloop="demand"
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.01, far: 100, position: [0, 0.9, 4.6] }}
        gl={{
          antialias: true,
          alpha: true,
          // Lets export read the drawing buffer reliably across browsers.
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        onPointerMissed={() => editorStore.getState().setHovered(null)}
        aria-label="3D anatomy viewport. Drag to orbit, scroll to zoom, right-drag to pan, click a muscle to select it."
        role="img"
        style={{ touchAction: "none" }}
      >
        <RendererSetup onContextLost={onContextLost} />
        <StudioLights />
        {asset && <AnatomyModel asset={asset} />}
        <CameraRig />
      </Canvas>
      {contextLost && (
        <div role="alert" className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6">
          <div className="max-w-sm rounded-2xl border border-line bg-panel p-6 text-center">
            <h2 className="text-base font-semibold">Graphics context lost</h2>
            <p className="mt-2 text-sm text-muted">
              The GPU reset the 3D context (often caused by memory pressure or a driver update).
            </p>
            <Button variant="primary" className="mt-4" onClick={restart}>
              Restart viewport
            </Button>
          </div>
        </div>
      )}
    </ViewportErrorBoundary>
  );
}
