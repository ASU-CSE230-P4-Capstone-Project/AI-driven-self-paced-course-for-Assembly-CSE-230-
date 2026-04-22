"use client";
import React from "react";
import type {
  AssemblyInfoData,
  CompileStatus,
  ProjectState,
  SubmitRequest,
  SubmitResponse,
} from "./types";

type RunMeta = { hadError: boolean; errorMessage: string };

type UseRunnerParams = {
  code: string;
  allStates: SubmitResponse["states"];
  runMeta: RunMeta;
  registersForRun: Record<string, string>;
  memoryForRun: Record<string, string>;
  persist: (next?: Partial<ProjectState>) => void;
  setAllStates: React.Dispatch<React.SetStateAction<SubmitResponse["states"]>>;
  setStepIndex: React.Dispatch<React.SetStateAction<number>>;
  setResp: React.Dispatch<React.SetStateAction<AssemblyInfoData | null>>;
  setRunMeta: React.Dispatch<React.SetStateAction<RunMeta>>;
  setFatalError: React.Dispatch<React.SetStateAction<string | null>>;
  setStepsEngaged: React.Dispatch<React.SetStateAction<boolean>>;
};

type SuccessfulRunBackendResult = {
  ok: true;
  states: SubmitResponse["states"];
  hadError: boolean;
  errorMessage: string;
};

type FailedRunBackendResult = {
  ok: false;
  errorMessage: string;
};

type RunBackendResult = SuccessfulRunBackendResult | FailedRunBackendResult;

