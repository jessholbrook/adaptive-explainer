"use client";

import { useEffect, useState } from "react";
import type { LearningSession, ModelInfo, UserKnowledgeModel } from "@/lib/types";

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
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Adaptive Explainer</h1>
          <p className="text-slate-600 mb-8">
            Type a topic and an AI tutor will build a 5-step lesson tailored to what you know.
          </p>
          <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. How does HTTPS work?"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={status === "starting"}
            onKeyDown={(e) => {
              if (e.key === "Enter") void startLearning();
            }}
          />
          <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 mb-6 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={status === "starting" || models.length === 0}
          >
            {models.length === 0 ? (
              <option>No models available — check your API keys</option>
            ) : (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))
            )}
          </select>
          <button
            onClick={() => void startLearning()}
            disabled={!topic.trim() || !selectedModel || status === "starting"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium py-3 rounded-lg transition"
          >
            {status === "starting" ? "Building your lesson…" : "Start Learning"}
          </button>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </main>
    );
  }

  const currentStep = session.learningPath[session.currentStepIndex];
  const allDone = session.currentStepIndex >= session.learningPath.length;
  const currentQA = qaHistory[session.currentStepIndex] ?? [];

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-slate-500">Topic</p>
              <h1 className="text-2xl font-semibold text-slate-900">{session.topic}</h1>
            </div>
            <button
              onClick={reset}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              New topic
            </button>
          </div>

          {allDone ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                Lesson complete.
              </h2>
              <p className="text-slate-600 mb-6">
                You worked through all five steps. Try another topic.
              </p>
              <button
                onClick={reset}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-lg"
              >
                Start a new lesson
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-sm text-emerald-700 font-medium">
                  Step {session.currentStepIndex + 1} of {session.learningPath.length} ·{" "}
                  {currentStep.complexity}
                </p>
                <h2 className="text-xl font-semibold text-slate-900 mt-1">
                  {currentStep.title}
                </h2>
              </div>

              {status === "explaining" || status === "simplifying" ? (
                <div className="text-slate-500">
                  {status === "simplifying" ? "Re-explaining more simply…" : "Generating explanation…"}
                </div>
              ) : currentStep.content ? (
                <article className="prose prose-slate max-w-none mb-6 whitespace-pre-wrap leading-relaxed">
                  {currentStep.content}
                </article>
              ) : null}

              {currentQA.length > 0 && (
                <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
                  {currentQA.map((qa, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-slate-700">You: {qa.question}</p>
                      <p className="text-slate-600 mt-1 whitespace-pre-wrap">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="Ask a question about this step…"
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={status !== "idle"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void askQuestion();
                    }}
                  />
                  <button
                    onClick={() => void askQuestion()}
                    disabled={!questionInput.trim() || status !== "idle"}
                    className="bg-slate-900 hover:bg-slate-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg"
                  >
                    {status === "asking" ? "Asking…" : "Ask"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => session && void loadExplanation(session, true)}
                    disabled={status !== "idle" || !currentStep.content}
                    className="flex-1 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 py-2 rounded-lg"
                  >
                    Make it simpler
                  </button>
                  <button
                    onClick={advanceStep}
                    disabled={status !== "idle" || !currentStep.content}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium py-2 rounded-lg"
                  >
                    Got it! Next step →
                  </button>
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Learning path</h3>
            <ol className="space-y-2 text-sm">
              {session.learningPath.map((step, idx) => (
                <li
                  key={step.id}
                  className={`flex items-start gap-2 ${
                    idx === session.currentStepIndex
                      ? "text-emerald-700 font-medium"
                      : step.completed
                      ? "text-slate-500 line-through"
                      : "text-slate-600"
                  }`}
                >
                  <span className="text-xs mt-0.5">{idx + 1}.</span>
                  <span>{step.title}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Your model</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Level</dt>
                <dd className="text-slate-900">{session.userModel.level}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Confidence</dt>
                <dd className="text-slate-900">
                  {Math.round(session.userModel.confidence * 100)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vocabulary</dt>
                <dd className="text-slate-900">{session.userModel.vocabularyLevel}</dd>
              </div>
            </dl>
            {session.userModel.knownConcepts.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Known concepts</p>
                <div className="flex flex-wrap gap-1">
                  {session.userModel.knownConcepts.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {session.userModel.gapConcepts.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Gaps</p>
                <div className="flex flex-wrap gap-1">
                  {session.userModel.gapConcepts.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
