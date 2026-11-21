import { Color, NeutralToneMapping, SRGBColorSpace, type Scene, type WebGLRenderer } from "three";
import type { IllustrationDoc } from "@/lib/storage/schema";
import { BACKGROUND_HEX } from "./capture";

/** Neutral tone mapping keeps the brand highlight colors faithful. */
export function configureRenderer(gl: WebGLRenderer): void {
  gl.toneMapping = NeutralToneMapping;
  gl.toneMappingExposure = 1;
  gl.outputColorSpace = SRGBColorSpace;
}

export function applySceneBackground(
  scene: Scene,
  gl: WebGLRenderer,
  background: IllustrationDoc["background"],
): void {
  scene.background = background === "transparent" ? null : new Color(BACKGROUND_HEX[background]);
  gl.setClearColor(0x000000, 0);
}

export function setCanvasCursor(gl: WebGLRenderer, cursor: string): void {
  gl.domElement.style.cursor = cursor;
}
