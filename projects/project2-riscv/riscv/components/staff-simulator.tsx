"use client";

import Link from "next/link";
import React from "react";
import AssemblyInfo from "./assembly-info";
import EditorControls from "./editor-controls";
import EditorPanel from "./editor-panel";
import RegisterEditor from "./register-editor";
import MemoryEditor from "./memory-editor";
import MemoryVisualPanel from "./MemoryVisualPanel";
import { getClientUsername } from "./client-session";
import { makeUid } from "./project-helpers";
import useRunner from "./use-runner";
import { logout } from "@/app/logout/frontend";
import { loadLabSession } from "@/app/api/load_lab_session/frontend";
import { syncLabSession } from "@/app/api/sync_lab_session/frontend";
import { getUserSettings } from "@/app/api/user_settings/frontend";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/app/api/user_settings/types";
import type {
  AssemblyInfoData,
  SubmitResponse,
} from "./types";
import type { LabSession } from "@/app/api/sync_lab_session/types";

type StaffRole = "instructor" | "ta";

type StaffSimulatorProps = {
  role: StaffRole;
  sessionUsername?: string | null;
};

const STAFF_SANDBOX_CACHE_PREFIX = "riscv-staff-sandbox-cache";

type RoleCopy = {
  badge: string;
  title: string;
  dashboardHref: string;
  dashboardLabel: string;
  description: string;
};

const ROLE_COPY: Record<StaffRole, RoleCopy> = {
  instructor: {
    badge: "Instructor",
    title: "Instructor Sandbox",
    dashboardHref: "/instructor",
    dashboardLabel: "Back to Instructor Dashboard",
    description:
      "RISC-V Testing Simulator",
  },
  ta: {
    badge: "Teaching Assistant",
    title: "TA Sandbox",
    dashboardHref: "/ta",
    dashboardLabel: "Back to TA Dashboard",
    description:
      "RISC-V Testing Simulator",
  },
};

type InstructionsPanelProps = {
  open: boolean;
  onClose: () => void;
};

function InstructionsPanel({ open, onClose }: InstructionsPanelProps) {
  if (!open) return null;

  return (
    <div className="relative mb-4 rounded-md border-l-4 border-sky-400 bg-sky-50 p-4 text-slate-900">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 font-bold text-sky-800 hover:text-sky-900"
        aria-label="Close sandbox instructions"
      >
        ✕
      </button>

      <h3 className="mb-2 font-semibold text-sky-900">Sandbox Notes</h3>
      <ul className="ml-5 list-disc text-sm text-sky-950">
        <li>This simulator saves one sandbox per staff account, without projects or lab branching.</li>
        <li>Register and memory presets seed runtime inputs for your saved sandbox session.</li>
        <li>Runs here do not grade or modify student submissions.</li>
      </ul>
    </div>
  );
}

