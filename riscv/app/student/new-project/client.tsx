"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, Workspace } from "@/components/types";
import { readWorkspace, writeWorkspace } from "@/components/workspace-store";
import {
  defaultProjectState,
  makeProjectId,
  makeUid,
} from "@/components/project-helpers";
import { syncWorkspace } from "@/app/api/sync_workspace/frontend";
import { getClientUsername } from "@/components/client-session";

type StudentNewProjectClientProps = {
  sessionUsername?: string | null;
};

export default function StudentNewProjectClient({
  sessionUsername,
}: StudentNewProjectClientProps) {
  const router = useRouter();
  const didRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const createProject = async () => {
      try {
        const cacheUsername = sessionUsername?.trim() || getClientUsername();
        const cachedWorkspace = readWorkspace(cacheUsername);
        const baseWorkspace: Workspace = cachedWorkspace
          ? {
              uid: cachedWorkspace.uid ?? makeUid(),
              currentProjectId: cachedWorkspace.currentProjectId ?? null,
              projects: Array.isArray(cachedWorkspace.projects)
                ? cachedWorkspace.projects
                : [],
            }
          : {
              uid: makeUid(),
              currentProjectId: null,
              projects: [],
            };

        const existingProjects: Project[] = Array.isArray(baseWorkspace.projects)
          ? baseWorkspace.projects
          : [];

        const newProject: Project = {
          id: makeProjectId(),
          name: `Untitled project ${existingProjects.length + 1}`,
          description: "",
          createdAt: new Date().toISOString(),
          state: { ...defaultProjectState, code: "" },
        };

        const workspace: Workspace = {
          uid: baseWorkspace.uid || makeUid(),
          currentProjectId: newProject.id,
          projects: [...existingProjects, newProject],
        };

        writeWorkspace(workspace, cacheUsername);
        router.replace(`/student/projects/${newProject.id}`);
        void syncWorkspace(workspace);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to create project."
        );
      }
    };

    void createProject();
  }, [router, sessionUsername]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(82,82,82)] text-zinc-100 px-6">
        <div className="max-w-lg rounded border border-red-500/40 bg-red-950/30 p-6 text-sm">
          <div className="font-semibold mb-2">Unable to create project</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(82,82,82)] text-zinc-100 px-6">
      <div className="text-sm text-zinc-300">Creating project...</div>
    </div>
  );
}
