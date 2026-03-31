"use client";

import { useState } from "react";
import { useAuth } from "../../../login/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "../../../login/components/ui/card";
import { Textarea } from "../../../login/components/ui/textarea";
import { Button } from "../../../login/components/ui/button";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id?: string;
    score?: number;
    metadata?: {
      doc_id?: string;
      module_id?: string;
      chunk_id?: number;
      source_file?: string;
      text?: string;
      topic?: string;
    };
  }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return c;
    }
  });
}

// Minimal markdown rendering for the tutor output:
// - `**bold**`
// - `` `inline code` ``
// - Preserve newlines
function renderTutorMarkdownToHtml(text: string) {
  const escaped = escapeHtml(text || "");
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withCode = withBold.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withEm = withCode.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return withEm.replace(/\n/g, "<br/>");
}

export default function TutorClient({ moduleId }: { moduleId: string }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/fetch/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: userMessage.content,
          context: `Module ${moduleId}`,
          enable_search: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail =
          typeof data?.detail === "string" ? data.detail : "Tutor request failed. Please try again.";
        setError(detail);
        return;
      }

      const assistantText: string =
        typeof data?.result?.response === "string"
          ? data.result.response
          : "I received your question, but I could not parse the response.";

      // Backend may return either:
      // - sources: { sources: [...] } (older format)
      // - sources: [...] (Pinecone matches format)
      const sources: ChatMessage["sources"] =
        data?.result?.metadata?.sources?.sources ?? data?.result?.metadata?.sources ?? [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          sources: Array.isArray(sources) ? sources : undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error contacting the tutor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-slate-200/70 bg-white/90 shadow-xl backdrop-blur">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="text-xl font-semibold text-slate-900">Socratic CourseTutor</CardTitle>
        <p className="text-sm text-slate-600">
          Ask concise module questions for grounded answers with source chunks.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="h-96 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4 shadow-inner">
          {messages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
              Ask a question about Module {moduleId} to get started.
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`message-${index}`}
                className={`p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-gradient-to-br from-rose-50 to-rose-100/70 border border-rose-200 text-slate-900"
                    : "bg-white border border-slate-200 text-slate-900 shadow-sm"
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "Tutor"}
                </p>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  // Tutor content may include markdown (e.g. **bold**). We only render a small subset.
                  dangerouslySetInnerHTML={{
                    __html: renderTutorMarkdownToHtml(message.content),
                  }}
                />
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                    <p className="mb-1 font-semibold text-slate-700">Sources used</p>
                    <ul className="list-disc pl-4 space-y-2">
                      {message.sources.map((source, idx) => (
                        <li key={`${source.id ?? "source"}-${idx}`}>
                          <div className="text-[11px] font-medium text-slate-700">
                            {source.metadata?.source_file ??
                              source.metadata?.doc_id ??
                              source.id ??
                              "Knowledge Base"}
                            {typeof source.metadata?.chunk_id === "number" ? ` · Chunk ${source.metadata?.chunk_id}` : null}
                            {typeof source.score === "number" ? ` · Score ${source.score.toFixed(3)}` : null}
                          </div>
                          {source.metadata?.text ? (
                            <div className="text-[11px] text-slate-500">
                              {source.metadata.text.length > 220 ? `${source.metadata.text.slice(0, 220)}...` : source.metadata.text}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm animate-pulse">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tutor
              </p>
              <div className="space-y-2">
                <div className="h-3 w-11/12 rounded bg-slate-200" />
                <div className="h-3 w-10/12 rounded bg-slate-200" />
                <div className="h-3 w-8/12 rounded bg-slate-200" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this module..."
            rows={3}
            disabled={isLoading}
            className="resize-none rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-slate-500/20"
          />
          <div className="flex justify-end">
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-slate-900 px-5 text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isLoading ? "Thinking..." : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

