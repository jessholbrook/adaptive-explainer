import { NextResponse } from "next/server";
import { streamModel } from "@/lib/llm";
import type { LearningSession } from "@/lib/types";
import {
  EXPLANATION_SYSTEM,
  SIMPLER_SYSTEM,
  buildExplanationPrompt,
  buildSimplerExplanationPrompt,
} from "@/lib/prompts";
import { getClientIp, tryConsumeRequest } from "@/lib/rateLimit";
import { isValidModel, sessionError } from "@/lib/validate";

export const maxDuration = 60;

function recentQuestions(session: LearningSession): string[] {
  return (session.history ?? [])
    .filter((h) => h.type === "question")
    .slice(-5)
    .map((h) => h.content);
}

export async function POST(request: Request) {
  let body: { session?: LearningSession; model?: string; simpler?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session, simpler } = body;
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

  const chunks =
    simpler && step.content
      ? streamModel(
          model,
          buildSimplerExplanationPrompt(session!.topic, step.title, step.content),
          SIMPLER_SYSTEM,
        )
      : streamModel(
          model,
          buildExplanationPrompt(
            session!.topic,
            step.title,
            step.complexity,
            session!.userModel,
            session!.learningPath.slice(0, session!.currentStepIndex).map((s) => s.title),
            recentQuestions(session!),
          ),
          EXPLANATION_SYSTEM,
        );

  // Pull the first chunk before responding: generator setup errors (missing
  // key, bad request, provider auth) become a clean 502 instead of a broken
  // stream after a 200 has already been sent.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (err) {
    console.error("[/api/explain] failed to start stream:", err);
    return NextResponse.json(
      { error: "Failed to generate an explanation. Please try again." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done && first.value) {
          controller.enqueue(encoder.encode(first.value));
        }
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("[/api/explain] stream failed:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
