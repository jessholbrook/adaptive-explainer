import type { Level, UserKnowledgeModel, VocabularyLevel } from "./types";

const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];
const VOCABULARY_LEVELS: readonly VocabularyLevel[] = ["everyday", "technical", "expert"];
const MAX_CONCEPTS = 50;
const MAX_REASONING_LENGTH = 1000;

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function dedupConcepts(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function isLevel(v: unknown): v is Level {
  return typeof v === "string" && LEVELS.includes(v as Level);
}

function isVocabularyLevel(v: unknown): v is VocabularyLevel {
  return typeof v === "string" && VOCABULARY_LEVELS.includes(v as VocabularyLevel);
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Merge an LLM-produced model update into the current model. Every field of
 * the update is untrusted: enums are validated, numbers clamped, lists
 * deduplicated and capped. Known concepts accumulate; gaps are replaced
 * (a resolved gap should disappear).
 */
export function mergeUserModel(
  current: UserKnowledgeModel,
  update: Partial<UserKnowledgeModel> | undefined | null,
): UserKnowledgeModel {
  if (!update || typeof update !== "object") return current;
  return {
    level: isLevel(update.level) ? update.level : current.level,
    confidence:
      typeof update.confidence === "number" && Number.isFinite(update.confidence)
        ? clamp01(update.confidence)
        : current.confidence,
    knownConcepts: dedupConcepts([
      ...current.knownConcepts,
      ...stringList(update.knownConcepts),
    ]).slice(0, MAX_CONCEPTS),
    gapConcepts: dedupConcepts(
      update.gapConcepts !== undefined ? stringList(update.gapConcepts) : current.gapConcepts,
    ).slice(0, MAX_CONCEPTS),
    vocabularyLevel: isVocabularyLevel(update.vocabularyLevel)
      ? update.vocabularyLevel
      : current.vocabularyLevel,
    reasoning:
      typeof update.reasoning === "string" && update.reasoning
        ? update.reasoning.slice(0, MAX_REASONING_LENGTH)
        : current.reasoning,
  };
}

export function lowerLevel(level: Level): Level {
  if (level === "advanced") return "intermediate";
  return "beginner";
}

/** Deterministic model shift applied when the learner asks for a simpler explanation. */
export function simplerAdjustment(model: UserKnowledgeModel): UserKnowledgeModel {
  return {
    ...model,
    level: lowerLevel(model.level),
    vocabularyLevel: "everyday",
    confidence: Math.max(0.1, model.confidence - 0.1),
    reasoning: "Learner asked for a simpler explanation.",
  };
}
