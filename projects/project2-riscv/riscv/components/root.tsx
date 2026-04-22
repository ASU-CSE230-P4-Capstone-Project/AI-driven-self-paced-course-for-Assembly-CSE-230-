"use client";
import React from "react";
import dynamic from "next/dynamic";
import Sidebar from "./sidebar";
import ProjectsGrid from "./projects-grid";
import EditorPanel from "./editor-panel";
import EditorControls from "./editor-controls";
import useRunner from "./use-runner";
import { readWorkspace, writeWorkspace } from "./workspace-store";
import { defaultProjectState, makeProjectId, makeUid } from "./project-helpers";
import { getClientUsername } from "./client-session";
import EditorSizePicker from "@/components/editor-size-picker";
import {
  EDITOR_LAYOUTS,
  getEditorSizePickerWidthClass,
  getRootSupportLayoutClass,
  getRootWorkspaceLayoutClass,
  type EditorSize,
  useEditorSizePreference,
} from "@/components/editor-layout";
import { syncWorkspace } from "@/app/api/sync_workspace/frontend";
import { loadWorkspace } from "@/app/api/load_workspace/frontend";
import { logout } from "@/app/logout/frontend";
import { getUserSettings } from "@/app/api/user_settings/frontend";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/app/api/user_settings/types";

import type {
  ProjectState,
  Project,
  Workspace,
  SubmitResponse,
  AssemblyInfoData,
  CompileStatus,
  SimState,
} from "./types";

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

const RegisterEditor = dynamic(() => import("./register-editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3 text-sm text-zinc-400">
      Loading register presets...
    </div>
  ),
});

const MemoryEditor = dynamic(() => import("./memory-editor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-3 text-sm text-zinc-400">
      Loading memory presets...
    </div>
  ),
});

type ProjectsViewProps = {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (id: string, next: { name?: string; description?: string }) => void;
};

const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onOpenProject,
  onDeleteProject,
  onUpdateProject,
}) => (
  <div className="px-4 mt-4 md:px-6">
    <ProjectsGrid
      projects={projects}
      onOpenProject={onOpenProject}
      onDeleteProject={onDeleteProject}
      onUpdateProject={onUpdateProject}
    />
  </div>
);

type EditorViewProps = {
  projectName: string;
  projectDescription?: string;
  code: string;
  onCodeChange: (nextCode: string) => void;
  onRun: () => void;
  onStart: () => void;
  onStop: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  onSyncNow?: () => void;
  uid: string;
  stepsEngaged: boolean;
  stepIndex: number;
  allStatesLength: number;
  compileStatus: CompileStatus;
  fatalError: string | null;
  resp: AssemblyInfoData | null;
  assemblyStates: SubmitResponse["states"];
  registerInputs: Record<string, string>;
  memoryInputs: Record<string, string>;
  registerPanel: React.ReactNode;
  editorFontSize: number;
  editorSize: EditorSize;
  onEditorSizeChange: (nextSize: EditorSize) => void;
};

