import { AVAILABLE_MODELS, type LearningSession } from "./types";

export const MAX_TOPIC_LENGTH = 200;
export const MAX_QUESTION_LENGTH = 1000;

const MAX_STEPS = 10;
const MAX_TITLE_LENGTH = 300;
const MAX_CONTENT_LENGTH = 20_000;
const MAX_CONCEPTS = 50;
const MAX_CONCEPT_LENGTH = 120;
const MAX_REASONING_LENGTH = 1000;
const MAX_HISTORY_ENTRIES = 200;
const MAX_HISTORY_CONTENT_LENGTH = MAX_QUESTION_LENGTH;

export function isValidModel(model: unknown): model is string {
  return typeof model === "string" && AVAILABLE_MODELS.some((m) => m.id === model);
}

/**
 * Structural and size validation for a client-supplied session. Returns an
 * error message, or null if the session is acceptable. Sessions are
 * client-held state, so every field is untrusted.
 */
export function sessionError(session: unknown): string | null {
  if (!session || typeof session !== "object") return "session must be an object";
  const s = session as Partial<LearningSession>;

  if (typeof s.topic !== "string" || !s.topic.trim()) return "session.topic is required";
  if (s.topic.length > MAX_TOPIC_LENGTH) return "session.topic is too long";

  if (!Array.isArray(s.learningPath) || s.learningPath.length === 0) {
    return "session.learningPath is required";
  }
  if (s.learningPath.length > MAX_STEPS) return "session.learningPath has too many steps";
  for (const step of s.learningPath) {
    if (!step || typeof step !== "object") return "invalid step in learningPath";
    if (typeof step.title !== "string" || step.title.length > MAX_TITLE_LENGTH) {
      return "invalid step title";
    }
    if (
      step.content !== null &&
      (typeof step.content !== "string" || step.content.length > MAX_CONTENT_LENGTH)
    ) {
      return "step content is too large";
    }
  }

  if (
    typeof s.currentStepIndex !== "number" ||
    !Number.isInteger(s.currentStepIndex) ||
    s.currentStepIndex < 0
  ) {
    return "invalid currentStepIndex";
  }

  const m = s.userModel;
  if (!m || typeof m !== "object") return "session.userModel is required";
  for (const list of [m.knownConcepts, m.gapConcepts]) {
    if (!Array.isArray(list) || list.length > MAX_CONCEPTS) return "invalid concept list";
    for (const c of list) {
      if (typeof c !== "string" || c.length > MAX_CONCEPT_LENGTH) return "invalid concept";
    }
  }
  if (typeof m.reasoning !== "string" || m.reasoning.length > MAX_REASONING_LENGTH) {
    return "invalid userModel.reasoning";
  }

  if (s.history !== undefined) {
    if (!Array.isArray(s.history) || s.history.length > MAX_HISTORY_ENTRIES) {
      return "invalid history";
    }
    for (const entry of s.history) {
      if (!entry || typeof entry !== "object") return "invalid history entry";
      if (
        typeof entry.content !== "string" ||
        entry.content.length > MAX_HISTORY_CONTENT_LENGTH
      ) {
        return "invalid history entry content";
      }
    }
  }

  return null;
}
