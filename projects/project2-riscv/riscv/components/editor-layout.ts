"use client";

import React from "react";

export type EditorSize = "small" | "medium" | "large";

type EditorLayoutConfig = {
  editorHeight: string;
  rootShellMaxWidth: string;
  rootHeaderMaxWidth: string;
  rootEditorColumnWidth: string;
  rootSideColumnWidth: string;
  rootSidePanelHeight: string;
  labShellMaxWidth: string;
  labHeaderMaxWidth: string;
  labEditorColumnWidth: string;
  labSideColumnWidth: string;
  labSideColumnWidth2xl: string;
  labSidePanelHeight: string;
};

type EditorSizeOption = {
  value: EditorSize;
  label: string;
  description: string;
};

export const DEFAULT_EDITOR_SIZE: EditorSize = "medium";

export const EDITOR_SIZE_OPTIONS: EditorSizeOption[] = [
  {
    value: "small",
    label: "Small",
    description: "Compact workspace",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Balanced layout",
  },
  {
    value: "large",
    label: "Large",
    description: "Expanded editor",
  },
];

export const EDITOR_LAYOUTS: Record<EditorSize, EditorLayoutConfig> = {
  small: {
    editorHeight: "clamp(21rem, 44vh, 24rem)",
    rootShellMaxWidth: "56rem",
    rootHeaderMaxWidth: "24rem",
    rootEditorColumnWidth: "29rem",
    rootSideColumnWidth: "16rem",
    rootSidePanelHeight: "clamp(30rem, 66vh, 38rem)",
    labShellMaxWidth: "64rem",
    labHeaderMaxWidth: "24rem",
    labEditorColumnWidth: "31rem",
    labSideColumnWidth: "18rem",
    labSideColumnWidth2xl: "19rem",
    labSidePanelHeight: "clamp(33rem, 72vh, 41rem)",
  },
  medium: {
    editorHeight: "clamp(29rem, 56vh, 36rem)",
    rootShellMaxWidth: "92rem",
    rootHeaderMaxWidth: "46rem",
    rootEditorColumnWidth: "56rem",
    rootSideColumnWidth: "26rem",
    rootSidePanelHeight: "clamp(36rem, 72vh, 44rem)",
    labShellMaxWidth: "102rem",
    labHeaderMaxWidth: "46rem",
    labEditorColumnWidth: "58rem",
    labSideColumnWidth: "29rem",
    labSideColumnWidth2xl: "32rem",
    labSidePanelHeight: "clamp(40rem, 76vh, 49rem)",
  },
  large: {
    editorHeight: "clamp(38rem, 68vh, 48rem)",
    rootShellMaxWidth: "min(148rem, calc(100vw - 2.5rem))",
    rootHeaderMaxWidth: "64rem",
    rootEditorColumnWidth: "min(112rem, calc(100vw - 4rem))",
    rootSideColumnWidth: "100%",
    rootSidePanelHeight: "clamp(28rem, 58vh, 36rem)",
    labShellMaxWidth: "min(154rem, calc(100vw - 2.5rem))",
    labHeaderMaxWidth: "64rem",
    labEditorColumnWidth: "min(116rem, calc(100vw - 4rem))",
    labSideColumnWidth: "100%",
    labSideColumnWidth2xl: "100%",
    labSidePanelHeight: "clamp(32rem, 62vh, 40rem)",
  },
};

export function getEditorSizePickerWidthClass(editorSize: EditorSize): string {
  switch (editorSize) {
    case "small":
      return "w-full sm:w-auto";
    case "medium":
      return "w-full sm:w-auto";
    case "large":
      return "w-full sm:w-auto";
  }
}

export function getRootWorkspaceLayoutClass(editorSize: EditorSize): string {
  switch (editorSize) {
    case "small":
      return "grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(15rem,16.5rem)] 2xl:grid-cols-[minmax(0,0.95fr)_minmax(15rem,17rem)]";
    case "medium":
      return "grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,24rem)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(21rem,25rem)]";
    case "large":
      return "grid-cols-1";
  }
}

export function getRootSupportLayoutClass(editorSize: EditorSize): string {
  switch (editorSize) {
    case "small":
      return "grid-cols-1";
    case "medium":
      return "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]";
    case "large":
      return "grid-cols-1 lg:grid-cols-[minmax(0,1.28fr)_minmax(18rem,21rem)]";
  }
}

export function getLabWorkspaceLayoutClass(editorSize: EditorSize): string {
  switch (editorSize) {
    case "small":
      return "grid-cols-1 xl:grid-cols-[minmax(0,0.94fr)_minmax(17rem,18.5rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(17rem,19rem)]";
    case "medium":
      return "grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,27rem)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,30rem)]";
    case "large":
      return "grid-cols-1";
  }
}

export function getLabSupportLayoutClass(editorSize: EditorSize): string {
  switch (editorSize) {
    case "small":
      return "grid-cols-1";
    case "medium":
      return "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]";
    case "large":
      return "grid-cols-1 lg:grid-cols-[minmax(0,1.22fr)_minmax(18rem,22rem)]";
  }
}

function isEditorSize(value: string | null): value is EditorSize {
  return value === "small" || value === "medium" || value === "large";
}

function getEditorSizeStorageKey(username: string | null): string {
  return username ? `riscv-editor-size:${username}` : "riscv-editor-size";
}

export function useEditorSizePreference(username: string | null) {
  const storageKey = React.useMemo(
    () => getEditorSizeStorageKey(username),
    [username]
  );
  const [editorSize, setEditorSizeState] =
    React.useState<EditorSize>(DEFAULT_EDITOR_SIZE);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const storedValue = window.localStorage.getItem(storageKey);
    setEditorSizeState(
      isEditorSize(storedValue) ? storedValue : DEFAULT_EDITOR_SIZE
    );
  }, [storageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setEditorSizeState(
        isEditorSize(event.newValue) ? event.newValue : DEFAULT_EDITOR_SIZE
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  const setEditorSize = React.useCallback(
    (nextSize: EditorSize) => {
      setEditorSizeState(nextSize);

      if (typeof window === "undefined") return;
      window.localStorage.setItem(storageKey, nextSize);
    },
    [storageKey]
  );

  return [editorSize, setEditorSize] as const;
}
