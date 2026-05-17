"use client";

import { useEffect, useState } from "react";
import type { LearningSession, ModelInfo, UserKnowledgeModel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "idle" | "starting" | "explaining" | "asking" | "simplifying";

interface QAPair {
  question: string;
  answer: string;
}

export default function Page() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [topic, setTopic] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [session, setSession] = useState<LearningSession | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState("");
  const [qaHistory, setQaHistory] = useState<Record<number, QAPair[]>>({});

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data: { models: ModelInfo[] }) => {
        setModels(data.models);
        if (data.models[0]) setSelectedModel(data.models[0].id);
      })
      .catch(() => setError("Failed to load model list."));
  }, []);

  async function startLearning() {
    if (!topic.trim() || !selectedModel) return;
    setStatus("starting");
    setError(null);
    setQaHistory({});
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), model: selectedModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      const newSession: LearningSession = data.session;
      await loadExplanation(newSession, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setStatus("idle");
    }
  }

  async function loadExplanation(s: LearningSession, simpler: boolean) {
    setStatus(simpler ? "simplifying" : "explaining");
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: s, model: s.model, simpler }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to explain");
      const updated: LearningSession = {
        ...s,
        userModel: data.updatedModel,
        learningPath: s.learningPath.map((step, idx) =>
          idx === s.currentStepIndex ? { ...step, content: data.explanation } : step,
        ),
      };
      setSession(updated);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to explain");
      setStatus("idle");
    }
  }

  async function askQuestion() {
    if (!session || !questionInput.trim()) return;
    const q = questionInput.trim();
    setStatus("asking");
    setError(null);
    setQuestionInput("");
    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, question: q, model: session.model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to answer");
      const stepId = session.currentStepIndex;
      setQaHistory((prev) => ({
        ...prev,
        [stepId]: [...(prev[stepId] ?? []), { question: q, answer: data.answer }],
      }));
      setSession({ ...session, userModel: data.updatedModel });
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to answer");
      setStatus("idle");
    }
  }

  function advanceStep() {
    if (!session) return;
    const nextIndex = session.currentStepIndex + 1;
    const updatedPath = session.learningPath.map((step, idx) =>
      idx === session.currentStepIndex ? { ...step, completed: true } : step,
    );
    const updatedModel: UserKnowledgeModel = {
      ...session.userModel,
      confidence: Math.min(1, session.userModel.confidence + 0.1),
    };
    if (nextIndex >= session.learningPath.length) {
      setSession({
        ...session,
        learningPath: updatedPath,
        userModel: updatedModel,
        currentStepIndex: nextIndex,
      });
      return;
    }
    const advanced: LearningSession = {
      ...session,
      learningPath: updatedPath,
      userModel: updatedModel,
      currentStepIndex: nextIndex,
    };
    void loadExplanation(advanced, false);
  }

  function reset() {
    setSession(null);
    setTopic("");
    setQaHistory({});
    setError(null);
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-3xl">Adaptive Explainer</CardTitle>
            <CardDescription className="text-base">
              Type a topic and an AI tutor will build a 5-step lesson tailored to
              what you know.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. How does HTTPS work?"
                disabled={status === "starting"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void startLearning();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={selectedModel}
                onValueChange={(v) => setSelectedModel(String(v))}
                disabled={status === "starting" || models.length === 0}
              >
                <SelectTrigger id="model" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {models.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No models available — check your API keys.
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => void startLearning()}
              disabled={!topic.trim() || !selectedModel || status === "starting"}
            >
              {status === "starting" ? "Building your lesson…" : "Start Learning"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentStep = session.learningPath[session.currentStepIndex];
  const allDone = session.currentStepIndex >= session.learningPath.length;
  const currentQA = qaHistory[session.currentStepIndex] ?? [];

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Topic</p>
                <CardTitle className="text-2xl">{session.topic}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                New topic
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {allDone ? (
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold mb-3">Lesson complete.</h2>
                <p className="text-muted-foreground mb-6">
                  You worked through all five steps. Try another topic.
                </p>
                <Button onClick={reset}>Start a new lesson</Button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-sm font-medium text-primary">
                    Step {session.currentStepIndex + 1} of{" "}
                    {session.learningPath.length} · {currentStep.complexity}
                  </p>
                  <h2 className="text-xl font-semibold mt-1">
                    {currentStep.title}
                  </h2>
                </div>

                {status === "explaining" || status === "simplifying" ? (
                  <div className="text-muted-foreground">
                    {status === "simplifying"
                      ? "Re-explaining more simply…"
                      : "Generating explanation…"}
                  </div>
                ) : currentStep.content ? (
                  <article className="max-w-none mb-6 whitespace-pre-wrap leading-relaxed">
                    {currentStep.content}
                  </article>
                ) : null}

                {currentQA.length > 0 && (
                  <div className="mt-6 space-y-4 border-t pt-6">
                    {currentQA.map((qa, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium">You: {qa.question}</p>
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                          {qa.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder="Ask a question about this step…"
                      disabled={status !== "idle"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void askQuestion();
                      }}
                    />
                    <Button
                      onClick={() => void askQuestion()}
                      disabled={!questionInput.trim() || status !== "idle"}
                    >
                      {status === "asking" ? "Asking…" : "Ask"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => session && void loadExplanation(session, true)}
                      disabled={status !== "idle" || !currentStep.content}
                    >
                      Make it simpler
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={advanceStep}
                      disabled={status !== "idle" || !currentStep.content}
                    >
                      Got it! Next step →
                    </Button>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-destructive">{error}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Learning path</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {session.learningPath.map((step, idx) => (
                  <li
                    key={step.id}
                    className={`flex items-start gap-2 ${
                      idx === session.currentStepIndex
                        ? "text-primary font-medium"
                        : step.completed
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    <span className="text-xs mt-0.5">{idx + 1}.</span>
                    <span>{step.title}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Your model</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Level</dt>
                  <dd>{session.userModel.level}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Confidence</dt>
                  <dd>{Math.round(session.userModel.confidence * 100)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Vocabulary</dt>
                  <dd>{session.userModel.vocabularyLevel}</dd>
                </div>
              </dl>
              {session.userModel.knownConcepts.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Known concepts
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {session.userModel.knownConcepts.map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {session.userModel.gapConcepts.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Gaps</p>
                  <div className="flex flex-wrap gap-1">
                    {session.userModel.gapConcepts.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="border-amber-300 text-amber-700"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
