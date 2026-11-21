/*
 * Translucent "medical illustration" skin shader.
 * Adapted from open-anatomy-3d-react (packages/open-anatomy-3d-react/src/AnatomyModel.tsx)
 * Copyright (c) 2026 MervinR07 — MIT License
 * https://github.com/MervinR07/open-anatomy-3d/blob/main/LICENSE
 * Changes: colours tuned for the studio's dark background, opacity uniform added.
 */
import { Color, FrontSide, ShaderMaterial } from "three";

export function createSkinMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: "skin:translucent",
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    uniforms: {
      uColor: { value: new Color("#e9c2a8") },
      uRim: { value: new Color("#d9967a") },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uRim;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
        float rim = pow(f, 2.2);
        vec3 col = mix(uColor, uRim, rim);
        float light = 0.75 + 0.25 * max(dot(normalize(vNormal), normalize(vec3(0.3, 0.6, 0.8))), 0.0);
        gl_FragColor = vec4(col * light, (0.06 + 0.45 * rim) * uOpacity);
      }
    `,
  });
}
