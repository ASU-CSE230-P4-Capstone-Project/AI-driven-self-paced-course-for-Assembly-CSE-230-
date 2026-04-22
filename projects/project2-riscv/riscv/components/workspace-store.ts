"use client";
import type { Workspace } from "./types";

const WORKSPACE_STORAGE_KEY = "riscv-session";

function getWorkspaceStorageKey(username?: string | null) {
  if (username && username.trim()) {
    return `${WORKSPACE_STORAGE_KEY}:${username.trim()}`;
  }

  return WORKSPACE_STORAGE_KEY;
}

export const readWorkspace = (username?: string | null): Partial<Workspace> | null => {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(getWorkspaceStorageKey(username));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<Workspace>;
  } catch (e) {
    console.warn("bad workspace, resetting", e);
    return null;
  }
};

export const writeWorkspace = (workspace: Workspace, username?: string | null) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getWorkspaceStorageKey(username),
    JSON.stringify(workspace)
  );
};
