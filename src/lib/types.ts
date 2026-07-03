export type Level = "beginner" | "intermediate" | "advanced";
export type Complexity = "foundation" | "core" | "intermediate" | "advanced";
export type VocabularyLevel = "everyday" | "technical" | "expert";

export interface LearningStep {
  id: number;
  title: string;
  complexity: Complexity;
  prerequisites: number[];
  content: string | null;
  completed: boolean;
}

export interface UserKnowledgeModel {
  level: Level;
  confidence: number;
  knownConcepts: string[];
  gapConcepts: string[];
  vocabularyLevel: VocabularyLevel;
  reasoning: string;
}

export interface InteractionRecord {
  type: "explanation" | "question" | "simpler" | "advance";
  stepId: number;
  content: string;
  timestamp: number;
}

export interface LearningSession {
  topic: string;
  model: string;
  learningPath: LearningStep[];
  currentStepIndex: number;
  userModel: UserKnowledgeModel;
  history: InteractionRecord[];
}

export interface ModelInfo {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
];

export const DEFAULT_USER_MODEL: UserKnowledgeModel = {
  level: "beginner",
  confidence: 0.3,
  knownConcepts: [],
  gapConcepts: [],
  vocabularyLevel: "everyday",
  reasoning: "Starting assumption — no prior signal yet.",
};
