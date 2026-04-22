"use client";

/**
 * Small circular “i” control for inline help. Uses native tooltip via `title`
 * and `aria-label` for screen readers.
 */
export function InfoHint({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={
        `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/70 bg-amber-50 text-[11px] font-bold leading-none text-amber-900 shadow-sm transition hover:bg-amber-100 hover:border-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ` +
        className
      }
      title={title}
      aria-label={title}
    >
      i
    </button>
  );
}
