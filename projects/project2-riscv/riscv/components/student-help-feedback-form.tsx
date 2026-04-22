"use client";

import { useState } from "react";

export default function StudentHelpFeedbackForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label className="text-xs text-zinc-400">Topic</label>
        <input
          type="text"
          placeholder="Bug report, idea, question..."
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400">Message</label>
        <textarea
          rows={4}
          placeholder="Tell us what you ran into and how we can help."
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Send Feedback
        </button>
        {submitted && (
          <span className="text-xs text-green-400">
            Thanks! Your feedback was sent.
          </span>
        )}
      </div>
    </form>
  );
}
