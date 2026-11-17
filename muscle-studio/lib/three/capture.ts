import { Box3, Color, MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { getMuscle } from "@/data/muscles/muscles";
import type { IllustrationDoc } from "@/lib/storage/schema";
import type { ViewId } from "@/types/anatomy";
import { anchorWorldPosition, boundsForMuscles, highlightColor, type LabelAnchor } from "./anatomyModel";
import { poseForBox, poseForView } from "./cameraPoses";
import { viewportBridge, type LoadedModelHandle, type ViewportHandles } from "./viewportBridge";

export const BACKGROUND_HEX: Record<Exclude<IllustrationDoc["background"], "transparent">, string> = {
  black: "#050505",
  white: "#FFFFFF",
};

export type ExportView = "current" | "selection" | ViewId;

export interface ExportOptions {
  width: number;
  height: number;
  background: IllustrationDoc["background"];
  /** One view → single illustration. Several → panels side by side (e.g. front + back sheet). */
  views: ExportView[];
  labels: boolean;
  legend: boolean;
  language: IllustrationDoc["labelLanguage"];
  doc: Pick<IllustrationDoc, "selections" | "palette" | "materialMode" | "dimUnselected">;
  title?: string;
  /** Small notice drawn in the bottom-right corner (used for diagnostic assets). */
  watermark?: string;
}

const FONT_STACK =
  '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans Arabic", "Geeza Pro", Tahoma, sans-serif';

/** Hard cap on output dimensions to keep memory bounded (~256 MB RGBA). */
export const MAX_EXPORT_SIDE = 8192;

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available in this browser.");
  return ctx;
}

/** Wait for React effects (material updates) to flush and the canvas to redraw. */
export async function waitForFrames(handles: ViewportHandles, count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    handles.invalidate();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

function maxTileSize(handles: ViewportHandles): number {
  const gl = handles.gl.getContext();
  const rb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  return Math.max(256, Math.min(2048, rb, vp[0], vp[1]));
}

/**
 * Render the scene with the given camera at an arbitrary resolution by
 * rendering tiles through `camera.setViewOffset`, so outputs larger than the
 * GPU's maximum drawing buffer still work. Only the 3D artwork is captured.
 */
export function renderSceneToCanvas(
  handles: ViewportHandles,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  background: IllustrationDoc["background"],
): HTMLCanvasElement {
  const { gl, scene } = handles;
  const tile = maxTileSize(handles);
  const out = createCanvas(width, height);
  const ctx = ctx2d(out);

  const prevSize = gl.getSize(new Vector2());
  const prevRatio = gl.getPixelRatio();
  const prevBackground = scene.background;
  const prevClear = gl.getClearColor(new Color());
  const prevClearAlpha = gl.getClearAlpha();
  const prevTarget = gl.getRenderTarget();

  try {
    gl.setRenderTarget(null);
    if (background === "transparent") {
      scene.background = null;
      gl.setClearColor(0x000000, 0);
    } else {
      scene.background = new Color(BACKGROUND_HEX[background]);
    }
    gl.setPixelRatio(1);
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) {
        const tw = Math.min(tile, width - x);
        const th = Math.min(tile, height - y);
        camera.setViewOffset(width, height, x, y, tw, th);
        camera.updateProjectionMatrix();
        gl.setSize(tw, th, false);
        gl.render(scene, camera);
        // Copy synchronously, in the same task as the render.
        ctx.drawImage(gl.domElement, 0, 0, tw, th, x, y, tw, th);
      }
    }
  } finally {
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    scene.background = prevBackground;
    gl.setClearColor(prevClear, prevClearAlpha);
    gl.setRenderTarget(prevTarget);
    gl.setPixelRatio(prevRatio);
    gl.setSize(prevSize.x, prevSize.y, false);
    handles.invalidate();
  }
  return out;
}

function currentTarget(handles: ViewportHandles): Vector3 {
  const t = new Vector3();
  if (handles.controls) handles.controls.getTarget(t);
  else handles.camera.getWorldDirection(t).add(handles.camera.position);
  return t;
}

