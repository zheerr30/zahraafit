import { z } from "zod";

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const hex = z.string().regex(HEX_COLOR, "Expected a #RRGGBB color");
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const toneSchema = z.enum(["primary", "secondary"]);

export const muscleSelectionSchema = z.object({
  tone: toneSchema,
  /** Optional per-muscle override; falls back to the palette color for the tone. */
  color: hex.nullable().default(null),
});

export const paletteSchema = z.object({
  primary: hex,
  secondary: hex,
  base: hex,
  shadow: hex,
});

export const viewSchema = z.enum(["front", "back", "left", "right"]);

export const illustrationDocSchema = z.object({
  gender: z.enum(["male", "female"]),
  selections: z.record(z.string(), muscleSelectionSchema),
  palette: paletteSchema,
  background: z.enum(["black", "white", "transparent"]),
  lighting: z.number().min(0).max(3),
  modelScale: z.number().min(0.25).max(3),
  modelOffsetY: z.number().min(-2).max(2),
  showLabels: z.boolean(),
  showSelectedNames: z.boolean(),
  labelLanguage: z.enum(["en", "ar", "both"]),
  dimUnselected: z.boolean(),
  materialMode: z.enum(["studio", "original"]),
});

export const cameraStateSchema = z.object({
  view: viewSchema.nullable(),
  position: vec3,
  target: vec3,
});

export const PROJECT_SCHEMA_VERSION = 1;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  version: z.literal(PROJECT_SCHEMA_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Asset id the project was authored with (informational). */
  assetId: z.string().nullable(),
  doc: illustrationDocSchema,
  camera: cameraStateSchema.nullable(),
  /** Small JPEG/PNG data URL preview. */
  thumbnail: z.string().nullable(),
});

export type MuscleTone = z.infer<typeof toneSchema>;
export type MuscleSelection = z.infer<typeof muscleSelectionSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type IllustrationDoc = z.infer<typeof illustrationDocSchema>;
export type CameraState = z.infer<typeof cameraStateSchema>;
export type Project = z.infer<typeof projectSchema>;

export const DEFAULT_PALETTE: Palette = {
  primary: "#E8602C",
  secondary: "#EEA585",
  base: "#F2F2F0",
  shadow: "#C9CBCD",
};

export function createDefaultDoc(gender: IllustrationDoc["gender"] = "male"): IllustrationDoc {
  return {
    gender,
    selections: {},
    palette: { ...DEFAULT_PALETTE },
    background: "black",
    lighting: 1,
    modelScale: 1,
    modelOffsetY: 0,
    showLabels: false,
    showSelectedNames: true,
    labelLanguage: "en",
    dimUnselected: false,
    materialMode: "studio",
  };
}
