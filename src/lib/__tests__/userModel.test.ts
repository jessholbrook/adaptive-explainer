import { describe, expect, it } from "vitest";
import type { UserKnowledgeModel } from "../types";
import { lowerLevel, mergeUserModel, simplerAdjustment } from "../userModel";

const current: UserKnowledgeModel = {
  level: "intermediate",
  confidence: 0.5,
  knownConcepts: ["DNS", "TCP"],
  gapConcepts: ["certificates"],
  vocabularyLevel: "technical",
  reasoning: "Baseline.",
};

describe("mergeUserModel", () => {
  it("returns the current model when the update is missing or not an object", () => {
    expect(mergeUserModel(current, undefined)).toEqual(current);
    expect(mergeUserModel(current, null)).toEqual(current);
    expect(mergeUserModel(current, "garbage" as never)).toEqual(current);
  });

  it("accepts valid enum values and rejects invalid ones", () => {
    expect(mergeUserModel(current, { level: "advanced" }).level).toBe("advanced");
    expect(mergeUserModel(current, { level: "expert" as never }).level).toBe("intermediate");
    expect(
      mergeUserModel(current, { vocabularyLevel: "casual" as never }).vocabularyLevel,
    ).toBe("technical");
  });

  it("clamps confidence to [0, 1] and ignores non-finite values", () => {
    expect(mergeUserModel(current, { confidence: 1.7 }).confidence).toBe(1);
    expect(mergeUserModel(current, { confidence: -3 }).confidence).toBe(0);
    expect(mergeUserModel(current, { confidence: NaN }).confidence).toBe(0.5);
  });

  it("accumulates known concepts with case-insensitive dedup", () => {
    const merged = mergeUserModel(current, { knownConcepts: ["dns", "TLS"] });
    expect(merged.knownConcepts).toEqual(["DNS", "TCP", "TLS"]);
  });

  it("replaces gap concepts (a resolved gap disappears)", () => {
    const merged = mergeUserModel(current, { gapConcepts: ["handshakes"] });
    expect(merged.gapConcepts).toEqual(["handshakes"]);
  });

  it("keeps existing gaps when the update omits them", () => {
    expect(mergeUserModel(current, {}).gapConcepts).toEqual(["certificates"]);
  });

  it("filters non-string entries from concept lists", () => {
    const merged = mergeUserModel(current, {
      knownConcepts: ["ok", 42, null] as never,
    });
    expect(merged.knownConcepts).toEqual(["DNS", "TCP", "ok"]);
  });

  it("caps concept list length at 50", () => {
    const many = Array.from({ length: 80 }, (_, i) => `concept-${i}`);
    expect(mergeUserModel(current, { knownConcepts: many }).knownConcepts).toHaveLength(50);
  });

  it("truncates oversized reasoning", () => {
    const merged = mergeUserModel(current, { reasoning: "x".repeat(5000) });
    expect(merged.reasoning).toHaveLength(1000);
  });
});

describe("lowerLevel", () => {
  it("steps down one level and floors at beginner", () => {
    expect(lowerLevel("advanced")).toBe("intermediate");
    expect(lowerLevel("intermediate")).toBe("beginner");
    expect(lowerLevel("beginner")).toBe("beginner");
  });
});

describe("simplerAdjustment", () => {
  it("lowers level, resets vocabulary, and reduces confidence with a floor", () => {
    const adjusted = simplerAdjustment(current);
    expect(adjusted.level).toBe("beginner");
    expect(adjusted.vocabularyLevel).toBe("everyday");
    expect(adjusted.confidence).toBeCloseTo(0.4);
    expect(simplerAdjustment({ ...current, confidence: 0.15 }).confidence).toBe(0.1);
  });
});
