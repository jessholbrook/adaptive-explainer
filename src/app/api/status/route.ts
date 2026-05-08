import { NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/types";
import { getClientIp, getStatus } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = getStatus(ip);
  const models = AVAILABLE_MODELS.filter((m) => {
    if (m.provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
    return Boolean(process.env.OPENAI_API_KEY);
  });
  return NextResponse.json({ models, rateLimit });
}
