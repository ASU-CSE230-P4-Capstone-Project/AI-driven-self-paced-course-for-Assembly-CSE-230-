"use client";
import type { ProjectState } from "./types";

export const defaultProjectState: ProjectState = {
  code: "",
  resp: null,
  simState: null,
  stepIndex: 0,
  allStates: [],
  registerOverrides: {},
  memoryOverrides: {},
};

export function makeUid() {
  return "uid-" + Math.random().toString(36).slice(2);
}

export function makeProjectId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "p-" + crypto.randomUUID();
  }
  return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
