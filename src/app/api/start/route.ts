import { NextResponse } from "next/server";
import { parseJSON, queryModel } from "@/lib/llm";
import {
  DEFAULT_USER_MODEL,
  type Complexity,
  type LearningSession,
  type LearningStep,
} from "@/lib/types";
import { LEARNING_PATH_SYSTEM, buildLearningPathPrompt } from "@/lib/prompts";
import { getClientIp, tryConsumeSession } from "@/lib/rateLimit";
import { MAX_TOPIC_LENGTH, isValidModel } from "@/lib/validate";

export const maxDuration = 60;

const COMPLEXITIES: readonly Complexity[] = ["foundation", "core", "intermediate", "advanced"];
const MAX_STEPS = 7;

interface PathResponse {
  steps: Array<{
    id?: number;
    title?: string;
    complexity?: string;
    prerequisites?: number[];
  }>;
}

export async function POST(request: Request) {
  let body: { topic?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const topic = body.topic?.trim();
  if (!topic || topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json(
      { error: `topic is required (max ${MAX_TOPIC_LENGTH} characters)` },
      { status: 400 },
    );
  }
  if (!isValidModel(body.model)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  const model = body.model;

  // Consume rate-limit budget only for requests that reach the LLM.
  const limit = tryConsumeSession(getClientIp(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Session limit reached for this IP. Try again in 24 hours." },
      { status: 429 },
    );
  }

  let parsed: PathResponse;
  try {
    const raw = await queryModel(model, buildLearningPathPrompt(topic), LEARNING_PATH_SYSTEM);
    parsed = parseJSON<PathResponse>(raw);
  } catch (err) {
    console.error("[/api/start] learning path generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate a learning path. Please try again." },
      { status: 502 },
    );
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return NextResponse.json(
      { error: "The model did not return a valid learning path. Please try again." },
      { status: 502 },
    );
  }

  // Normalize untrusted model output: stable sequential ids, valid complexity
  // values, prerequisites that only reference earlier steps.
  const learningPath: LearningStep[] = parsed.steps
    .slice(0, MAX_STEPS)
    .filter((s) => typeof s.title === "string" && s.title.trim())
    .map((s, i) => ({
      id: i + 1,
      title: (s.title as string).trim(),
      complexity: COMPLEXITIES.includes(s.complexity as Complexity)
        ? (s.complexity as Complexity)
        : "core",
      prerequisites: (Array.isArray(s.prerequisites) ? s.prerequisites : []).filter(
        (p): p is number => typeof p === "number" && p >= 1 && p <= i,
      ),
      content: null,
      completed: false,
    }));

  if (learningPath.length === 0) {
    return NextResponse.json(
      { error: "The model did not return a valid learning path. Please try again." },
      { status: 502 },
    );
  }

  const session: LearningSession = {
    topic,
    model,
    learningPath,
    currentStepIndex: 0,
    userModel: { ...DEFAULT_USER_MODEL },
    history: [],
  };

  return NextResponse.json({ session });
}
