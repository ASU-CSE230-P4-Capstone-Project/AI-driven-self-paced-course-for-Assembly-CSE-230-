"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../login/hooks/useAuth";
import ModuleHeader from "../ModuleHeader";
import ModuleTabs from "../ModuleTabs";
import MasteryQuiz from "./QuizClient";
import type { MasteryQuizBundle } from "./QuizClient";
import type { TopicResult } from "./QuizClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function MasteryClientPage() {
    const params = useParams();
    const moduleId = params?.id as string;
    const { token } = useAuth();
    const [quiz, setQuiz] = useState<MasteryQuizBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);

    const excludeStorageKey = moduleId ? `mastery_quiz_exclude_${moduleId}` : "";

    const generateQuiz = useCallback(async () => {
        if (!moduleId) return;

        setLoading(true);
        setError(null);

        let exclude_question_prompts: string[] = [];
        if (excludeStorageKey && typeof window !== "undefined") {
            try {
                const raw = sessionStorage.getItem(excludeStorageKey);
                if (raw) exclude_question_prompts = JSON.parse(raw) as string[];
            } catch {
                exclude_question_prompts = [];
            }
        }

        try {
            const response = await fetch(`${API_URL}/fetch/quiz`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    module_id: moduleId,
                    num_questions: 10,
                    exclude_question_prompts,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to generate quiz");
            }

            const bundle = data as MasteryQuizBundle;
            setQuiz(bundle);
            setShowQuiz(true);
            setHasGenerated(true);

            if (excludeStorageKey && typeof window !== "undefined" && bundle.questions?.length) {
                const stems = bundle.questions.map((q) => q.prompt).filter(Boolean);
                const merged = [...exclude_question_prompts, ...stems].slice(-80);
                sessionStorage.setItem(excludeStorageKey, JSON.stringify(merged));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate quiz");
        } finally {
            setLoading(false);
        }
    }, [moduleId, excludeStorageKey]);

    const handleQuizComplete = useCallback(
        async (score: number, total: number, topicResults: TopicResult[]) => {
            if (!token || !moduleId) return;
            try {
                await fetch(`${API_URL}/progress/quiz-result`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        module_id: moduleId,
                        score,
                        total_questions: total,
                        topic_results: topicResults,
                    }),
                });
            } catch {
                /* non-blocking */
            }
        },
        [token, moduleId]
    );

    useEffect(() => {
        if (moduleId && !hasGenerated) {
            generateQuiz();
        }
    }, [moduleId, hasGenerated, generateQuiz]);

    if (!moduleId) {
        return notFound();
    }

    if (showQuiz && quiz) {
        return (
            <div className="min-h-screen bg-white">
                <ModuleHeader moduleId={moduleId} />
                <main className="max-w-6xl mx-auto px-6 py-8">
                    <ModuleTabs moduleId={moduleId} activeTab="mastery" />
                    <div className="flex items-center justify-between mb-6">
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-black">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                setShowQuiz(false);
                                setQuiz(null);
                                setHasGenerated(false);
                                generateQuiz();
                            }}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Generating..." : "Generate new quiz"}
                        </button>
                    </div>

                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Module {moduleId} quiz</h2>
                            <p className="text-gray-600">
                                {quiz.questions.length} questions · up to 3 hints per attempt · grounded in course KB
                            </p>
                        </div>
                        <div className="ml-6">
                            <span className="bg-[#800020] text-white px-6 py-2 rounded-full text-sm font-semibold">
                                Practice &amp; Mastery
                            </span>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                        <MasteryQuiz
                            key={quiz.questions.map((q) => q.id).join("-")}
                            quiz={quiz}
                            moduleId={moduleId}
                            onComplete={handleQuizComplete}
                        />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <ModuleHeader moduleId={moduleId} />
            <main className="max-w-6xl mx-auto px-6 py-8">
                <ModuleTabs moduleId={moduleId} activeTab="mastery" />
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </Link>

                <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Module {moduleId} quiz</h2>
                        <p className="text-gray-600">Practice &amp; mastery questions</p>
                    </div>
                    <div className="ml-6">
                        <span className="bg-[#800020] text-white px-6 py-2 rounded-full text-sm font-semibold">
                            Practice &amp; Mastery
                        </span>
                    </div>
                </div>

                {loading && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-gray-200 border-t-[#800020] rounded-full animate-spin" />
                            </div>
                            <p className="text-gray-700 text-lg font-medium">Generating quiz questions from the knowledge base…</p>
                            <p className="text-gray-500 text-sm">This may take a moment</p>
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                            <button
                                type="button"
                                onClick={generateQuiz}
                                disabled={loading}
                                className="w-full px-6 py-3 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-[#800020]"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
