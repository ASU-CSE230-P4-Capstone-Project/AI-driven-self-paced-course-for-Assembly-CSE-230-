"use client";

import React from "react";
import {
  EDITOR_SIZE_OPTIONS,
  type EditorSize,
} from "@/components/editor-layout";

type EditorSizePickerProps = {
  value: EditorSize;
  onChange: (nextSize: EditorSize) => void;
  className?: string;
};

export default function EditorSizePicker({
  value,
  onChange,
  className = "",
}: EditorSizePickerProps) {
  return (
    <div
      className={`flex w-full max-w-[11.5rem] items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-950/70 px-2.5 py-1.5 shadow-md shadow-black/10 sm:w-auto ${className}`.trim()}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        Size
      </span>
      <div className="relative min-w-0 flex-1">
        <select
          aria-label="Editor size"
          value={value}
          onChange={(event) => onChange(event.target.value as EditorSize)}
          className="w-full appearance-none rounded-md border border-zinc-700/70 bg-zinc-900/80 py-1 pl-2 pr-7 text-xs font-semibold text-zinc-100 outline-none transition hover:border-zinc-500 focus:border-orange-300/80 focus:ring-2 focus:ring-orange-300/20"
        >
          {EDITOR_SIZE_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-zinc-900 text-zinc-100"
            >
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
        >
          <path
            d="M4 6.5 8 10l4-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