const EditorView: React.FC<EditorViewProps> = ({
  projectName,
  projectDescription,
  code,
  onCodeChange,
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
  compileStatus,
  fatalError,
  resp,
  assemblyStates,
  registerInputs,
  memoryInputs,
  registerPanel,
  editorFontSize,
  editorSize,
  onEditorSizeChange,
}) => {
  const editorLayout = EDITOR_LAYOUTS[editorSize];
  const pickerWidthClass = getEditorSizePickerWidthClass(editorSize);
  const workspaceLayoutClass = getRootWorkspaceLayoutClass(editorSize);
  const supportLayoutClass = getRootSupportLayoutClass(editorSize);
  const layoutVars = {
    "--root-shell-max-width": editorLayout.rootShellMaxWidth,
    "--root-header-max-width": editorLayout.rootHeaderMaxWidth,
    "--root-editor-column-width": editorLayout.rootEditorColumnWidth,
    "--root-side-column-width": editorLayout.rootSideColumnWidth,
    "--root-side-panel-height": editorLayout.rootSidePanelHeight,
  } as React.CSSProperties;

  return (
    <div className="relative">
      <div
        className="mx-auto w-full max-w-[var(--root-shell-max-width)] pb-8 pt-4"
        style={layoutVars}
      >
        <div className="mb-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
          <div className="w-full min-w-0 max-w-[var(--root-header-max-width)]">
            <div className="text-xs font-semibold text-zinc-200">{projectName}</div>
            {projectDescription && (
              <div className="text-[11px] text-zinc-400 truncate">
                {projectDescription}
              </div>
            )}
          </div>
          <EditorSizePicker
            value={editorSize}
            onChange={onEditorSizeChange}
            className={`${pickerWidthClass} 2xl:justify-self-end`}
          />
        </div>
        <div className={`grid items-start gap-6 ${workspaceLayoutClass}`}>
          <div className="min-w-0">
            <EditorPanel
              projectName={projectName}
              projectDescription={projectDescription}
              code={code}
              onCodeChange={onCodeChange}
              showHeader={false}
              editorFontSize={editorFontSize}
              editorHeight={editorLayout.editorHeight}
            />

            <EditorControls
              onRun={onRun}
              onStart={onStart}
              onStop={onStop}
              onStepForward={onStepForward}
              onStepBack={onStepBack}
              onReset={onReset}
              onSyncNow={onSyncNow}
              uid={uid}
              stepsEngaged={stepsEngaged}
              stepIndex={stepIndex}
              allStatesLength={allStatesLength}
              compileStatus={compileStatus}
            />

            {fatalError && (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {fatalError}
              </div>
            )}

            <div className={`mt-6 grid items-start gap-4 ${supportLayoutClass}`}>
              <div className="min-w-0">
                <AssemblyInfo
                  response={resp}
                  states={assemblyStates}
                  registerInputs={registerInputs}
                  memoryInputs={memoryInputs}
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

          <div
            className={`min-w-0 self-start ${
              editorSize === "large" ? "" : "xl:sticky xl:top-4"
            }`}
          >
            {registerPanel}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Root({
  initialView,
  initialProjectId,
  sessionUsername,
}: {
  initialView?: "editor" | "projects";
  initialProjectId?: string;
  sessionUsername?: string | null;
}) {
  //starts empty-- Later when a register is changed we will populate this
  const [registerOverrides, setRegisterOverrides] = React.useState<Record<string, string>>({});
  const [memoryOverrides, setMemoryOverrides] = React.useState<Record<string, string>>({});
  const [uid, setUid] = React.useState<string>("");
  const [code, setCode] = React.useState("");
  const [resp, setResp] = React.useState<AssemblyInfoData | null>(null);
  const [stepsEngaged, setStepsEngaged] = React.useState(false); 
  const [fatalError, setFatalError] = React.useState<string | null>(null);
  const [simState, setSimState] = React.useState<SimState | null>(null);
  const [allStates, setAllStates] = React.useState<SubmitResponse["states"]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [initStatus, setInitStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [initError, setInitError] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"editor" | "projects">(
    initialView ?? "editor"
  );
  const [userSettings, setUserSettings] = React.useState<UserSettings>(
    DEFAULT_USER_SETTINGS
  );
  const cacheUsername = React.useMemo(
    () => sessionUsername?.trim() || getClientUsername(),
    [sessionUsername]
  );
  const [editorSize, setEditorSize] = useEditorSizePreference(cacheUsername);

  // we make an object to store defualt 0x0 values for all 32 registers
  //this is what we load into uiRegisters when start up the app 
  // and want to showcase 
    // all registers at 0x0 
  const defaultRegisters = React.useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`x${i}`, "0x0"])
      ),
    []
  );

  // this is what the UI actually shows--purely UI-- NOT WHAT WE SEND TO BACKEND
  // we layer user overrides on top of defaultRegisters
  // useMemo only re-renders (recreates this UI) if something changes
  const uiRegisters = React.useMemo(
    () => ({
      ...defaultRegisters,      // base values
      ...registerOverrides,     // any user overrides are shown instead
    }),
    [defaultRegisters, registerOverrides]
  );
  
  const currentProject = React.useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  );

  const [runMeta, setRunMeta] = React.useState<{ hadError: boolean; errorMessage: string }>({
    hadError: false,
    errorMessage: "",
  });

  const workspaceDirtyRef = React.useRef(false);

  const buildWorkspacePayload = React.useCallback((): Workspace | null => {
    if (!uid) return null;
    return {
      uid,
      currentProjectId,
      projects,
    };
  }, [uid, currentProjectId, projects]);

  const syncWorkspaceNow = React.useCallback(
    async (useBeacon = false, force = false) => {
      if (!workspaceDirtyRef.current && !force) return;
      const payload = buildWorkspacePayload();
      if (!payload) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const ok = navigator.sendBeacon(
          "/api/sync_workspace",
          JSON.stringify({ workspace: payload })
        );
        if (ok) {
          workspaceDirtyRef.current = false;
        }
        return;
      }

      const result = await syncWorkspace(payload);
      if (result.success) {
        workspaceDirtyRef.current = false;
      }
    },
    [buildWorkspacePayload]
  );

  React.useEffect(() => {
    return () => {
      void syncWorkspaceNow(true, true);
    };
  }, [syncWorkspaceNow]);