const MIN_RUN_FEEDBACK_MS = 2000;
const IDLE_COMPILE_STATUS: CompileStatus = {
  state: "idle",
  message: "",
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const useRunner = ({
  code,
  allStates,
  runMeta,
  registersForRun,
  memoryForRun,
  persist,
  setAllStates,
  setStepIndex,
  setResp,
  setRunMeta,
  setFatalError,
  setStepsEngaged,
}: UseRunnerParams) => {
  const [compileStatus, setCompileStatus] =
    React.useState<CompileStatus>(IDLE_COMPILE_STATUS);

  const resetCompileStatus = React.useCallback(() => {
    setCompileStatus(IDLE_COMPILE_STATUS);
  }, []);

  const runBackend = React.useCallback(async (): Promise<RunBackendResult> => {
    try {
      const reqBody: SubmitRequest = {
        code,
        registers: registersForRun,
        memory: memoryForRun,
      };

      const res = await fetch("/api/run", {
        method: "POST",
        body: JSON.stringify(reqBody),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(await res.text());

      const json = (await res.json()) as Partial<SubmitResponse>;

      return {
        ok: true,
        states: Array.isArray(json.states) ? json.states : [],
        hadError: !!json.hadError,
        errorMessage: json.errorMessage ?? "",
      };
    } catch (error: unknown) {
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Run failed",
      };
    }
  }, [
    code,
    registersForRun,
    memoryForRun,
  ]);

  const applyCompileFailure = React.useCallback(
    (message: string): CompileStatus => {
      const errorMessage = message.trim() || "Run failed";
      const errorResp: AssemblyInfoData = {
        hadError: true,
        errorMessage,
        registers: {},
        memory: {},
      };

      setAllStates([]);
      setStepIndex(0);
      setRunMeta({
        hadError: true,
        errorMessage,
      });
      setResp(errorResp);
      setFatalError(errorMessage);
      setStepsEngaged(false);

      persist({
        allStates: [],
        stepIndex: 0,
        resp: errorResp,
      });

      return {
        state: "error",
        message: errorMessage,
      };
    },
    [
      persist,
      setAllStates,
      setFatalError,
      setResp,
      setRunMeta,
      setStepIndex,
      setStepsEngaged,
    ]
  );

  const applyRunResult = React.useCallback(
    (
      result: SuccessfulRunBackendResult,
      mode: "run" | "start"
    ): CompileStatus => {
      const normalizedErrorMessage = result.errorMessage.trim();

      if (result.states.length === 0) {
        const errorMessage = normalizedErrorMessage || "Backend returned no states";
        const errorResp: AssemblyInfoData = {
          hadError: true,
          errorMessage,
          registers: {},
          memory: {},
        };

        setAllStates([]);
        setStepIndex(0);
        setRunMeta({
          hadError: true,
          errorMessage,
        });
        setResp(errorResp);
        setFatalError(null);
        setStepsEngaged(false);

        persist({
          allStates: [],
          stepIndex: 0,
          resp: errorResp,
        });

        return {
          state: "error",
          message: errorMessage,
        };
      }

      const displayState =
        mode === "run"
          ? result.states[result.states.length - 1]!
          : result.states[0]!;

      const assemblyData: AssemblyInfoData = {
        hadError: result.hadError,
        errorMessage: normalizedErrorMessage,
        registers: displayState.registers,
        memory: displayState.memory,
      };

      setAllStates(result.states);
      setStepIndex(0);
      setRunMeta({
        hadError: result.hadError,
        errorMessage: normalizedErrorMessage,
      });
      setResp(assemblyData);
      setFatalError(null);
      setStepsEngaged(mode === "start");

      persist({
        allStates: result.states,
        stepIndex: 0,
        resp: assemblyData,
      });

      if (result.hadError) {
        return {
          state: "error",
          message: normalizedErrorMessage || "Compilation failed",
        };
      }

      return {
        state: "success",
        message: "Code compiled successfully",
      };
    },
    [
      persist,
      setAllStates,
      setFatalError,
      setResp,
      setRunMeta,
      setStepIndex,
      setStepsEngaged,
    ]
  );

  const handleRun = React.useCallback(async () => {
    setFatalError(null);
    setCompileStatus({
      state: "compiling",
      message: "Compiling code...",
    });

    const [result] = await Promise.all([runBackend(), wait(MIN_RUN_FEEDBACK_MS)]);

    if (!result.ok) {
      setCompileStatus(applyCompileFailure(result.errorMessage));
      return;
    }

    setCompileStatus(applyRunResult(result, "run"));
  }, [applyCompileFailure, applyRunResult, runBackend, setFatalError]);

  const handleStop = React.useCallback(() => {
    setStepsEngaged(false);
  }, [setStepsEngaged]);

  const resetSession = React.useCallback((next?: Partial<ProjectState>) => {
    setAllStates([]);
    setStepIndex(0);
    setResp(null);
    setFatalError(null);
    setStepsEngaged(false);
    setCompileStatus(IDLE_COMPILE_STATUS);
    persist({
      allStates: [],
      stepIndex: 0,
      resp: null,
      ...next,
    });
  }, [persist, setAllStates, setFatalError, setResp, setStepIndex, setStepsEngaged]);

  const handleStepForward = React.useCallback(() => {
    setStepIndex((idx) => {
      const next = Math.min(idx + 1, allStates.length - 1);
      const nextState = allStates[next];
      if (nextState) {
        const newResp = {
          hadError: runMeta.hadError,
          errorMessage: runMeta.errorMessage,
          registers: nextState.registers,
          memory: nextState.memory,
        };
        setResp(newResp);
        persist({ resp: newResp });
        // also update simState / highlighting if needed
      }
      return next;
    });
  }, [allStates, persist, runMeta, setResp, setStepIndex]);

  const handleStepBack = React.useCallback(() => {
    setStepIndex((idx) => {
      const prev = Math.max(idx - 1, 0);
      const prevState = allStates[prev];
      if (prevState) {
        const newResp = {
          hadError: runMeta.hadError,
          errorMessage: runMeta.errorMessage,
          registers: prevState.registers,
          memory: prevState.memory,
        };
        setResp(newResp);
        persist({ resp: newResp });
        // also update simState / highlighting if needed
      }
      return prev;
    });
  }, [allStates, persist, runMeta, setResp, setStepIndex]);

  const handleStart = React.useCallback(async () => {
    setFatalError(null);
    setCompileStatus({
      state: "compiling",
      message: "Compiling code...",
    });

    const result = await runBackend();
    if (!result.ok) {
      setCompileStatus(applyCompileFailure(result.errorMessage));
      return;
    }

    setCompileStatus(applyRunResult(result, "start"));
  }, [applyCompileFailure, applyRunResult, runBackend, setFatalError]);

  return {
    compileStatus,
    handleRun,
    handleStop,
    handleStart,
    handleStepForward,
    handleStepBack,
    resetSession,
    resetCompileStatus,
  };
};

export default useRunner;
