import { NextResponse } from "next/server";
import { queryModel } from "@/lib/llm";
import type { LearningSession } from "@/lib/types";
import {
  EXPLANATION_SYSTEM,
  SIMPLER_SYSTEM,
  buildExplanationPrompt,
  buildSimplerExplanationPrompt,
} from "@/lib/prompts";

export async function POST(request: Request) {
  let body: { session?: LearningSession; model?: string; simpler?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session, model, simpler } = body;
  if (!session || !model) {
    return NextResponse.json(
      { error: "session and model are required" },
      { status: 400 },
    );
  }

  const step = session.learningPath[session.currentStepIndex];
  if (!step) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

  try {
    let explanation: string;
    if (simpler && step.content) {
      explanation = await queryModel(
        model,
        buildSimplerExplanationPrompt(session.topic, step.title, step.content),
        SIMPLER_SYSTEM,
      );
    } else {
      const priorTitles = session.learningPath
        .slice(0, session.currentStepIndex)
        .map((s) => s.title);
      explanation = await queryModel(
        model,
        buildExplanationPrompt(
          session.topic,
          step.title,
          step.complexity,
          session.userModel,
          priorTitles,
        ),
        EXPLANATION_SYSTEM,
      );
    }

    const updatedModel = simpler
      ? {
          ...session.userModel,
          level: lower(session.userModel.level),
          vocabularyLevel: "everyday" as const,
          confidence: Math.max(0.1, session.userModel.confidence - 0.1),
          reasoning: "Learner asked for a simpler explanation.",
        }
      : session.userModel;

    return NextResponse.json({ explanation, updatedModel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate explanation: ${message}` },
      { status: 502 },
    );
  }
}

function lower(level: LearningSession["userModel"]["level"]): LearningSession["userModel"]["level"] {
  if (level === "advanced") return "intermediate";
  if (level === "intermediate") return "beginner";
  return "beginner";
}