const persist = React.useCallback(
  (next?: Partial<ProjectState>) => {
    if (typeof window === "undefined") return;
    if (!uid || !currentProjectId) return;

    setProjects((prev) => {
      if (prev.length === 0) return prev;

      const idx = prev.findIndex((p) => p.id === currentProjectId);
      if (idx === -1) return prev;

      const project = prev[idx];

      const mergedState: ProjectState = {
        ...defaultProjectState,
        code,
        resp,
        simState,
        stepIndex,
        allStates,
        registerOverrides,
        memoryOverrides,
        ...next,
      };

      const updatedProject: Project = {
        ...project,
        state: mergedState,
      };

      const updatedProjects = [...prev];
      updatedProjects[idx] = updatedProject;

      const workspace: Workspace = {
        uid,
        currentProjectId,
        projects: updatedProjects,
      };

      writeWorkspace(workspace, cacheUsername);
      return updatedProjects;
    });
  },
  [uid, currentProjectId, code, resp, simState, stepIndex, allStates, registerOverrides, memoryOverrides, cacheUsername]
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
    persist,
    setAllStates,
    setStepIndex,
    setResp,
    setRunMeta,
    setFatalError,
    setStepsEngaged,
  });

    const loadProjectIntoState = React.useCallback((project: Project | null) => {
      resetCompileStatus();
      if (!project) {
        // blank editor
        setCode("");
        setResp(null);
        setSimState(null);
        setAllStates([]);
        setStepIndex(0);
        setStepsEngaged(false);
        setFatalError(null);
        setRegisterOverrides({});
        setMemoryOverrides({});
        return;
      }

      const state = project.state ?? defaultProjectState;
      setCode(state.code ?? "");
      setResp(state.resp ?? null);
      setSimState(state.simState ?? null);
      setAllStates(Array.isArray(state.allStates) ? state.allStates : []);
      setStepIndex(typeof state.stepIndex === "number" ? state.stepIndex : 0);
      setStepsEngaged(false);
      setFatalError(null);
      setRegisterOverrides(
        state.registerOverrides && typeof state.registerOverrides === "object"
          ? state.registerOverrides
          : ({} as Record<string, string>)
      );
      setMemoryOverrides(
        state.memoryOverrides && typeof state.memoryOverrides === "object"
          ? state.memoryOverrides
          : ({} as Record<string, string>)
      );
    }, [resetCompileStatus]);

  React.useEffect(() => {
    if (!initialProjectId) return;
    const target = projects.find((p) => p.id === initialProjectId);
    if (!target) return;
    if (currentProjectId !== initialProjectId) {
      setCurrentProjectId(initialProjectId);
      loadProjectIntoState(target);
    }
    setView("editor");
  }, [currentProjectId, initialProjectId, loadProjectIntoState, projects]);

  const deleteProjectById = React.useCallback(
    (projectId: string) => {
      if (typeof window === "undefined") return;

      const projectName =
        projects.find((project) => project.id === projectId)?.name ?? "this project";
      if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) {
        return;
      }

      setProjects((prev) => {
        const nextProjects = prev.filter((p) => p.id !== projectId);
        if (nextProjects.length === prev.length) return prev;

        let nextCurrentId = currentProjectId;
        let nextProject: Project | null = null;

        if (currentProjectId === projectId) {
          nextProject = nextProjects[0] ?? null;
          nextCurrentId = nextProject?.id ?? null;
          setCurrentProjectId(nextCurrentId);
          loadProjectIntoState(nextProject);
        }

        const workspaceUid = uid || makeUid();
        if (!uid) {
          setUid(workspaceUid);
        }

        const workspace: Workspace = {
          uid: workspaceUid,
          currentProjectId: nextCurrentId ?? null,
          projects: nextProjects,
        };
        writeWorkspace(workspace, cacheUsername);
        void syncWorkspace(workspace);
        return nextProjects;
      });
    },
    [currentProjectId, loadProjectIntoState, uid, cacheUsername, projects]
  );

  const updateProjectById = React.useCallback(
    (projectId: string, next: { name?: string; description?: string }) => {
      if (typeof window === "undefined") return;

      setProjects((prev) => {
        let didUpdate = false;
        const updatedProjects = prev.map((project) => {
          if (project.id !== projectId) return project;
          didUpdate = true;
          return { ...project, ...next };
        });

        if (!didUpdate) return prev;

        const workspaceUid = uid || makeUid();
        if (!uid) {
          setUid(workspaceUid);
        }

        const workspace: Workspace = {
          uid: workspaceUid,
          currentProjectId,
          projects: updatedProjects,
        };
        writeWorkspace(workspace, cacheUsername);
        void syncWorkspace(workspace);
        return updatedProjects;
      });
    },
    [currentProjectId, uid, cacheUsername]
  );


