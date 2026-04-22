"use client";
import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "@/components/sidebar"; //left sidebar
import { getClientUsername } from "@/components/client-session";
import CompileStatusIndicator from "@/components/compile-status-indicator";
import EditorSizePicker from "@/components/editor-size-picker";
import {
  EDITOR_LAYOUTS,
  getEditorSizePickerWidthClass,
  getLabSupportLayoutClass,
  getLabWorkspaceLayoutClass,
  useEditorSizePreference,
} from "@/components/editor-layout";
import { getStudentLabContext } from "@/app/api/student_lab_context/frontend";
import type { StudentCourseLab } from "@/app/api/student_course_labs/types";
import {
  getLabSubmissions,
} from "@/app/api/lab_submissions/frontend";
import type { LabSubmission } from "@/app/api/lab_submissions/types";
import { gradeLab } from "@/app/api/grade_lab/frontend";
import { getUserSettings } from "@/app/api/user_settings/frontend";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/app/api/user_settings/types";
import { getGradeStatus } from "@/app/api/grade_status/frontend";
import { syncLabSession } from "@/app/api/sync_lab_session/frontend";
import { logout } from "@/app/logout/frontend";
import useRunner from "@/components/use-runner";
import { filterLabMd } from "@/components/lab-markers";
import type {
  AssemblyInfoData,
  ProjectState,
  SimState,
  SubmitResponse,
} from "@/components/types";

const useClientLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const AssemblyInfo = dynamic(() => import("./assembly-info"), {
  ssr: false,
  loading: () => (
    <div className="w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-400 sm:max-w-[23.125rem] sm:min-w-[16rem]">
      Loading run details...
    </div>
  ),
});

const MemoryVisualPanel = dynamic(() => import("@/components/MemoryVisualPanel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
      Loading display...
    </div>
  ),
});

const RegisterEditor = dynamic(() => import("@/components/register-editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3 text-sm text-zinc-400">
      Loading register presets...
    </div>
  ),
});

const MemoryEditor = dynamic(() => import("@/components/memory-editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3 text-sm text-zinc-400">
      Loading memory presets...
    </div>
  ),
});

// Dynamically import the markdown preview to avoid SSR issues
const MdPreview = dynamic(
  () => import("md-editor-rt").then((mod) => mod.MdPreview),
  { ssr: false }
);

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[32rem] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/60 text-sm text-zinc-400">
      Loading editor...
    </div>
  ),
});
// Instructions Panel for Students to Read
type InstructionsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const InstructionsPanel: React.FC<InstructionsPanelProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="relative mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-yellow-800 font-bold hover:text-yellow-900"
        aria-label="Close instructions"
      >
        ✕
      </button>

      <h3 className="font-semibold text-yellow-800 mb-2">Lab Instructions</h3>
      <ul className="list-disc ml-5 text-sm text-yellow-900">
        <li>The simulation automatically terminates at the <strong>end of the file</strong>.</li>
        <li>Register and memory inputs are <strong>for testing only</strong> and do <strong>not affect your grade</strong>.</li>
        <li>Use only allowed instructions and follow lab instructions carefully.</li>
      </ul>
    </div>
  );
};
// Import the CSS for the markdown preview
import "md-editor-rt/lib/preview.css";

//key for the app
const LS_KEY = "riscv-lab-session";

type SavedVersion = {
  uid: string;
  labUid?: string;
  version?: number;
  code: string;
  resp: AssemblyInfoData | null;
  simState: SimState | null;
  stepIndex: number;
  allStates: SubmitResponse["states"];
  registerOverrides: Record<string, string>;
  memoryOverrides: Record<string, string>;
};

//BACKEND MUST MATCH THIS
function makeUid() {
  return "uid-" + Math.random().toString(36).slice(2);
}

type LabRootProps = {
  courseIdOverride?: string;
  labUidOverride?: string;
  sessionUsername?: string | null;
};

