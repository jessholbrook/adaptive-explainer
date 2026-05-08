import { NextResponse } from "next/server";
import { parseJSON, queryModel } from "@/lib/llm";
import type { LearningSession, UserKnowledgeModel } from "@/lib/types";
import { QUESTION_SYSTEM, buildQuestionAnalysisPrompt } from "@/lib/prompts";

interface QuestionResponse {
  answer: string;
  modelUpdate: UserKnowledgeModel;
}

export async function POST(request: Request) {
  let body: { session?: LearningSession; question?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session, question, model } = body;
  if (!session || !question?.trim() || !model) {
    return NextResponse.json(
      { error: "session, question, and model are required" },
      { status: 400 },
    );
  }

  const step = session.learningPath[session.currentStepIndex];
  if (!step) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

  try {
    const raw = await queryModel(
      model,
      buildQuestionAnalysisPrompt(session.topic, step.title, question, session.userModel),
      QUESTION_SYSTEM,
    );
    const parsed = parseJSON<QuestionResponse>(raw);

    const merged: UserKnowledgeModel = {
      level: parsed.modelUpdate.level ?? session.userModel.level,
      confidence:
        typeof parsed.modelUpdate.confidence === "number"
          ? clamp01(parsed.modelUpdate.confidence)
          : session.userModel.confidence,
      knownConcepts: dedup([
        ...session.userModel.knownConcepts,
        ...(parsed.modelUpdate.knownConcepts ?? []),
      ]),
      gapConcepts: dedup(parsed.modelUpdate.gapConcepts ?? session.userModel.gapConcepts),
      vocabularyLevel: parsed.modelUpdate.vocabularyLevel ?? session.userModel.vocabularyLevel,
      reasoning: parsed.modelUpdate.reasoning ?? session.userModel.reasoning,
    };

    return NextResponse.json({ answer: parsed.answer, updatedModel: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to answer question: ${message}` },
      { status: 502 },
    );
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function dedup(items: string[]): string[] {
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
