import { NextResponse } from "next/server";
import { parseJSON, queryModel } from "@/lib/llm";
import {
  DEFAULT_USER_MODEL,
  type LearningSession,
  type LearningStep,
} from "@/lib/types";
import { LEARNING_PATH_SYSTEM, buildLearningPathPrompt } from "@/lib/prompts";
import { getClientIp, tryConsumeSession } from "@/lib/rateLimit";

interface PathResponse {
  steps: Array<{
    id: number;
    title: string;
    complexity: LearningStep["complexity"];
    prerequisites: number[];
  }>;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = tryConsumeSession(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Session limit reached for this IP. Try again later." },
      { status: 429 },
    );
  }

  let body: { topic?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const topic = body.topic?.trim();
  const model = body.model?.trim();
  if (!topic || !model) {
    return NextResponse.json(
      { error: "topic and model are required" },
      { status: 400 },
    );
  }

  let parsed: PathResponse;
  try {
    const raw = await queryModel(
      model,
      buildLearningPathPrompt(topic),
      LEARNING_PATH_SYSTEM,
    );
    parsed = parseJSON<PathResponse>(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate learning path: ${message}` },
      { status: 502 },
    );
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return NextResponse.json(
      { error: "Model did not return a valid learning path" },
      { status: 502 },
    );
  }

  const learningPath: LearningStep[] = parsed.steps.map((s, i) => ({
    id: s.id ?? i + 1,
    title: s.title,
    complexity: s.complexity,
    prerequisites: s.prerequisites ?? [],
    content: null,
    completed: false,
  }));

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
