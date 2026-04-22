"use client";
import React from "react";
import CompileStatusIndicator from "./compile-status-indicator";
import type { CompileStatus } from "./types";

type EditorControlsProps = {
  onRun: () => void;
  onStart: () => void;
  onStop: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  onSyncNow?: () => void;
  uid?: string;
  stepsEngaged: boolean;
  stepIndex: number;
  allStatesLength: number;
  compileStatus?: CompileStatus;
};

const EditorControls: React.FC<EditorControlsProps> = ({
  onRun,
  onStart,
  onStop,
  onStepForward,
  onStepBack,
  onReset,
  onSyncNow,
  uid,
  stepsEngaged,
  stepIndex,
  allStatesLength,
  compileStatus = { state: "idle", message: "" },
}) => {
  const isCompiling = compileStatus.state === "compiling";
  const mutedControlButtonClass =
    "rounded border border-zinc-600 bg-zinc-950/20 px-4 py-2 text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-700/55 hover:text-white disabled:opacity-50";
  const mutedUtilityButtonClass =
    "rounded border border-zinc-600 bg-zinc-950/20 px-3 py-2 text-xs text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-700/55 hover:text-white disabled:opacity-50";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-950/35 p-3">
      <button
        onClick={onRun}
        disabled={isCompiling}
        className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-900 disabled:opacity-50"
      >
        {isCompiling ? "Compiling..." : "Run"}
      </button>

      <CompileStatusIndicator status={compileStatus} />

      {stepsEngaged ? (
        <button
          onClick={onStop}
          disabled={isCompiling}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={isCompiling}
          className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Start
        </button>
      )}

      <button
        onClick={onStepForward}
        disabled={
          isCompiling ||
          !stepsEngaged ||
          allStatesLength === 0 ||
          stepIndex >= allStatesLength - 1
        }
        className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
      >
        Step
      </button>

      <button
        onClick={onStepBack}
        className={mutedControlButtonClass}
        disabled={isCompiling || !stepsEngaged || stepIndex === 0 || allStatesLength === 0}
      >
        Back Step
      </button>

      <button
        onClick={onReset}
        className={mutedControlButtonClass}
        disabled={isCompiling}
      >
        Reset
      </button>

      <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:justify-end">
        {onSyncNow ? (
          <button
            onClick={onSyncNow}
            className={mutedUtilityButtonClass}
            disabled={isCompiling}
          >
            Sync Now
          </button>
        ) : null}
        {uid ? <span className="text-xs text-zinc-500 sm:text-right">{uid}</span> : null}
      </div>
    </div>
  );
};

export default EditorControls;