useClientLayoutEffect(() => {
  if (typeof window === "undefined") return;
  let cancelled = false;

  const applyWorkspace = (parsed: Partial<Workspace>) => {
    if (cancelled) return;
    const workspaceUid = parsed.uid ?? makeUid();
    setUid(workspaceUid);

    let existingProjects: Project[] = Array.isArray(parsed.projects)
      ? (parsed.projects as Project[])
      : [];
    // ensure description exists on old data
    existingProjects = existingProjects.map((p) => {
      const state = (p.state ?? {}) as Partial<ProjectState> & {
        versions?: Array<{ id?: string; code?: string }>;
        currentVersionId?: string | null;
      };
      let codeValue = typeof state.code === "string" ? state.code : "";
      if (!codeValue && Array.isArray(state.versions)) {
        const match =
          state.versions.find((v) => v?.id === state.currentVersionId) ??
          state.versions[0];
        if (match?.code) {
          codeValue = match.code;
        }
      }
      return {
        description: p.description ?? "",
        ...p,
        state: {
          ...defaultProjectState,
          ...state,
          code: codeValue,
        },
      };
    });

    // If somehow there are no projects, create one.
    if (existingProjects.length === 0) {
      const firstProject: Project = {
        id: makeProjectId(),
        name: "Untitled project 1",
        description: "",
        createdAt: new Date().toISOString(),
        state: { ...defaultProjectState, code: "" },
      };
      existingProjects = [firstProject];

      const newWorkspace: Workspace = {
        uid: workspaceUid,
        currentProjectId: firstProject.id,
        projects: existingProjects,
      };
      writeWorkspace(newWorkspace, cacheUsername);
    }

    setProjects(existingProjects);

    let projId = parsed.currentProjectId;
    if (!projId || !existingProjects.some((p) => p.id === projId)) {
      projId = existingProjects[0].id;
    }
    setCurrentProjectId(projId);

    const currentProject =
      existingProjects.find((p) => p.id === projId) ?? existingProjects[0];

    loadProjectIntoState(currentProject);
  };

  const applyFreshWorkspace = (): Workspace => {
    const freshUid = makeUid();
    const firstProject: Project = {
      id: makeProjectId(),
      name: "Untitled project 1",
      createdAt: new Date().toISOString(),
      state: { ...defaultProjectState, code: "" },
    };

    setUid(freshUid);
    setProjects([firstProject]);
    setCurrentProjectId(firstProject.id);

    // Editor state for the empty project
    setCode("");
    setResp(null);
    setSimState(null);
    setAllStates([]);
    setStepIndex(0);
    setStepsEngaged(false);
    setFatalError(null);
    setRegisterOverrides({});
    setMemoryOverrides({});

    const workspace: Workspace = {
      uid: freshUid,
      currentProjectId: firstProject.id,
      projects: [firstProject],
    };
    writeWorkspace(workspace, cacheUsername);
    return workspace;
  };

  const hydrate = async () => {
    setInitError(null);

    const cachedWorkspace = readWorkspace(cacheUsername);
    if (
      cachedWorkspace &&
      Array.isArray(cachedWorkspace.projects) &&
      cachedWorkspace.projects.length > 0
    ) {
      applyWorkspace(cachedWorkspace);
      setInitStatus("ready");
      return;
    }

    setInitStatus("loading");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setInitStatus("error");
      setInitError("Initial connection required. Check your internet connection and reload.");
      return;
    }

    const remote = await loadWorkspace();
    if (cancelled) return;

    if (!remote.success) {
      setInitStatus("error");
      setInitError(remote.message ?? "Unable to connect to the database.");
      return;
    }

    if (remote.workspace) {
      const workspaceFromRemote = remote.workspace as Workspace;
      writeWorkspace(workspaceFromRemote, cacheUsername);
      applyWorkspace(workspaceFromRemote);
      setInitStatus("ready");
      return;
    }

    const fresh = applyFreshWorkspace();
    setInitStatus("ready");
    void syncWorkspace(fresh);
  };

  void hydrate();

  return () => {
    cancelled = true;
  };
}, [cacheUsername, loadProjectIntoState]);

  React.useEffect(() => {
    if (!uid) return;
    workspaceDirtyRef.current = true;
  }, [uid, currentProjectId, projects, code, resp, simState, stepIndex, allStates, registerOverrides, memoryOverrides]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      void syncWorkspaceNow();
    }, 90 * 1000);
    return () => window.clearInterval(interval);
  }, [syncWorkspaceNow]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = () => {
      void syncWorkspaceNow(true, true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void syncWorkspaceNow(true, true);
      }
    };
    const handleBeforeUnload = () => {
      void syncWorkspaceNow(true, true);
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncWorkspaceNow]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      void syncWorkspaceNow();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncWorkspaceNow]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const response = await getUserSettings();
      if (cancelled || !response.success || !response.settings) return;

      setUserSettings(response.settings);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);


    //changes site based on any changes to the paramters in []
  React.useEffect(() => {
    if (!uid) return;
    persist();
  }, [uid, code, resp, simState, registerOverrides, memoryOverrides, persist]);