export default function LabRoot({
  courseIdOverride,
  labUidOverride,
  sessionUsername,
}: LabRootProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const courseIdFromQuery = courseIdOverride ?? searchParams.get("course_id") ?? "";
  const labUidFromQuery = labUidOverride ?? searchParams.get("lab") ?? "";
  const studentUsernameFromQuery = searchParams.get("student_username")?.trim() ?? "";
  const requestedGradeSessionId = searchParams.get("grade_session_id")?.trim() ?? "";
  const isStaffRoute =
    pathname.startsWith("/instructor") || pathname.startsWith("/ta");
  const isStaffReviewMode = isStaffRoute && !!studentUsernameFromQuery;
  const studentSessionStorageKey = React.useMemo(
    () =>
      courseIdFromQuery && labUidFromQuery
        ? `${LS_KEY}:${courseIdFromQuery}:${labUidFromQuery}`
        : LS_KEY,
    [courseIdFromQuery, labUidFromQuery]
  );

  const storageKey = React.useMemo(
    () =>
      isStaffReviewMode && courseIdFromQuery && labUidFromQuery && studentUsernameFromQuery
        ? `${LS_KEY}:review:${studentUsernameFromQuery}:${courseIdFromQuery}:${labUidFromQuery}`
        : studentSessionStorageKey,
    [
      courseIdFromQuery,
      isStaffReviewMode,
      labUidFromQuery,
      studentSessionStorageKey,
      studentUsernameFromQuery,
    ]
  );
  const reviewBasePath = pathname.startsWith("/instructor")
    ? "/instructor/student-labs-root"
    : "/ta/student-labs-root";
  const backHref = React.useMemo(() => {
    if (!isStaffReviewMode) {
      return courseIdFromQuery
        ? `/student/labs?course_id=${encodeURIComponent(courseIdFromQuery)}`
        : "/student/labs";
    }

    const params = new URLSearchParams();
    if (courseIdFromQuery) params.set("course_id", courseIdFromQuery);
    if (studentUsernameFromQuery) params.set("student_username", studentUsernameFromQuery);
    if (labUidFromQuery) params.set("lab", labUidFromQuery);
    if (requestedGradeSessionId) params.set("grade_session_id", requestedGradeSessionId);
    const query = params.toString();
    return query ? `${reviewBasePath}?${query}` : reviewBasePath;
  }, [
    courseIdFromQuery,
    isStaffReviewMode,
    labUidFromQuery,
    requestedGradeSessionId,
    reviewBasePath,
    studentUsernameFromQuery,
  ]);
  const backLabel = isStaffReviewMode ? "Review options" : "Lab Home";
  const cacheUsername = React.useMemo(
    () => sessionUsername?.trim() || getClientUsername(),
    [sessionUsername]
  );
  const [editorSize, setEditorSize] = useEditorSizePreference(cacheUsername);
  const localStorageKey = React.useMemo(
    () => (cacheUsername ? `${storageKey}:${cacheUsername}` : storageKey),
    [cacheUsername, storageKey]
  );
  const [uid, setUid] = React.useState<string>("");
  const [code, setCode] = React.useState("");
  const [resp, setResp] = React.useState<AssemblyInfoData | null>(null);
  const [stepsEngaged, setStepsEngaged] = React.useState(false); 
  const [fatalError, setFatalError] = React.useState<string | null>(null);
  const [simState, setSimState] = React.useState<SimState | null>(null);
  const [allStates, setAllStates] = React.useState<SubmitResponse["states"]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [registerOverrides, setRegisterOverrides] = React.useState<Record<string, string>>({});
  const [memoryOverrides, setMemoryOverrides] = React.useState<Record<string, string>>({});
  const [initStatus, setInitStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [initError, setInitError] = React.useState<string | null>(null);

  const defaultRegisters = React.useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`x${i}`, "0x0"])
      ),
    []
  );

  const uiRegisters = React.useMemo(
    () => ({
      ...defaultRegisters,
      ...registerOverrides,
    }),
    [defaultRegisters, registerOverrides]
  );

  // Labs for grading
  const [selectedLab, setSelectedLab] = React.useState<StudentCourseLab | null>(null);
  const [sidePanelTab, setSidePanelTab] = React.useState<"instructions" | "presets">(
    "instructions"
  );
  const [gradeAttemptsRemaining, setGradeAttemptsRemaining] = React.useState<number | null>(null);
  const [gradeAttemptsLimit, setGradeAttemptsLimit] = React.useState<number>(5);
  const [isGrading, setIsGrading] = React.useState(false);
  const [gradeCooldownSeconds, setGradeCooldownSeconds] = React.useState(0);
  const [submissionHistoryOpen, setSubmissionHistoryOpen] = React.useState(false);
  const [submissionHistoryLoading, setSubmissionHistoryLoading] = React.useState(false);
  const [submissionHistoryError, setSubmissionHistoryError] = React.useState<string | null>(null);
  const [submissions, setSubmissions] = React.useState<LabSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<string | null>(null);
  const [userSettings, setUserSettings] = React.useState<UserSettings>(
    DEFAULT_USER_SETTINGS
  );
  const [instructionsOpen, setInstructionsOpen] = React.useState(
    DEFAULT_USER_SETTINGS.openInstructionsByDefault
  );
  const editorLayout = EDITOR_LAYOUTS[editorSize];
  const pickerWidthClass = getEditorSizePickerWidthClass(editorSize);
  const workspaceLayoutClass = getLabWorkspaceLayoutClass(editorSize);
  const supportLayoutClass = getLabSupportLayoutClass(editorSize);
  const editorLayoutVars = {
    "--lab-shell-max-width": editorLayout.labShellMaxWidth,
    "--lab-header-max-width": editorLayout.labHeaderMaxWidth,
    "--lab-editor-column-width": editorLayout.labEditorColumnWidth,
    "--lab-side-column-width": editorLayout.labSideColumnWidth,
    "--lab-side-column-width-2xl": editorLayout.labSideColumnWidth2xl,
    "--lab-side-panel-height": editorLayout.labSidePanelHeight,
  } as React.CSSProperties;

  const [runMeta, setRunMeta] = React.useState<{ hadError: boolean; errorMessage: string }>({
    hadError: false,
    errorMessage: "",
  });

  const labSessionDirtyRef = React.useRef(false);
  const requestedReviewSelectionRef = React.useRef<string | null>(null);

  const buildLabSessionPayload = React.useCallback((overrides?: { storageKey?: string; labUid?: string | null }) => {
    if (!uid) return null;
    return {
      storageKey: overrides?.storageKey ?? storageKey,
      uid,
      labUid: overrides?.labUid ?? (labUidFromQuery || null),
      version: 1,
      code,
      resp,
      simState,
      stepIndex,
      allStates,
      registerOverrides,
      memoryOverrides,
    };
  }, [
    uid,
    storageKey,
    labUidFromQuery,
    code,
    resp,
    simState,
    stepIndex,
    allStates,
    registerOverrides,
    memoryOverrides,
  ]);

  const syncLabSessionNow = React.useCallback(
    async (
      useBeacon = false,
      force = false,
      overrides?: { storageKey?: string; labUid?: string | null }
    ) => {
      if (!labSessionDirtyRef.current && !force) return;
      const payload = buildLabSessionPayload(overrides);
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
          labSessionDirtyRef.current = false;
        }
        return;
      }

      const result = await syncLabSession(payload);
      if (result.success) {
        labSessionDirtyRef.current = false;
      }
    },
    [buildLabSessionPayload]
  );

  const prevStorageKeyRef = React.useRef<string | null>(null);
  const prevLabUidRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    const prevKey = prevStorageKeyRef.current;
    const prevLabUid = prevLabUidRef.current;
    if (prevKey && prevKey !== storageKey) {
      void syncLabSessionNow(false, true, { storageKey: prevKey, labUid: prevLabUid });
    }
    prevStorageKeyRef.current = storageKey;
    prevLabUidRef.current = labUidFromQuery || null;
  }, [isStaffReviewMode, labUidFromQuery, storageKey, syncLabSessionNow]);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    return () => {
      void syncLabSessionNow(true, true);
    };
  }, [isStaffReviewMode, syncLabSessionNow]);

  // LOADS LOCAL STORAGE (scoped per course and lab)
  useClientLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!courseIdFromQuery || !labUidFromQuery) {
      if (!isStaffReviewMode) {
        router.replace("/student/labs");
      }
      return;
    }

    let cancelled = false;

    const applySession = (parsed: SavedVersion) => {
      if (cancelled) return;
      setUid(parsed.uid ?? makeUid());

      if (typeof parsed.code === "string") {
        setCode(parsed.code);
      } else {
        setCode("");
      }

      if (parsed.resp) setResp(parsed.resp);
      else setResp(null);
      if (parsed.simState) setSimState(parsed.simState);
      else setSimState(null);
      if (Array.isArray(parsed.allStates)) setAllStates(parsed.allStates);
      else setAllStates([]);
      if (typeof parsed.stepIndex === "number") setStepIndex(parsed.stepIndex);
      else setStepIndex(0);
      setRegisterOverrides(
        parsed.registerOverrides && typeof parsed.registerOverrides === "object"
          ? parsed.registerOverrides
          : ({} as Record<string, string>)
      );
      setMemoryOverrides(
        parsed.memoryOverrides && typeof parsed.memoryOverrides === "object"
          ? parsed.memoryOverrides
          : ({} as Record<string, string>)
      );
    };

    const applyFresh = (): SavedVersion => {
      const freshUid = makeUid();
      const fresh: SavedVersion = {
        uid: freshUid,
        labUid: labUidFromQuery || undefined,
        version: 1,
        code: "",
        resp: null,
        simState: null,
        stepIndex: 0,
        allStates: [],
        registerOverrides: {} as Record<string, string>,
        memoryOverrides: {} as Record<string, string>,
      };
      applySession(fresh);
      return fresh;
    };

    const hydrate = async () => {
      setInitError(null);
      setSelectedLab(null);

      let cachedSession: SavedVersion | null = null;
      const rawCachedSession = window.localStorage.getItem(localStorageKey);
      if (rawCachedSession) {
        try {
          cachedSession = JSON.parse(rawCachedSession) as SavedVersion;
        } catch (error) {
          console.warn("Failed to parse cached lab session", error);
        }
      }

      const hasCachedSession = Boolean(cachedSession);
      if (cachedSession) {
        applySession(cachedSession);
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

      const contextResponse = await getStudentLabContext(
        courseIdFromQuery,
        labUidFromQuery,
        studentSessionStorageKey,
        isStaffReviewMode ? studentUsernameFromQuery : undefined
      );
      if (cancelled) return;

      if (!contextResponse.success) {
        if (!isStaffReviewMode && (contextResponse.status === 400 || contextResponse.status === 403)) {
          router.replace("/student/labs");
          return;
        }

        if (!isStaffReviewMode && contextResponse.status === 404) {
          router.replace(
            `/student/labs?course_id=${encodeURIComponent(courseIdFromQuery)}`
          );
          return;
        }

        if (!hasCachedSession) {
          setInitStatus("error");
          setInitError(contextResponse.message ?? "Unable to load this lab.");
        }
        return;
      }

      if (!contextResponse.lab) {
        if (!hasCachedSession) {
          setInitStatus("error");
          setInitError("Unable to load this lab.");
        }
        return;
      }

      setSelectedLab(contextResponse.lab);

      if (hasCachedSession) {
        setInitStatus("ready");
        return;
      }

      if (contextResponse.session) {
        const registerOverrides =
          (contextResponse.session.registerOverrides ?? {}) as Record<string, string>;
        const memoryOverrides =
          (contextResponse.session.memoryOverrides ?? {}) as Record<string, string>;
        const parsed: SavedVersion = {
          uid: contextResponse.session.uid ?? makeUid(),
          labUid: contextResponse.session.labUid ?? undefined,
          version: contextResponse.session.version ?? 1,
          code: contextResponse.session.code ?? "",
          resp: contextResponse.session.resp ?? null,
          simState: contextResponse.session.simState ?? null,
          stepIndex: contextResponse.session.stepIndex ?? 0,
          allStates: Array.isArray(contextResponse.session.allStates)
            ? contextResponse.session.allStates
            : [],
          registerOverrides,
          memoryOverrides,
        };
        window.localStorage.setItem(localStorageKey, JSON.stringify(parsed));
        applySession(parsed);
        setInitStatus("ready");
        return;
      }

      const fresh = applyFresh();
      window.localStorage.setItem(localStorageKey, JSON.stringify(fresh));
      if (!isStaffReviewMode) {
        await syncLabSession({
          storageKey,
          uid: fresh.uid,
          labUid: labUidFromQuery || null,
          version: 1,
          code: fresh.code,
          resp: fresh.resp,
          simState: fresh.simState,
          stepIndex: fresh.stepIndex,
          allStates: fresh.allStates,
          registerOverrides: fresh.registerOverrides,
          memoryOverrides: fresh.memoryOverrides,
        });
      }
      setInitStatus("ready");
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    courseIdFromQuery,
    isStaffReviewMode,
    labUidFromQuery,
    localStorageKey,
    router,
    storageKey,
    studentSessionStorageKey,
    studentUsernameFromQuery,
  ]);

  //HELPER to write everything to local storage
  const persist = React.useCallback(
    (next: Partial<SavedVersion> = {}) => {
      if (typeof window === "undefined") return;

      const payload: SavedVersion = {
        uid,
        labUid: labUidFromQuery || undefined,
        version: 1,
        code,
        resp,
        simState,
        stepIndex,
        allStates,
        registerOverrides,
        memoryOverrides,
        ...next,
      };

      window.localStorage.setItem(localStorageKey, JSON.stringify(payload));
    },
    [uid, code, resp, simState, stepIndex, allStates, registerOverrides, memoryOverrides, localStorageKey, labUidFromQuery]
  );
  

  //changes site based on any changes to the paramters in []
  React.useEffect(() => {
    if (!uid) return;
    persist();
  }, [uid, code, resp, simState, registerOverrides, memoryOverrides, persist]);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    if (!uid) return;
    labSessionDirtyRef.current = true;
  }, [
    allStates,
    code,
    isStaffReviewMode,
    registerOverrides,
    resp,
    simState,
    stepIndex,
    storageKey,
    uid,
    memoryOverrides,
  ]);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      void syncLabSessionNow();
    }, 90 * 1000);
    return () => window.clearInterval(interval);
  }, [isStaffReviewMode, syncLabSessionNow]);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    if (typeof window === "undefined") return;
    const handlePageHide = () => {
      void syncLabSessionNow(true, true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void syncLabSessionNow(true, true);
      }
    };
    const handleBeforeUnload = () => {
      void syncLabSessionNow(true, true);
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isStaffReviewMode, syncLabSessionNow]);

  React.useEffect(() => {
    if (isStaffReviewMode) return;
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      void syncLabSessionNow();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isStaffReviewMode, syncLabSessionNow]);

  React.useEffect(() => {
    if (isStaffReviewMode) {
      setGradeAttemptsRemaining(null);
      return;
    }

    let cancelled = false;
    async function loadGradeStatus() {
      if (!courseIdFromQuery || !selectedLab) {
        setGradeAttemptsRemaining(null);
        return;
      }

      const status = await getGradeStatus(courseIdFromQuery, selectedLab.uid);
      if (cancelled) return;
      if (typeof status.attemptsLimit === "number") {
        setGradeAttemptsLimit(status.attemptsLimit);
      }
      if (typeof status.attemptsRemaining === "number") {
        setGradeAttemptsRemaining(status.attemptsRemaining);
      }
    }
    loadGradeStatus();
    return () => {
      cancelled = true;
    };
  }, [courseIdFromQuery, isStaffReviewMode, selectedLab]);

  React.useEffect(() => {
    if (gradeCooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setGradeCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [gradeCooldownSeconds]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const response = await getUserSettings();
      if (cancelled || !response.success || !response.settings) return;

      setUserSettings(response.settings);
      setInstructionsOpen(response.settings.openInstructionsByDefault);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!submissionHistoryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSubmissionHistoryOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submissionHistoryOpen]);

  React.useEffect(() => {
    if (!submissionHistoryOpen || typeof document === "undefined") return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [submissionHistoryOpen]);

  React.useEffect(() => {
    setSubmissions([]);
    setSelectedSubmissionId(null);
    setSubmissionHistoryError(null);
    setSubmissionHistoryOpen(false);
  }, [courseIdFromQuery, selectedLab?.uid]);

  //when code changes in editor we update current version (or create one)
  const handleCodeChange = (nextCode: string) => {
    setCode(nextCode);
    persist({ code: nextCode });
  };

  const persistRunner = React.useCallback(
    (next?: Partial<ProjectState>) => {
      if (!next) return;
      persist({
        allStates: next.allStates ?? allStates,
        stepIndex: next.stepIndex ?? stepIndex,
        resp: next.resp ?? resp,
        simState: next.simState ?? simState,
      });
    },
    [persist, allStates, stepIndex, resp, simState]
  );

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
    persist: persistRunner,
    setAllStates,
    setStepIndex,
    setResp,
    setRunMeta,
    setFatalError,
    setStepsEngaged,
  });

  const previousCodeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (previousCodeRef.current !== null && previousCodeRef.current !== code) {
      resetCompileStatus();
    }
    previousCodeRef.current = code;
  }, [code, resetCompileStatus]);

  const handleReset = React.useCallback(() => {
    setRegisterOverrides({});
    setMemoryOverrides({});
    resetSession({ registerOverrides: {}, memoryOverrides: {} });
  }, [resetSession]);

  const handleOpenProjects = React.useCallback(() => {
    void syncLabSessionNow(false, true);
    router.push("/student/projects");
  }, [router, syncLabSessionNow]);

  const loadSubmissionHistory = React.useCallback(async () => {
    if (!courseIdFromQuery || !selectedLab) return;

    setSubmissionHistoryLoading(true);
    setSubmissionHistoryError(null);

    const response = await getLabSubmissions(
      courseIdFromQuery,
      selectedLab.uid,
      isStaffReviewMode ? studentUsernameFromQuery : undefined
    );

    if (!response.success) {
      setSubmissions([]);
      setSelectedSubmissionId(null);
      setSubmissionHistoryError(response.message ?? "Failed to load submission history");
      setSubmissionHistoryLoading(false);
      return;
    }

    const nextSubmissions = response.submissions ?? [];
    setSubmissions(nextSubmissions);
    setSelectedSubmissionId((current) => {
      if (current && nextSubmissions.some((submission) => submission.gradeSessionId === current)) {
        return current;
      }
      return nextSubmissions[0]?.gradeSessionId ?? null;
    });
    setSubmissionHistoryLoading(false);
  }, [courseIdFromQuery, isStaffReviewMode, selectedLab, studentUsernameFromQuery]);

  React.useEffect(() => {
    if (!submissionHistoryOpen) return;
    void loadSubmissionHistory();
  }, [loadSubmissionHistory, submissionHistoryOpen]);

  const selectedSubmission = React.useMemo(
    () =>
      submissions.find((submission) => submission.gradeSessionId === selectedSubmissionId) ??
      submissions[0] ??
      null,
    [selectedSubmissionId, submissions]
  );

  const applySubmissionToWorkspace = React.useCallback(
    (submission: LabSubmission) => {
      setCode(submission.submittedCode);
      setSimState(null);
      setRunMeta({ hadError: false, errorMessage: "" });
      resetSession({
        code: submission.submittedCode,
        simState: null,
        registerOverrides,
        memoryOverrides,
      });
    },
    [memoryOverrides, registerOverrides, resetSession]
  );

  const requestedReviewSelectionKey = React.useMemo(() => {
    if (
      !isStaffReviewMode ||
      !courseIdFromQuery ||
      !labUidFromQuery ||
      !studentUsernameFromQuery ||
      !requestedGradeSessionId
    ) {
      return "";
    }

    return [
      courseIdFromQuery,
      labUidFromQuery,
      studentUsernameFromQuery,
      requestedGradeSessionId,
    ].join(":");
  }, [
    courseIdFromQuery,
    isStaffReviewMode,
    labUidFromQuery,
    requestedGradeSessionId,
    studentUsernameFromQuery,
  ]);

  React.useEffect(() => {
    if (!requestedReviewSelectionKey) {
      requestedReviewSelectionRef.current = null;
      return;
    }

    if (!selectedLab || initStatus !== "ready") return;
    if (requestedReviewSelectionRef.current === requestedReviewSelectionKey) return;

    let cancelled = false;
    const currentLab = selectedLab;
    requestedReviewSelectionRef.current = requestedReviewSelectionKey;

    async function loadRequestedSubmission() {
      const response = await getLabSubmissions(
        courseIdFromQuery,
        currentLab.uid,
        studentUsernameFromQuery
      );

      if (cancelled) return;

      if (!response.success) {
        toast.warn(
          response.message ??
            "The requested attempt could not be loaded. Showing the current workspace instead."
        );
        return;
      }

      const nextSubmissions = response.submissions ?? [];
      setSubmissions(nextSubmissions);

      const requestedSubmission =
        nextSubmissions.find(
          (submission) => submission.gradeSessionId === requestedGradeSessionId
        ) ?? null;

      if (!requestedSubmission) {
        setSelectedSubmissionId(nextSubmissions[0]?.gradeSessionId ?? null);
        toast.warn(
          "The requested attempt could not be found. Showing the current workspace instead."
        );
        return;
      }

      setSelectedSubmissionId(requestedSubmission.gradeSessionId);
      applySubmissionToWorkspace(requestedSubmission);
    }

    void loadRequestedSubmission();

    return () => {
      cancelled = true;
    };
  }, [
    applySubmissionToWorkspace,
    courseIdFromQuery,
    initStatus,
    requestedGradeSessionId,
    requestedReviewSelectionKey,
    selectedLab,
    studentUsernameFromQuery,
  ]);

  const handleReinstateSubmission = React.useCallback(() => {
    if (!selectedSubmission) return;

    const shouldReinstate =
      !userSettings.warnBeforeReinstate ||
      window.confirm(
        "Reinstating this submission will replace the code currently in the editor. Continue?"
      );
    if (!shouldReinstate) return;

    setCode(selectedSubmission.submittedCode);
    setSimState(null);
    setRunMeta({ hadError: false, errorMessage: "" });
    setFatalError(null);
    resetSession({
      code: selectedSubmission.submittedCode,
      simState: null,
      registerOverrides,
      memoryOverrides,
    });
    setSubmissionHistoryOpen(false);
    toast.info("Submission code restored to the editor.");
  }, [memoryOverrides, registerOverrides, resetSession, selectedSubmission, userSettings.warnBeforeReinstate]);

  // Grade the current code against all test cases for the selected lab
  async function handleGrade(): Promise<boolean> {
    if (isStaffReviewMode) {
      toast.info("Grading is disabled while reviewing a student's work.");
      return false;
    }

    if (!code.trim()) {
      toast.error("No code to grade!");
      return false;
    }

    if (!courseIdFromQuery || !selectedLab) {
      toast.error("Lab context is missing. Return to course labs and reopen this lab.");
      return false;
    }

    const lab = selectedLab;

    try {
      const gradeSessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `grade-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const gradeResponse = await gradeLab(
        code,
        courseIdFromQuery,
        lab.uid,
        gradeSessionId
      );

      if (typeof gradeResponse.attemptsLimit === "number") {
        setGradeAttemptsLimit(gradeResponse.attemptsLimit);
      }
      if (typeof gradeResponse.attemptsRemaining === "number") {
        setGradeAttemptsRemaining(gradeResponse.attemptsRemaining);
      }

      if (gradeResponse.saveWarning) {
        toast.warn(gradeResponse.saveWarning);
      }

      const errorText = gradeResponse.error?.toLowerCase() ?? "";
      const noTestsConfigured = errorText.includes("no test cases");
      const gradeLimitReached = errorText.includes("limit");

      if (submissionHistoryOpen && typeof gradeResponse.grade === "number") {
        void loadSubmissionHistory();
      }

      if (gradeLimitReached) {
        toast.error(gradeResponse.error);
        return false;
      }

      if (noTestsConfigured) {
        toast.info(gradeResponse.error ?? `Lab ${lab.title}: No test cases`);
        return false;
      }

      if (gradeResponse.error) {
        toast.error(gradeResponse.error);
        return true;
      }

      const gradePercent =
        typeof gradeResponse.grade === "number" ? gradeResponse.grade : 0;

      if (gradeResponse.pass) {
        toast.success(`Lab ${lab.title}: PASSED!`);
      } else {
        toast.error(`Lab ${lab.title}: FAILED! (${gradePercent.toFixed(2)}%)`);
      }
      return true;
    } catch (error) {
      console.error("Grade error:", error);
      toast.error("An error occurred while grading");
      return false;
    }
  }

  const gradeBlockedByLimit =
    gradeAttemptsRemaining !== null && gradeAttemptsRemaining <= 0;
  const isGradeCoolingDown = gradeCooldownSeconds > 0;
  const gradeDisabled =
    isStaffReviewMode || !selectedLab || gradeBlockedByLimit || isGrading || isGradeCoolingDown;
  const gradeLabel = isGrading
    ? "Grading..."
    : isGradeCoolingDown
      ? `Grade (${gradeCooldownSeconds}s)`
      : isStaffReviewMode
        ? "Grade Disabled"
        : "Grade";
  const submissionHistoryModal =
    submissionHistoryOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSubmissionHistoryOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Past grading submissions"
              className="relative z-10 flex h-[min(80vh,48rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl ring-1 ring-black/10"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">Past Grading Submissions</h2>
                  <p className="text-sm text-zinc-500">
                    {selectedLab?.title ?? "Current Lab"}
                    {isStaffReviewMode && studentUsernameFromQuery
                      ? ` - ${studentUsernameFromQuery}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionHistoryOpen(false)}
                  className="rounded px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>

              <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]">
                <div className="border-b border-zinc-200 bg-zinc-50 lg:border-b-0 lg:border-r">
                  <div className="h-full overflow-y-auto p-3">
                    {submissionHistoryLoading ? (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                        Loading submissions...
                      </div>
                    ) : submissionHistoryError ? (
                      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {submissionHistoryError}
                      </div>
                    ) : submissions.length === 0 ? (
                      <div className="rounded border border-zinc-200 bg-white p-3 text-sm text-zinc-500">
                        No past grading submissions are available for this lab yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {submissions.map((submission, index) => {
                          const isSelected =
                            submission.gradeSessionId ===
                            (selectedSubmission?.gradeSessionId ?? null);
                          return (
                            <button
                              key={submission.gradeSessionId}
                              type="button"
                              onClick={() => setSelectedSubmissionId(submission.gradeSessionId)}
                              className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-zinc-900">
                                  Submission {submissions.length - index}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    submission.passed
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {submission.passed ? "Passed" : "Not Passed"}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-zinc-700">
                                Grade: {submission.grade.toFixed(2)}%
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {submission.passedTests}/{submission.totalTests} tests passed
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {new Date(submission.submittedAt).toLocaleString()}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-zinc-200 px-5 py-4">
                    {selectedSubmission ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                            Grade {selectedSubmission.grade.toFixed(2)}%
                          </span>
                          <span className="text-sm text-zinc-600">
                            {selectedSubmission.passedTests}/{selectedSubmission.totalTests} tests
                            passed
                          </span>
                          <span className="text-sm text-zinc-600">
                            {new Date(selectedSubmission.submittedAt).toLocaleString()}
                          </span>
                        </div>
                        {selectedSubmission.errorMessage && (
                          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {selectedSubmission.errorMessage}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        Select a submission to inspect the graded code.
                      </p>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 bg-zinc-950 p-5">
                    {selectedSubmission ? (
                      <pre className="h-full overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-100">
                        {selectedSubmission.submittedCode}
                      </pre>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
                        No submission selected.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-zinc-500">
                  Reinstating a submission will overwrite the code currently in the editor.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubmissionHistoryOpen(false)}
                    className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Exit
                  </button>
                  <button
                    type="button"
                    onClick={handleReinstateSubmission}
                    disabled={!selectedSubmission}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    Reinstate Code
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (initStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(82,82,82)] text-zinc-100 px-6">
        <div className="max-w-lg rounded border border-red-500/40 bg-red-950/30 p-6 text-sm">
          <div className="font-semibold mb-2">Unable to load lab</div>
          <div>{initError ?? "Initial connection required. Check your internet connection."}</div>
        </div>
      </div>
    );
  }

  if (initStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(82,82,82)] text-zinc-100 px-6">
        <div className="h-12 w-12 rounded-full border-4 border-zinc-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div
        className="relative flex min-h-screen overflow-x-clip bg-[rgb(82,82,82)] text-zinc-100"
      >
        <ToastContainer position="top-right" autoClose={5000} aria-label="container" />
        {!isStaffReviewMode && (
          <Sidebar
            initialOpen={false}
            onOpenProjects={handleOpenProjects}
            onLogout={async () => {
              await syncLabSessionNow(true, true);
              await logout();
            }}
          />
        )}
        <div
          className={`mx-auto w-full max-w-[var(--lab-shell-max-width)] px-4 pb-8 sm:px-6 lg:px-8 ${
            isStaffReviewMode ? "pt-4" : "pt-16 md:pl-24 md:pt-4 lg:pl-24"
          }`}
          style={editorLayoutVars}
        >
          <div className="mb-3 w-full min-w-0 max-w-[44rem]">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5z" />
              </svg>
              {backLabel}
            </Link>
          </div>
          {isStaffReviewMode && studentUsernameFromQuery && (
            <div className="mb-4 rounded-md border border-blue-400/40 bg-blue-950/30 px-4 py-3 text-sm text-blue-100">
              Reviewing <span className="font-semibold">{studentUsernameFromQuery}</span>
              {"'"}s lab workspace. You can inspect history here without syncing over the student
              {"'"}s saved
              session.
            </div>
          )}
          <div className="mb-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
            <div className="w-full min-w-0 max-w-[var(--lab-header-max-width)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Workspace
              </p>
              <h1 className="mt-1 text-lg font-semibold text-zinc-100">
                {selectedLab?.title ?? (isStaffReviewMode ? "Lab Review" : "Active Lab")}
              </h1>
            </div>
            <EditorSizePicker
              value={editorSize}
              onChange={setEditorSize}
              className={`${pickerWidthClass} 2xl:justify-self-end`}
            />
          </div>
          <div className={`grid items-start gap-6 ${workspaceLayoutClass}`}>
            {/* Editor + controls column */}
            <div className="min-w-0">
              <InstructionsPanel
                open={instructionsOpen}
                onClose={() => setInstructionsOpen(false)}
              />
              {/* EDITOR */}
              <CodeEditor
                code={code}
                onChange={handleCodeChange}
                fontSize={userSettings.editorFontSize}
                height={editorLayout.editorHeight}
                //currentLine={simState?.currentLine ?? null}
              />

              {/* CONTROLS under editor */}
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-950/35 p-3">
                {/* keep all 5 of your buttons */}
                <button
                  onClick={handleRun}
                  className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-900 disabled:opacity-50"
                  disabled={compileStatus.state === "compiling"}
                >
                  {compileStatus.state === "compiling" ? "Compiling..." : "Run"}
                </button>

                <CompileStatusIndicator status={compileStatus} />

                {stepsEngaged ? (
                  <button
                    onClick={() => handleStop()}
                    disabled={compileStatus.state === "compiling"}
                    className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleStart()}
                    disabled={compileStatus.state === "compiling"}
                    className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Start
                  </button>
                )}

                <button
                  onClick={() => handleStepForward()}
                  className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
                  disabled={
                    compileStatus.state === "compiling" ||
                    !stepsEngaged ||
                    allStates.length === 0 ||
                    stepIndex >= allStates.length - 1
                  }
                >
                  Step
                </button>

                <button
                  onClick={() => handleStepBack()}
                  className="rounded border border-zinc-600 bg-zinc-950/20 px-4 py-2 text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-700/55 hover:text-white disabled:opacity-50"
                  disabled={
                    compileStatus.state === "compiling" ||
                    !stepsEngaged ||
                    stepIndex === 0 ||
                    allStates.length === 0
                  }
                >
                  Back Step
                </button>

                <button
                  onClick={() => handleReset()}
                  className="rounded border border-zinc-600 bg-zinc-950/20 px-4 py-2 text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-700/55 hover:text-white disabled:opacity-50"
                  disabled={compileStatus.state === "compiling"}
                >
                  Reset
                </button>

                {!isStaffReviewMode && (
                  <>
                    <button
                      onClick={async () => {
                        if (gradeDisabled) return;
                        setIsGrading(true);
                        const didRequest = await handleGrade();
                        setIsGrading(false);
                        if (didRequest) {
                          setGradeCooldownSeconds(30);
                        }
                      }}
                      className={`rounded px-4 py-2 text-white ${
                        gradeDisabled
                          ? isGrading || isGradeCoolingDown
                            ? "bg-green-400 cursor-not-allowed"
                            : "bg-gray-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                      disabled={gradeDisabled}
                    >
                      {gradeLabel}
                    </button>
                    <span className="text-xs text-zinc-300">
                      Grades left: {gradeAttemptsRemaining ?? gradeAttemptsLimit}/{gradeAttemptsLimit}
                    </span>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSubmissionHistoryOpen(true)}
                  className="rounded border px-3 py-2 text-xs hover:bg-zinc-100 disabled:opacity-50"
                  disabled={!selectedLab}
                >
                  Past Submissions
                </button>

                {!isStaffReviewMode && (
                  <button
                    onClick={() => void syncLabSessionNow(false, true)}
                    className="rounded border border-zinc-600 bg-zinc-950/20 px-3 py-2 text-xs text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-700/55 hover:text-white"
                    disabled={compileStatus.state === "compiling"}
                  >
                    Sync Now
                  </button>
                )}

                {/* uid (kept from Version 1) */}
                <span className="w-full text-xs text-zinc-500 sm:ml-auto sm:w-auto sm:text-right">
                  {uid}
                </span>
              </div>

              {/* fatal error box (optional, like Version 2) */}
              {fatalError && (
                <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {fatalError}
                </div>
              )}

              <div className={`mt-6 grid items-start gap-4 ${supportLayoutClass}`}>
                <div className="min-w-0">
                  <AssemblyInfo
                    response={resp}
                    states={allStates}
                    registerInputs={registerOverrides}
                    memoryInputs={memoryOverrides}
                  />
                </div>
                <div className="min-w-0">
                  <MemoryVisualPanel
                    memory={resp?.memory ?? null}
                    trackAddress="0x0"
                    digits={4}
                  />
                </div>
              </div>
            </div>

            {/* Right column (tabbed lab panel) */}
            <div
              className={`min-w-0 self-start ${
                editorSize === "large" ? "" : "xl:sticky xl:top-4"
              }`}
            >
              <div className="flex h-[var(--lab-side-panel-height)] min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/40 shadow-xl shadow-black/10">
                <div className="flex border-b border-zinc-700 text-sm">
                  <button
                    type="button"
                    onClick={() => setSidePanelTab("instructions")}
                    className={`flex-1 px-3 py-2 text-center font-medium ${
                      sidePanelTab === "instructions"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    Lab Instructions
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidePanelTab("presets")}
                    className={`flex-1 px-3 py-2 text-center font-medium ${
                      sidePanelTab === "presets"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    Input Presets
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {sidePanelTab === "instructions" ? (
                    <div className="h-full bg-white text-zinc-900 p-4 flex flex-col">
                      <div className="mb-2 ">
                        {selectedLab?.title && (
                          <p className="text-lg font-bold text-zinc-900 ">
                            {selectedLab.title}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md ">
                        {selectedLab ? (
                          typeof window !== "undefined" && (
                            <MdPreview
                              modelValue={filterLabMd(selectedLab.md, "student")}
                              language="en-US"
                            />
                          )
                        ) : (
                          <p className="p-4 text-sm text-gray-500">
                            Select a lab to view instructions.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full p-4 flex flex-col">
                      <h2 className="font-semibold text-sm uppercase tracking-wide">
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
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {submissionHistoryModal}
    </>
  );

};