export default function StaffSimulator({
  role,
  sessionUsername,
}: StaffSimulatorProps) {
  const copy = ROLE_COPY[role];
  const storageKey = React.useMemo(() => `staff-sandbox:${role}`, [role]);
  const cacheUsername = React.useMemo(
    () => sessionUsername?.trim() || getClientUsername(),
    [sessionUsername]
  );
  const cacheStorageKey = React.useMemo(
    () =>
      cacheUsername
        ? `${STAFF_SANDBOX_CACHE_PREFIX}:${cacheUsername}:${role}`
        : `${STAFF_SANDBOX_CACHE_PREFIX}:${role}`,
    [cacheUsername, role]
  );
  const [uid, setUid] = React.useState("");
  const [code, setCode] = React.useState("");
  const [resp, setResp] = React.useState<AssemblyInfoData | null>(null);
  const [stepsEngaged, setStepsEngaged] = React.useState(false);
  const [fatalError, setFatalError] = React.useState<string | null>(null);
  const [allStates, setAllStates] = React.useState<SubmitResponse["states"]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [registerOverrides, setRegisterOverrides] = React.useState<Record<string, string>>({});
  const [memoryOverrides, setMemoryOverrides] = React.useState<Record<string, string>>({});
  const [runMeta, setRunMeta] = React.useState({
    hadError: false,
    errorMessage: "",
  });
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [initStatus, setInitStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [initError, setInitError] = React.useState<string | null>(null);
  const [userSettings, setUserSettings] = React.useState<UserSettings>(
    DEFAULT_USER_SETTINGS
  );
  const [instructionsOpen, setInstructionsOpen] = React.useState(
    DEFAULT_USER_SETTINGS.openInstructionsByDefault
  );
  const sandboxDirtyRef = React.useRef(false);
  const dirtyTrackingReadyRef = React.useRef(false);

  const defaultRegisters = React.useMemo(
    () => Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`x${i}`, "0x0"])),
    []
  );
  const uiRegisters = React.useMemo(
    () => ({
      ...defaultRegisters,
      ...registerOverrides,
    }),
    [defaultRegisters, registerOverrides]
  );

  const applySandboxSession = React.useCallback((session: Partial<LabSession> | null) => {
    setUid(session?.uid ?? makeUid());
    setCode(session?.code ?? "");
    setResp((session?.resp ?? null) as AssemblyInfoData | null);
    setAllStates(Array.isArray(session?.allStates) ? session.allStates : []);
    setStepIndex(typeof session?.stepIndex === "number" ? session.stepIndex : 0);
    setRegisterOverrides(
      session?.registerOverrides && typeof session.registerOverrides === "object"
        ? session.registerOverrides
        : {}
    );
    setMemoryOverrides(
      session?.memoryOverrides && typeof session.memoryOverrides === "object"
        ? session.memoryOverrides
        : {}
    );
    setStepsEngaged(false);
    setFatalError(null);
    setRunMeta({ hadError: false, errorMessage: "" });
  }, []);

  const buildSessionPayload = React.useCallback(
    (overrides?: Partial<LabSession>): LabSession | null => {
      if (!uid) return null;

      return {
        storageKey,
        uid,
        labUid: null,
        version: 1,
        code,
        resp,
        simState: null,
        stepIndex,
        allStates,
        registerOverrides,
        memoryOverrides,
        ...overrides,
      };
    },
    [allStates, code, memoryOverrides, registerOverrides, resp, stepIndex, storageKey, uid]
  );

  const syncSandboxNow = React.useCallback(
    async (useBeacon = false, force = false, overrides?: Partial<LabSession>) => {
      if (!sandboxDirtyRef.current && !force) return;

      const payload = buildSessionPayload(overrides);
      if (!payload) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const ok = navigator.sendBeacon(
          "/api/sync_lab_session",
          JSON.stringify({ session: payload })
        );
        if (ok) {
          sandboxDirtyRef.current = false;
        }
        return;
      }

      const result = await syncLabSession(payload);
      if (result.success) {
        sandboxDirtyRef.current = false;
      }
    },
    [buildSessionPayload]
  );

  const persistSandbox = React.useCallback(() => {}, []);

  const {
    compileStatus,
    handleRun,
    handleStop,
    handleStart,
    handleStepForward,
    handleStepBack,
    resetSession,
    resetCompileStatus,
  } = useRunner({
    code,
    allStates,
    runMeta,
    registersForRun: uiRegisters,
    memoryForRun: memoryOverrides,
    persist: persistSandbox,
    setAllStates,
    setStepIndex,
    setResp,
    setRunMeta,
    setFatalError,
    setStepsEngaged,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function hydrateSandbox() {
      setInitError(null);
      dirtyTrackingReadyRef.current = false;
      sandboxDirtyRef.current = false;

      let cachedSession: LabSession | null = null;
      if (typeof window !== "undefined") {
        const rawCachedSession = window.localStorage.getItem(cacheStorageKey);
        if (rawCachedSession) {
          try {
            cachedSession = JSON.parse(rawCachedSession) as LabSession;
          } catch (error) {
            console.warn("Failed to parse cached staff sandbox", error);
          }
        }
      }

      const hasCachedSession = Boolean(cachedSession);
      if (cachedSession) {
        resetCompileStatus();
        applySandboxSession(cachedSession);
        setInitStatus("ready");
      } else {
        setInitStatus("loading");
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!hasCachedSession) {
          setInitStatus("error");
          setInitError("Initial connection required. Check your internet connection and reload.");
        }
        return;
      }

      const response = await loadLabSession(storageKey);
      if (cancelled) return;

      if (!response.success) {
        if (!hasCachedSession) {
          setInitStatus("error");
          setInitError(response.message ?? "Unable to load the simulator sandbox.");
        }
        return;
      }

      const session = response.session;
      if (!hasCachedSession) {
        resetCompileStatus();
        applySandboxSession(session ?? null);
        setInitStatus("ready");
      }

      sandboxDirtyRef.current = false;
    }

    async function loadSettings() {
      const response = await getUserSettings();
      if (cancelled || !response.success || !response.settings) return;

      setUserSettings(response.settings);
      setInstructionsOpen(response.settings.openInstructionsByDefault);
    }

    void hydrateSandbox();
    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [applySandboxSession, cacheStorageKey, resetCompileStatus, storageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined" || initStatus !== "ready") return;

    const payload = buildSessionPayload();
    if (!payload) return;

    window.localStorage.setItem(cacheStorageKey, JSON.stringify(payload));
  }, [buildSessionPayload, cacheStorageKey, initStatus]);

  React.useEffect(() => {
    if (!uid || initStatus !== "ready") return;
    if (!dirtyTrackingReadyRef.current) {
      dirtyTrackingReadyRef.current = true;
      return;
    }
    sandboxDirtyRef.current = true;
  }, [uid, initStatus, code, resp, stepIndex, allStates, registerOverrides, memoryOverrides]);

  React.useEffect(() => {
    return () => {
      void syncSandboxNow(true, true);
    };
  }, [syncSandboxNow]);

  React.useEffect(() => {
    if (typeof window === "undefined" || initStatus !== "ready") return;
    const interval = window.setInterval(() => {
      void syncSandboxNow();
    }, 90 * 1000);
    return () => window.clearInterval(interval);
  }, [initStatus, syncSandboxNow]);

  React.useEffect(() => {
    if (typeof window === "undefined" || initStatus !== "ready") return;

    const handlePageHide = () => {
      void syncSandboxNow(true, true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void syncSandboxNow(true, true);
      }
    };
    const handleBeforeUnload = () => {
      void syncSandboxNow(true, true);
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initStatus, syncSandboxNow]);

  React.useEffect(() => {
    if (typeof window === "undefined" || initStatus !== "ready") return;

    const handleOnline = () => {
      void syncSandboxNow();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [initStatus, syncSandboxNow]);

  const handleReset = React.useCallback(() => {
    setRegisterOverrides({});
    setMemoryOverrides({});
    setFatalError(null);
    setRunMeta({ hadError: false, errorMessage: "" });
    resetSession({ registerOverrides: {}, memoryOverrides: {} });
  }, [resetSession]);

  const handleClearSandbox = React.useCallback(() => {
    resetCompileStatus();
    setCode("");
    handleReset();
    void syncSandboxNow(false, true, {
      code: "",
      resp: null,
      stepIndex: 0,
      allStates: [],
      registerOverrides: {},
      memoryOverrides: {},
      simState: null,
    });
  }, [handleReset, resetCompileStatus, syncSandboxNow]);

  const handleLogout = React.useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await syncSandboxNow(true, true);
      await logout();
    } finally {
      window.location.href = "/login";
    }
  }, [isLoggingOut, syncSandboxNow]);

  if (initStatus === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(82,82,82)] px-6 text-zinc-100">
        <div className="max-w-lg rounded border border-red-500/40 bg-red-950/30 p-6 text-sm">
          <div className="mb-2 font-semibold">Unable to load sandbox</div>
          <div>{initError ?? "Initial connection required. Check your internet connection."}</div>
        </div>
      </div>
    );
  }

  if (initStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(82,82,82)] px-6 text-zinc-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(82,82,82)] text-zinc-100">
      <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {copy.badge}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">{copy.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">{copy.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={copy.dashboardHref}
              className="rounded-md border border-zinc-600 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800/60"
            >
              {copy.dashboardLabel}
            </Link>
            <button
              type="button"
              onClick={handleClearSandbox}
              className="rounded-md border border-zinc-600 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800/60"
            >
              Clear Sandbox
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                isLoggingOut
                  ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
                  : "bg-white text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>

        <div className="mb-3 w-full max-w-[46.875rem] sm:min-w-[26.875rem] min-w-0">
          <div className="text-xs font-semibold text-zinc-200">Personal Sandbox</div>
          <InstructionsPanel
            open={instructionsOpen}
            onClose={() => setInstructionsOpen(false)}
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="flex min-w-0 w-full max-w-[46.875rem] flex-col sm:min-w-[26.875rem]">
            <EditorPanel
              projectName={copy.title}
              projectDescription="Local-only simulator session"
              code={code}
              onCodeChange={(nextCode) => {
                resetCompileStatus();
                setCode(nextCode);
              }}
              showHeader={false}
              editorFontSize={userSettings.editorFontSize}
            />

            <EditorControls
              onRun={handleRun}
              onStart={handleStart}
              onStop={handleStop}
              onStepForward={handleStepForward}
              onStepBack={handleStepBack}
              onReset={handleReset}
              onSyncNow={() => void syncSandboxNow(false, true)}
              uid={uid}
              stepsEngaged={stepsEngaged}
              stepIndex={stepIndex}
              allStatesLength={allStates.length}
              compileStatus={compileStatus}
            />

            {fatalError && (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {fatalError}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 sm:flex-row">
              <AssemblyInfo
                response={resp}
                states={allStates}
                registerInputs={registerOverrides}
                memoryInputs={memoryOverrides}
              />
              <div className="flex-shrink-0">
                <MemoryVisualPanel
                  memory={resp?.memory ?? null}
                  trackAddress="0x0"
                  digits={4}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 w-full min-w-0 xl:mt-0 xl:w-[28rem]">
            <div className="flex h-[46rem] flex-col rounded-md border border-zinc-700 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Input Presets
              </h2>
              <div className="mt-3 flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto">
                <RegisterEditor
                  registers={registerOverrides}
                  disabled={stepsEngaged}
                  onChange={(key, value) =>
                    setRegisterOverrides((prev) => {
                      const next = { ...prev };
                      if (!value.trim()) {
                        delete next[key];
                      } else {
                        next[key] = value;
                      }
                      return next;
                    })
                  }
                />
                <MemoryEditor
                  memory={memoryOverrides}
                  disabled={stepsEngaged}
                  onChange={setMemoryOverrides}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