function handleSelectProject(projectId: string) {
  if (projectId === currentProjectId) {
    setView("editor");
    return;
  }
  
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  setCurrentProjectId(projectId);
  loadProjectIntoState(project);
  setView("editor");

  if (typeof window !== "undefined" && uid) {
    const workspace: Workspace = {
      uid,
      currentProjectId: projectId,
      projects,
    };
    writeWorkspace(workspace, cacheUsername);
    void syncWorkspace(workspace);
  }
}

  //when code changes in editor we update current version (or create one)
  const handleCodeChange = (nextCode: string) => {
    resetCompileStatus();
    setCode(nextCode);
    persist({ code: nextCode });
  };

  const handleReset = React.useCallback(() => {
    setRegisterOverrides({});
    setMemoryOverrides({});
    resetSession({ registerOverrides: {}, memoryOverrides: {} });
  }, [resetSession]);

  if (initStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(82,82,82)] text-zinc-100 px-6">
        <div className="max-w-lg rounded border border-red-500/40 bg-red-950/30 p-6 text-sm">
          <div className="font-semibold mb-2">Unable to connect</div>
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

  const handleOpenProjects = () => {
    void syncWorkspaceNow(false, true);
    setView("projects");
  };

  return (
    <div className="min-h-screen bg-[rgb(82,82,82)] text-zinc-100 flex">
      {/* LEFT SIDEBAR */}
      <Sidebar
        initialOpen={false}
        onOpenProjects={handleOpenProjects}
        onLogout={async () => {
          await syncWorkspaceNow(true, true);
          await logout();
        }}
      />

      {/* MAIN AREA */}
      <main className="relative flex-1 min-w-0 overflow-x-clip px-4 pb-8 pt-16 sm:px-6 md:pl-24 md:pt-2 lg:px-8 lg:pl-24">
        {view === "projects" ? (
          <ProjectsView
            projects={projects}
            onOpenProject={handleSelectProject}
            onDeleteProject={deleteProjectById}
            onUpdateProject={updateProjectById}
          />
        ) : (
          <EditorView
            projectName={currentProject?.name || "Untitled project"}
            projectDescription={currentProject?.description}
            code={code}
            onCodeChange={handleCodeChange}
            onRun={handleRun}
            onStart={handleStart}
            onStop={handleStop}
            onStepForward={handleStepForward}
            onStepBack={handleStepBack}
            onReset={handleReset}
            onSyncNow={() => void syncWorkspaceNow(false, true)}
            uid={uid}
            stepsEngaged={stepsEngaged}
            stepIndex={stepIndex}
            allStatesLength={allStates.length}
            compileStatus={compileStatus}
            fatalError={fatalError}
            resp={resp}
            assemblyStates={allStates}
            registerInputs={registerOverrides}
            memoryInputs={memoryOverrides}
            editorFontSize={userSettings.editorFontSize}
            editorSize={editorSize}
            onEditorSizeChange={setEditorSize}
            registerPanel={
              <div className="flex h-[var(--root-side-panel-height)] min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/40 p-4 shadow-xl shadow-black/10">
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
            }
          />
        )}
      </main>
    </div>
  );
}