/** Build an export camera for a view without touching the interactive camera. */
export function buildExportCamera(
  handles: ViewportHandles,
  loaded: LoadedModelHandle,
  view: ExportView,
  aspect: number,
  selectedIds: string[],
  /** Extra framing room, e.g. for callout labels beside the figure. */
  margin = 1.1,
): PerspectiveCamera {
  const base = handles.camera;
  const cam = base.clone();
  cam.aspect = aspect;
  cam.clearViewOffset();
  const modelBox = new Box3().setFromObject(loaded.model.root, true);

  if (view === "current") {
    // Preserve horizontal coverage when the export is narrower than the viewport.
    if (aspect < base.aspect) {
      const vfov = MathUtils.degToRad(base.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * base.aspect);
      cam.fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
    }
  } else if (view === "selection") {
    const box = boundsForMuscles(loaded.model, loaded.report, selectedIds) ?? modelBox;
    const dir = base.position.clone().sub(currentTarget(handles));
    const pose = poseForBox(box, dir.lengthSq() > 0 ? dir : new Vector3(0, 0, 1), cam.fov, aspect, margin * 1.35);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
  } else {
    const pose = poseForView(view, modelBox, cam.fov, aspect, margin);
    cam.position.copy(pose.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(pose.target);
  }
  cam.near = 0.01;
  cam.far = 100;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

const MAX_CANDIDATES = 24;

/** Points to try for a label anchor: the bbox center, then surface vertices near it on screen. */
function anchorCandidates(anchor: LabelAnchor, camera: PerspectiveCamera): Vector3[] {
  const center = anchorWorldPosition(anchor);
  const pos = anchor.mesh.geometry.getAttribute("position");
  const out: { p: Vector3; d: number }[] = [];
  if (pos) {
    const c2 = center.clone().project(camera);
    const stride = Math.max(1, Math.floor(pos.count / 200));
    for (let i = 0; i < pos.count; i += stride) {
      const p = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(anchor.mesh.matrixWorld);
      const s = p.clone().project(camera);
      out.push({ p, d: (s.x - c2.x) ** 2 + (s.y - c2.y) ** 2 });
    }
    out.sort((a, b) => a.d - b.d);
  }
  return [center, ...out.slice(0, MAX_CANDIDATES).map((o) => o.p)];
}

/**
 * Find a point on the visible surface of a muscle from the camera's point of
 * view by raycasting; returns null if the muscle is fully occluded.
 */
export function visibleLabelPoint(
  loaded: LoadedModelHandle,
  muscleId: string,
  camera: PerspectiveCamera,
): Vector3 | null {
  const anchors = loaded.anchors.get(muscleId);
  if (!anchors?.length) return null;
  const raycaster = new Raycaster();
  const dir = new Vector3();
  const sorted = [...anchors].sort(
    (a, b) =>
      anchorWorldPosition(a).distanceToSquared(camera.position) -
      anchorWorldPosition(b).distanceToSquared(camera.position),
  );
  for (const anchor of sorted) {
    for (const candidate of anchorCandidates(anchor, camera)) {
      dir.copy(candidate).sub(camera.position);
      const dist = dir.length();
      raycaster.set(camera.position, dir.normalize());
      raycaster.far = dist * 1.01 + 0.005;
      const hit = raycaster.intersectObjects(loaded.model.meshes, false)[0];
      if (hit && loaded.report.byMesh.get(hit.object.uuid)?.muscleId === muscleId) return hit.point;
    }
  }
  return null;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function labelText(id: string, language: ExportOptions["language"]): { primary: string; secondary?: string; rtl: boolean } {
  const m = getMuscle(id);
  if (!m) return { primary: id, rtl: false };
  if (language === "ar") return { primary: m.displayName.ar, rtl: true };
  if (language === "both") return { primary: m.displayName.en, secondary: m.displayName.ar, rtl: false };
  return { primary: m.displayName.en, rtl: false };
}

function theme(background: ExportOptions["background"]) {
  return background === "white"
    ? { text: "#111214", muted: "#5b5f66", pill: "rgba(242,242,240,0.96)", border: "#d4d6d9" }
    : { text: "#FFFFFF", muted: "#92969D", pill: "rgba(17,18,20,0.9)", border: "#27292D" };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw callout labels (anchor dot + leader line + name pill) for selected muscles. */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  camera: PerspectiveCamera,
  rect: Rect,
  loaded: LoadedModelHandle,
  opts: Pick<ExportOptions, "doc" | "language" | "background">,
): void {
  const unit = Math.min(rect.w, rect.h);
  const fontSize = Math.max(11, Math.round(unit * 0.024));
  const subSize = Math.round(fontSize * 0.82);
  const pad = Math.round(fontSize * 0.55);
  const t = theme(opts.background);

  type Item = { id: string; ax: number; ay: number; ly: number; color: string; h: number; w: number; text: ReturnType<typeof labelText> };
  const left: Item[] = [];
  const right: Item[] = [];
  const v = new Vector3();

  for (const id of Object.keys(opts.doc.selections)) {
    // Only label muscles with a visible surface in this view (e.g. no glute labels on a front view).
    const point = visibleLabelPoint(loaded, id, camera);
    if (!point) continue;
    v.copy(point).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
    const ax = rect.x + ((v.x + 1) / 2) * rect.w;
    const ay = rect.y + ((1 - v.y) / 2) * rect.h;
    const text = labelText(id, opts.language);
    ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
    let w = ctx.measureText(text.primary).width;
    if (text.secondary) {
      ctx.font = `500 ${subSize}px ${FONT_STACK}`;
      w = Math.max(w, ctx.measureText(text.secondary).width);
    }
    const h = text.secondary ? fontSize + subSize + pad * 2.2 : fontSize + pad * 2;
    const item: Item = {
      id,
      ax,
      ay,
      ly: ay,
      color: highlightColor(id, opts.doc) ?? opts.doc.palette.primary,
      h,
      w: w + pad * 2,
      text,
    };
    (ax < rect.x + rect.w / 2 ? left : right).push(item);
  }

  const margin = Math.round(unit * 0.03);
  const layout = (items: Item[]) => {
    items.sort((a, b) => a.ay - b.ay);
    const gap = Math.round(fontSize * 0.5);
    for (let i = 0; i < items.length; i++) {
      const prev = items[i - 1];
      const min = prev ? prev.ly + prev.h / 2 + gap + items[i].h / 2 : rect.y + margin + items[i].h / 2;
      items[i].ly = Math.max(items[i].ay, min);
    }
    // Pull back up if the stack overflows the bottom edge.
    for (let i = items.length - 1; i >= 0; i--) {
      const next = items[i + 1];
      const max = next ? next.ly - next.h / 2 - gap - items[i].h / 2 : rect.y + rect.h - margin - items[i].h / 2;
      items[i].ly = Math.min(items[i].ly, max);
    }
  };
  layout(left);
  layout(right);

  const draw = (item: Item, side: "left" | "right") => {
    const x = side === "left" ? rect.x + margin : rect.x + rect.w - margin - item.w;
    const y = item.ly - item.h / 2;
    const lineEndX = side === "left" ? x + item.w : x;
    // Leader line
    ctx.strokeStyle = item.color;
    ctx.lineWidth = Math.max(1, fontSize * 0.09);
    ctx.beginPath();
    ctx.moveTo(item.ax, item.ay);
    ctx.lineTo(lineEndX + (side === "left" ? pad : -pad), item.ly);
    ctx.lineTo(lineEndX, item.ly);
    ctx.stroke();
    // Anchor dot
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(item.ax, item.ay, Math.max(2.5, fontSize * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.pill;
    ctx.lineWidth = Math.max(1, fontSize * 0.08);
    ctx.stroke();
    // Pill
    roundRect(ctx, x, y, item.w, item.h, Math.round(fontSize * 0.35));
    ctx.fillStyle = t.pill;
    ctx.fill();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = Math.max(1, fontSize * 0.07);
    ctx.stroke();
    // Text
    ctx.fillStyle = t.text;
    ctx.textBaseline = "top";
    ctx.direction = item.text.rtl ? "rtl" : "ltr";
    ctx.textAlign = item.text.rtl ? "right" : "left";
    const tx = item.text.rtl ? x + item.w - pad : x + pad;
    ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
    ctx.fillText(item.text.primary, tx, y + pad);
    if (item.text.secondary) {
      ctx.font = `500 ${subSize}px ${FONT_STACK}`;
      ctx.fillStyle = t.muted;
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillText(item.text.secondary, x + item.w - pad, y + pad + fontSize + pad * 0.2);
    }
    ctx.direction = "ltr";
    ctx.textAlign = "left";
  };
  left.forEach((i) => draw(i, "left"));
  right.forEach((i) => draw(i, "right"));
}

/** Draw a legend of selected muscles with their colors. */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  opts: Pick<ExportOptions, "doc" | "language" | "background" | "title">,
): void {
  const ids = Object.keys(opts.doc.selections);
  if (!ids.length && !opts.title) return;
  const unit = Math.min(rect.w, rect.h);
  const fontSize = Math.max(11, Math.round(unit * 0.018));
  const lineH = Math.round(fontSize * 1.6);
  const margin = Math.round(unit * 0.035);
  const t = theme(opts.background);
  const rtl = opts.language === "ar";

  if (opts.title) {
    ctx.font = `700 ${Math.round(fontSize * 1.5)}px ${FONT_STACK}`;
    ctx.fillStyle = t.text;
    ctx.textBaseline = "top";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(opts.title, rtl ? rect.x + rect.w - margin : rect.x + margin, rect.y + margin);
  }

  let y = rect.y + rect.h - margin - ids.length * lineH;
  ctx.textBaseline = "middle";
  for (const id of ids) {
    const m = getMuscle(id);
    if (!m) continue;
    const color = highlightColor(id, opts.doc) ?? opts.doc.palette.primary;
    const name =
      opts.language === "ar"
        ? m.displayName.ar
        : opts.language === "both"
          ? `${m.displayName.en} · ${m.displayName.ar}`
          : m.displayName.en;
    const sw = Math.round(fontSize * 0.9);
    const cy = y + lineH / 2;
    const swX = rtl ? rect.x + rect.w - margin - sw : rect.x + margin;
    roundRect(ctx, swX, cy - sw / 2, sw, sw, Math.round(sw * 0.25));
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = `500 ${fontSize}px ${FONT_STACK}`;
    ctx.fillStyle = t.text;
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(name, rtl ? swX - fontSize * 0.6 : swX + sw + fontSize * 0.6, cy);
    y += lineH;
  }
  ctx.direction = "ltr";
  ctx.textAlign = "left";
}

/** Render a complete illustration (one or more panels + labels + legend). */
export async function renderIllustration(opts: ExportOptions): Promise<HTMLCanvasElement> {
  const handles = viewportBridge.handles;
  const loaded = viewportBridge.loaded;
  if (!handles || !loaded) throw new Error("The 3D viewport is not ready. Load a model first.");
  const W = Math.round(MathUtils.clamp(opts.width, 16, MAX_EXPORT_SIDE));
  const H = Math.round(MathUtils.clamp(opts.height, 16, MAX_EXPORT_SIDE));
  const views = opts.views.length ? opts.views : (["current"] as ExportView[]);

  await waitForFrames(handles, 2);

  const out = createCanvas(W, H);
  const ctx = ctx2d(out);
  if (opts.background !== "transparent") {
    ctx.fillStyle = BACKGROUND_HEX[opts.background];
    ctx.fillRect(0, 0, W, H);
  }
  const selectedIds = Object.keys(opts.doc.selections);
  const panelW = Math.floor(W / views.length);
  views.forEach((view, i) => {
    const rect = { x: i * panelW, y: 0, w: i === views.length - 1 ? W - i * panelW : panelW, h: H };
    const margin = opts.labels && selectedIds.length ? 1.45 : 1.1;
    const cam = buildExportCamera(handles, loaded, view, rect.w / rect.h, selectedIds, margin);
    const img = renderSceneToCanvas(handles, cam, rect.w, rect.h, opts.background);
    ctx.drawImage(img, rect.x, rect.y);
    if (opts.labels) drawLabels(ctx, cam, rect, loaded, opts);
  });
  if (opts.legend) drawLegend(ctx, { x: 0, y: 0, w: W, h: H }, opts);
  if (opts.watermark) {
    const size = Math.max(10, Math.round(Math.min(W, H) * 0.016));
    ctx.font = `600 ${size}px ${FONT_STACK}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = opts.background === "white" ? "rgba(17,18,20,0.6)" : "rgba(245,165,36,0.85)";
    ctx.fillText(opts.watermark, W - size, H - size);
    ctx.textAlign = "left";
  }
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))), type, quality),
  );
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas, "image/png");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Small JPEG preview of the current camera for project cards. */
export async function captureThumbnail(doc: ExportOptions["doc"], background: IllustrationDoc["background"]): Promise<string | null> {
  if (!viewportBridge.handles || !viewportBridge.loaded) return null;
  const canvas = await renderIllustration({
    width: 480,
    height: 360,
    background: background === "transparent" ? "black" : background,
    views: ["current"],
    labels: false,
    legend: false,
    language: "en",
    doc,
  });
  return canvas.toDataURL("image/jpeg", 0.82);
}
