"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useEffect } from "react";

type Choice = { id: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  prompt: string;
  choices: Choice[];
  hint?: string;
  source_citation?: string;
  topic?: string;
  subTopic?: string;
};
type QuizSource = { source_file?: string; snippet?: string; score?: number };
export type TopicResult = { topic: string; correct: number; total: number };
export type MasteryQuizBundle = {
  moduleId: string;
  questions: Question[];
  sources?: QuizSource[];
};

const SESSION_HINT_BUDGET = 3;

type MasteryQuizProps = {
  quiz: MasteryQuizBundle;
  moduleId: string;
  onComplete?: (score: number, total: number, topicResults: TopicResult[]) => void;
};

export default function MasteryQuiz({ quiz, moduleId, onComplete }: MasteryQuizProps) {
  const questions = quiz.questions;
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hintsLeft, setHintsLeft] = useState(SESSION_HINT_BUDGET);
  const [hintRevealed, setHintRevealed] = useState<Record<string, boolean>>({});
  const [showSummary, setShowSummary] = useState(false);
  const progressSaved = useRef(false);

  const current = questions[index];

  const pick = (choiceId: string) => {
    if (checked[current.id]) return;
    setAnswers((prev) => ({ ...prev, [current.id]: choiceId }));
  };

  const submitCurrent = () => {
    if (!answers[current.id]) return;
    setChecked((prev) => ({ ...prev, [current.id]: true }));
  };

  const next = () => setIndex((i) => Math.min(i + 1, total - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  const revealHint = () => {
    if (hintsLeft <= 0) return;
    if (hintRevealed[current.id]) return;
    if (!current.hint?.trim()) return;
    setHintRevealed((r) => ({ ...r, [current.id]: true }));
    setHintsLeft((h) => h - 1);
  };

  const correctIdFor = (q: Question) => q.choices.find((c) => c.isCorrect)?.id ?? "";
  const isCorrect = (q: Question) => answers[q.id] === correctIdFor(q);

  const score = useMemo(() => {
    let s = 0;
    for (const q of questions) {
      if (checked[q.id] && answers[q.id] === correctIdFor(q)) {
        s++;
      }
    }
    return s;
  }, [answers, checked, questions]);

  const allSubmitted = questions.every((q) => checked[q.id]);

  const wrongQuestions = useMemo(
    () =>
      questions.filter(
        (q) => checked[q.id] && answers[q.id] !== (q.choices.find((c) => c.isCorrect)?.id ?? "")
      ),
    [answers, checked, questions]
  );

  const uniqueSources = useMemo(() => {
    const rows: { label: string; snippet?: string }[] = [];
    const seen = new Set<string>();
    for (const s of quiz.sources ?? []) {
      const key = `${s.source_file ?? ""}|${(s.snippet ?? "").slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        label: s.source_file ?? "Knowledge base",
        snippet: s.snippet,
      });
    }
    for (const q of wrongQuestions) {
      const cit = q.source_citation?.trim();
      if (cit && !seen.has(cit)) {
        seen.add(cit);
        rows.push({ label: cit });
      }
    }
    return rows.slice(0, 12);
  }, [quiz.sources, wrongQuestions]);

  const topicResults = useMemo(() => {
    const byTopic: Record<string, { topic: string; correct: number; total: number }> = {};
    const correctIdForLocal = (q: Question) => q.choices.find((c) => c.isCorrect)?.id ?? "";

    for (const q of questions) {
      const topic = (q.topic || "General").trim() || "General";
      if (!byTopic[topic]) byTopic[topic] = { topic, correct: 0, total: 0 };
      byTopic[topic].total += 1;

      const isQCorrect = checked[q.id] && answers[q.id] === correctIdForLocal(q);
      if (isQCorrect) byTopic[topic].correct += 1;
    }

    return Object.values(byTopic);
  }, [answers, checked, questions]);

  useEffect(() => {
    if (!showSummary || !onComplete || progressSaved.current) return;
    progressSaved.current = true;
    onComplete(score, total, topicResults);
  }, [showSummary, onComplete, score, total, topicResults]);

  return (
    <div className="space-y-6">
      {!showSummary ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Question <span className="font-semibold text-gray-900">{index + 1}</span> of {total}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-semibold">Score:</span>{" "}
              <span className="text-[#800020] font-semibold">
                {score}/{total}
              </span>
            </div>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#800020] transition-all"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>

          <h3 className="text-xl font-semibold text-gray-900">{current.prompt}</h3>

          <div className="space-y-3">
            {current.choices.map((choice) => {
              const selected = answers[current.id] === choice.id;
              const wasChecked = checked[current.id];
              let skin = "bg-white border border-gray-200 hover:border-gray-300";
              if (!wasChecked && selected) skin = "bg-[#fff6f8] border border-[#800020]";
              if (wasChecked) {
                const correct = correctIdFor(current);
                if (choice.id === correct) skin = "bg-green-50 border border-green-500";
                else if (selected) skin = "bg-red-50 border border-red-500";
                else skin = "bg-white border border-gray-200";
              }
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => pick(choice.id)}
                  disabled={wasChecked}
                  className={`w-full text-left p-4 rounded-lg transition text-gray-900 ${skin}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full border border-gray-400 text-xs font-semibold text-gray-800">
                    {choice.id}
                  </span>
                  {choice.text}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <button
                type="button"
                onClick={revealHint}
                disabled={
                  hintsLeft === 0 || Boolean(hintRevealed[current.id]) || !String(current.hint ?? "").trim()
                }
                className="text-[#800020] disabled:text-gray-400 font-medium text-left"
              >
                Get hint ({hintsLeft} left this quiz, max one per question)
              </button>
              {hintRevealed[current.id] && current.hint && (
                <p className="text-sm text-gray-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <span className="font-semibold text-amber-900">Hint: </span>
                  {current.hint}
                </p>
              )}
              {!current.hint?.trim() && (
                <p className="text-xs text-gray-500">No hint available for this question.</p>
              )}
            </div>
            {checked[current.id] && (
              <div
                className={`text-sm font-medium shrink-0 ${
                  isCorrect(current) ? "text-green-700" : "text-red-700"
                }`}
              >
                {isCorrect(current) ? "Correct!" : `Incorrect. Correct answer: ${correctIdFor(current)}`}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2 gap-3 flex-wrap">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex items-center gap-3">
              {!checked[current.id] ? (
                <button
                  type="button"
                  onClick={submitCurrent}
                  disabled={!answers[current.id]}
                  className="px-4 py-2 rounded-lg text-white disabled:opacity-50 bg-[#800020] hover:bg-[#6b001a]"
                >
                  Submit answer
                </button>
              ) : index < total - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-[#800020] to-amber-500"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  disabled={!allSubmitted}
                  className="px-4 py-2 rounded-lg text-white disabled:opacity-50 bg-gradient-to-r from-[#800020] to-amber-500"
                >
                  View results
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-8 border border-gray-200 rounded-xl p-6 bg-gray-50/80">
          <div className="text-center space-y-2">
            <p className="text-sm uppercase tracking-wide text-[#800020]">Quiz complete</p>
            <h3 className="text-2xl font-bold text-gray-900">Module {moduleId}</h3>
            <p className="text-lg text-gray-700">
              You scored <strong className="text-[#800020]">{score}</strong> out of{" "}
              <strong className="text-gray-900">{total}</strong> (
              {total ? Math.round((100 * score) / total) : 0}%)
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-900">Review</h4>
            {questions.map((q) => {
              const picked = answers[q.id] ?? "—";
              const correct = q.choices.find((c) => c.isCorrect)?.id ?? "—";
              const ok = picked === correct;
              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-lg border ${
                    ok ? "border-green-300 bg-green-50" : "border-red-200 bg-red-50/80"
                  }`}
                >
                  <div className="font-medium text-gray-900 mb-1">
                    Q{q.id}. {q.prompt}
                  </div>
                  <div className="text-sm text-gray-700">
                    Your answer: <strong className="text-gray-900">{picked}</strong> · Correct:{" "}
                    <strong className="text-gray-900">{correct}</strong>
                  </div>
                  {q.source_citation?.trim() && (
                    <p className="text-xs text-gray-600 mt-2">
                      Source: {q.source_citation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {(uniqueSources.length > 0 || wrongQuestions.length > 0) && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Knowledge base references</h4>
              <p className="text-sm text-gray-600 mb-3">
                Chunks retrieved for this module (and citations from missed questions) — not generic web links.
              </p>
              <ul className="space-y-3">
                {uniqueSources.map((row, i) => (
                  <li
                    key={i}
                    className="text-sm border border-gray-200 rounded-lg p-3 bg-white text-gray-800"
                  >
                    <div className="font-medium text-gray-900">{row.label}</div>
                    {row.snippet && <p className="text-gray-600 mt-1 line-clamp-4">{row.snippet}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href={`/module/${moduleId}`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-800 hover:bg-white"
            >
              Back to module
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#800020] text-white hover:bg-[#6b001a]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
