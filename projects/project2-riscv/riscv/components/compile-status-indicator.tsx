"use client";

import React from "react";
import type { CompileStatus } from "./types";

type CompileStatusIndicatorProps = {
  status: CompileStatus;
  className?: string;
};

export default function CompileStatusIndicator({
  status,
  className = "",
}: CompileStatusIndicatorProps) {
  if (status.state === "idle") {
    return null;
  }

  const styles =
    status.state === "compiling"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : status.state === "success"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
        : "border-red-500/40 bg-red-500/10 text-red-100";



  return (
    <div
      title={status.message}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${styles} ${className}`.trim()}
    >
      {status.state === "compiling" ? (
        <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : status.state === "success" ? (
        <span aria-hidden="true" className="text-sm leading-none">
          ✓
        </span>
      ) : (
        <span aria-hidden="true" className="text-sm leading-none">
          ✕
        </span>
      )}
    </div>
  );
}
