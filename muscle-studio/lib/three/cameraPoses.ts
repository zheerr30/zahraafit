import { Box3, MathUtils, Vector3 } from "three";
import type { ViewId } from "@/types/anatomy";

export interface CameraPose {
  position: Vector3;
  target: Vector3;
}

/** Unit direction from target to camera for each named view (model faces +Z). */
export const VIEW_DIRECTIONS: Record<ViewId, Vector3> = {
  front: new Vector3(0, 0, 1),
  back: new Vector3(0, 0, -1),
  // The model's left side is on +X when it faces +Z.
  left: new Vector3(1, 0, 0),
  right: new Vector3(-1, 0, 0),
};

/**
 * Distance needed to fit a box of (width × height × depth as seen from `dir`)
 * into a perspective frustum, with a margin multiplier.
 */
export function fitDistance(
  box: Box3,
  dir: Vector3,
  fovDeg: number,
  aspect: number,
  margin = 1.12,
): number {
  const size = box.getSize(new Vector3());
  const sideways = Math.abs(dir.x) > Math.abs(dir.z);
  const width = sideways ? size.z : size.x;
  const depth = sideways ? size.x : size.z;
  const height = size.y;
  const vfov = MathUtils.degToRad(fovDeg);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const distV = (height * margin) / 2 / Math.tan(vfov / 2);
  const distH = (width * margin) / 2 / Math.tan(hfov / 2);
  return Math.max(distV, distH) + depth / 2;
}

export function poseForView(
  view: ViewId,
  box: Box3,
  fovDeg: number,
  aspect: number,
  margin?: number,
): CameraPose {
  const target = box.getCenter(new Vector3());
  const dir = VIEW_DIRECTIONS[view];
  const dist = fitDistance(box, dir, fovDeg, aspect, margin);
  return { target, position: target.clone().addScaledVector(dir, dist) };
}

/** Frame an arbitrary box from a given viewing direction. */
export function poseForBox(
  box: Box3,
  direction: Vector3,
  fovDeg: number,
  aspect: number,
  margin = 1.5,
): CameraPose {
  const target = box.getCenter(new Vector3());
  const dir = direction.clone().normalize();
  const size = box.getSize(new Vector3());
  const radius = Math.max(size.length() / 2, 0.05);
  const vfov = MathUtils.degToRad(fovDeg);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const dist = (radius * margin) / Math.sin(Math.min(vfov, hfov) / 2);
  return { target, position: target.clone().addScaledVector(dir, dist) };
}
