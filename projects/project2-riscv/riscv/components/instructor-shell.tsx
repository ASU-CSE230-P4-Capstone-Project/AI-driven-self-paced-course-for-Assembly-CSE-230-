"use client";

import type { ReactNode } from "react";

/**
 * Warm light studio: solid warm background so staff pages stay visually calm and readable.
 */
export function InstructorStudioBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fff4e0] text-stone-900">
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Shared class tokens — warm light theme (amber / orange accents).
 */
export const ins = {
  backLink:
    "text-sm font-semibold text-amber-800 hover:text-amber-950 underline-offset-2 hover:underline transition-colors",
  kicker: "text-xs font-semibold uppercase tracking-[0.18em] text-amber-900/85",
  h1: "text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight",
  h2: "text-xl font-semibold text-stone-900",
  h2Card: "text-lg font-semibold text-stone-900",
  subtitle: "mt-2 text-sm sm:text-base text-stone-700 leading-relaxed",
  subtitleMuted: "text-sm text-stone-700",
  pageWrap: "mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-10",
  pageWrapMd: "mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8",
  pageWrapSm: "mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8",
  pageWrapWide: "mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6",
  sectionHeader: "flex items-start gap-2",
  card:
    "rounded-2xl border border-amber-200/90 bg-white shadow-sm shadow-amber-950/10 ring-1 ring-amber-100/80",
  cardPad: "p-6 sm:p-7",
  cardFlat: "rounded-2xl border border-amber-100 bg-orange-50/50",
  label: "block text-sm font-semibold text-stone-800",
  labelCaps:
    "block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-600",
  input:
    "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35",
  inputInline:
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35",
  select:
    "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35 [&_option]:bg-white",
  btnPrimary:
    "inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  btnSecondary:
    "inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm hover:bg-amber-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:opacity-50",
  btnNeutral:
    "inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:border-amber-400 hover:bg-orange-50/90",
  btnDanger:
    "inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50",
  btnDangerSolid:
    "inline-flex items-center justify-center rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50",
  linkAccent:
    "text-sm font-semibold text-amber-800 hover:text-amber-950 hover:underline underline-offset-2",
  msgOk:
    "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900",
  msgErr:
    "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900",
  listRow:
    "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-800 shadow-sm",
  spinner:
    "h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600",
  btnDisabled:
    "cursor-not-allowed rounded-xl border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400",
  tableHead: "border-b border-stone-200 text-left text-stone-700",
  tableCell: "py-2 pr-4 text-stone-800",
  divideList: "divide-y divide-stone-200",
} as const;
