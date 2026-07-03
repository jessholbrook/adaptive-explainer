import { describe, expect, it } from "vitest";
import type { LearningSession } from "../types";
import { isValidModel, sessionError } from "../validate";
import { AVAILABLE_MODELS, DEFAULT_USER_MODEL } from "../types";

function validSession(): LearningSession {
  return {
    topic: "How does HTTPS work?",
    model: AVAILABLE_MODELS[0].id,
    learningPath: [
      {
        id: 1,
        title: "What encryption is for",
        complexity: "foundation",
        prerequisites: [],
        content: null,
        completed: false,
      },
    ],
    currentStepIndex: 0,
    userModel: { ...DEFAULT_USER_MODEL },
    history: [],
  };
}

describe("isValidModel", () => {
  it("accepts every model in the allowlist", () => {
    for (const m of AVAILABLE_MODELS) {
      expect(isValidModel(m.id)).toBe(true);
    }
  });

  it("rejects unknown models and non-strings", () => {
    expect(isValidModel("gpt-5-ultra")).toBe(false);
    expect(isValidModel("claude-anything")).toBe(false);
    expect(isValidModel(undefined)).toBe(false);
    expect(isValidModel(42)).toBe(false);
  });
});

describe("sessionError", () => {
  it("accepts a well-formed session", () => {
    expect(sessionError(validSession())).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(sessionError(null)).toMatch(/object/);
    expect(sessionError("hi")).toMatch(/object/);
  });

  it("rejects a missing or oversized topic", () => {
    expect(sessionError({ ...validSession(), topic: "" })).toMatch(/topic/);
    expect(sessionError({ ...validSession(), topic: "x".repeat(300) })).toMatch(/topic/);
  });

  it("rejects an empty or oversized learning path", () => {
    expect(sessionError({ ...validSession(), learningPath: [] })).toMatch(/learningPath/);
    const s = validSession();
    const step = s.learningPath[0];
    expect(
      sessionError({ ...s, learningPath: Array.from({ length: 11 }, () => step) }),
    ).toMatch(/steps/);
  });

  it("rejects oversized step content", () => {
    const s = validSession();
    s.learningPath[0].content = "x".repeat(30_000);
    expect(sessionError(s)).toMatch(/content/);
  });

  it("rejects an invalid step index", () => {
    expect(sessionError({ ...validSession(), currentStepIndex: -1 })).toMatch(/StepIndex/);
    expect(sessionError({ ...validSession(), currentStepIndex: 1.5 })).toMatch(/StepIndex/);
  });

  it("rejects oversized concept lists", () => {
    const s = validSession();
    s.userModel.knownConcepts = Array.from({ length: 60 }, (_, i) => `c${i}`);
    expect(sessionError(s)).toMatch(/concept/);
  });

  it("rejects oversized history entries", () => {
    const s = validSession();
    s.history = [
      { type: "question", stepId: 0, content: "x".repeat(2000), timestamp: 0 },
    ];
    expect(sessionError(s)).toMatch(/history/);
  });

  it("accepts a session without history", () => {
    const s = validSession() as Partial<LearningSession>;
    delete s.history;
    expect(sessionError(s)).toBeNull();
  });
});
