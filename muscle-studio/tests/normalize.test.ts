import { describe, expect, it } from "vitest";
import { normalizeMeshName, normalizeSearchText } from "@/lib/anatomy/normalize";

describe("normalizeMeshName", () => {
  it.each([
    ["Pectoralis_Major_L", "pectoralis major", "left"],
    ["pectoralis-major.R.001", "pectoralis major", "right"],
    ["LatissimusDorsi_Left", "latissimus dorsi", "left"],
    ["Right Biceps Brachii", "biceps brachii", "right"],
    ["Left_Triceps_Brachii", "triceps brachii", "left"],
    ["Brachialis_Muscle_L", "brachialis", "left"],
    ["Trapezius_L.001", "trapezius", "left"],
    ["Rectus_Abdominis", "rectus abdominis", "center"],
    ["VMO_L", "vmo", "left"],
    // GLTFLoader-sanitized forms of "Trapezius_L.001" and "Teres_Major.R"
    ["Trapezius_L001", "trapezius", "left"],
    ["Teres_MajorR", "teres major", "right"],
    ["Biceps_Brachii_L_1", "biceps brachii", "left"],
  ])("%s → %s (%s)", (raw, key, side) => {
    expect(normalizeMeshName(raw)).toEqual({ key, side });
  });

  it("does not strip a lone side-like token", () => {
    expect(normalizeMeshName("L").key).toBe("l");
  });
});

describe("normalizeSearchText", () => {
  it("unifies Arabic letter variants and removes diacritics", () => {
    expect(normalizeSearchText("العضلةُ الأمامية")).toBe("العضله الاماميه");
  });
});
