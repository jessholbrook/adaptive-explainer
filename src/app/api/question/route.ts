import { NextResponse } from "next/server";
import { parseJSON, queryModel } from "@/lib/llm";
import type { LearningSession, UserKnowledgeModel } from "@/lib/types";
import { QUESTION_SYSTEM, buildQuestionAnalysisPrompt } from "@/lib/prompts";
import { getClientIp, tryConsumeRequest } from "@/lib/rateLimit";
import { MAX_QUESTION_LENGTH, isValidModel, sessionError } from "@/lib/validate";
import { mergeUserModel } from "@/lib/userModel";

export const maxDuration = 60;

interface QuestionResponse {
  answer: string;
  modelUpdate: Partial<UserKnowledgeModel>;
}

export async function POST(request: Request) {
  let body: { session?: LearningSession; question?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session } = body;
  const question = body.question?.trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `question is required (max ${MAX_QUESTION_LENGTH} characters)` },
      { status: 400 },
    );
  }
  if (!isValidModel(body.model)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  const model = body.model;
  const invalid = sessionError(session);
  if (invalid) {
    return NextResponse.json({ error: `Invalid session: ${invalid}` }, { status: 400 });
  }

  const step = session!.learningPath[session!.currentStepIndex];
  if (!step) {
    return NextResponse.json({ error: "Invalid step index" }, { status: 400 });
  }

  // Consume rate-limit budget only for requests that reach the LLM.
  const limit = tryConsumeRequest(getClientIp(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Request limit reached for this IP. Try again in 24 hours." },
      { status: 429 },
    );
  }

  try {
    const priorQuestions = (session!.history ?? [])
      .filter((h) => h.type === "question")
      .slice(-5)
      .map((h) => h.content);
    const raw = await queryModel(
      model,
      buildQuestionAnalysisPrompt(
        session!.topic,
        step.title,
        question,
        session!.userModel,
        priorQuestions,
      ),
      QUESTION_SYSTEM,
    );
    const parsed = parseJSON<QuestionResponse>(raw);
    if (typeof parsed.answer !== "string" || !parsed.answer) {
      throw new Error("Model response missing answer");
    }

    const merged = mergeUserModel(session!.userModel, parsed.modelUpdate);
    return NextResponse.json({ answer: parsed.answer, updatedModel: merged });
  } catch (err) {
    console.error("[/api/question] failed:", err);
    return NextResponse.json(
      { error: "Failed to answer the question. Please try again." },
      { status: 502 },
    );
  }
}
