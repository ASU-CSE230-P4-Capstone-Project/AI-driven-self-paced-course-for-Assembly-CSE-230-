"use client";
import React from "react";
import type { Project } from "./types";
import Link from "next/link";

type ProjectsGridProps = {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (id: string, next: { name?: string; description?: string }) => void;
};

const ProjectsGrid: React.FC<ProjectsGridProps> = ({
  projects,
  onOpenProject,
  onDeleteProject,
  onUpdateProject,
}) => {
  const [editing, setEditing] = React.useState<{
    id: string;
    field: "name" | "description";
  } | null>(null);
  const [draft, setDraft] = React.useState("");

  const startEdit = (project: Project, field: "name" | "description") => {
    setEditing({ id: project.id, field });
    setDraft(field === "name" ? project.name : project.description ?? "");
  };

  const commitEdit = () => {
    if (!editing) return;
    if (editing.field === "name") {
      onUpdateProject(editing.id, { name: draft });
    } else {
      onUpdateProject(editing.id, { description: draft });
    }
    setEditing(null);
  };

  const isEditing = (projectId: string, field: "name" | "description") =>
    editing?.id === projectId && editing.field === field;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">My Projects</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/student/new-project"
            className="rounded bg-[rgb(248,196,119)] px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + New Project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 text-center text-sm text-zinc-400">
          You don&apos;t have any projects yet.
          <br />
          Click <span className="font-semibold">New Project</span> to start.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            return (
              <div key={project.id}>
                {/* Name*/}
                <input
                  type="text"
                  value={isEditing(project.id, "name") ? draft : project.name}
                  readOnly={!isEditing(project.id, "name")}
                  onClick={() => startEdit(project, "name")}
                  onFocus={() => startEdit(project, "name")}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  autoFocus={isEditing(project.id, "name")}
                  className="mb-2 w-full rounded border border-zinc-700 bg-zinc-950/60 px-2 py-1 text-sm text-zinc-100"
                  placeholder="Project name"
                />

                {/* Description */}
                <textarea
                  value={
                    isEditing(project.id, "description")
                      ? draft
                      : project.description ?? ""
                  }
                  readOnly={!isEditing(project.id, "description")}
                  onClick={() => startEdit(project, "description")}
                  onFocus={() => startEdit(project, "description")}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLTextAreaElement).blur();
                    }
                  }}
                  autoFocus={isEditing(project.id, "description")}
                  className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-100 resize-none h-16"
                  placeholder="Write about your awesome project"
                />

                <div className="mt-auto flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Created{" "}
                    {new Date(project.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project.id)}
                      className="rounded border border-red-400 px-3 py-1 text-[11px] font-medium text-red-300 hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                    <Link
                      href={`/student/projects/${project.id}`}
                      onClick={() => onOpenProject(project.id)}
                      className="rounded bg-[rgb(248,196,119)] px-3 py-1 text-[11px] font-medium text-zinc-900 hover:bg-amber-400 disabled:opacity-40"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectsGrid;
